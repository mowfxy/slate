#!/usr/bin/env python3
"""The critic: watches a render like an editor and says what to fix.

Measures the rendered file (not the plan) and checks it against the film's
manifest (engine/render.mjs writes build/manifest.json) and the taste rules in
skills/video-taste. Also runs the originality check against the reference
fingerprints. Writes report.md, report.json and contact.jpg. Exit code 1 when
any check fails, so it can gate a render loop.

usage: critic.py out/film.mp4 --manifest build/manifest.json --out build/critic [--lufs -14] [--refs fingerprints.json]
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vidlib as V  # noqa: E402

HOLD_OK = {'type', 'logo'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_REFS = os.path.join(ROOT, 'skills/video-critic/references/fingerprints.json')
import originality  # noqa: E402


def check(results, name, ok, detail, severity='fail'):
    results.append({'check': name, 'status': 'pass' if ok else severity, 'detail': detail})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video')
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--refs', default=DEFAULT_REFS, help='reference fingerprints (originality.py fingerprint)')
    ap.add_argument('--out', default='critic')
    ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    tl = json.load(open(a.manifest))
    info = V.probe(a.video)
    fps = info['fps']
    frame = 1 / fps
    beat = 60 / tl['bpm']
    R = []

    # 1. Duration and format match the plan.
    check(R, 'Duration matches the manifest', abs(info['duration'] - tl['duration']) <= 2 * frame + 0.05,
          f"{info['duration']:.2f}s rendered vs {tl['duration']:.2f}s planned")
    check(R, 'Frame size and rate', (info['width'], info['height']) == (tl['width'], tl['height']) and abs(fps - tl['fps']) < 0.01,
          f"{info['width']}×{info['height']} @ {fps:g}fps")

    # 2. Cuts land on the beat grid (quarter-beat subdivisions), and the planned cuts are really there.
    detected = []
    for c in V.cuts(a.video, threshold=0.15):
        if not detected or c - detected[-1] > 2.5 * frame:  # one cut, not its entrance animation
            detected.append(c)
    planned = sorted({round(e['t'], 4) for e in tl['events'] if e['type'] == 'cut' and e['t'] > 0})
    sub = beat / 4
    # frames quantize time (allow one frame); an animated entrance can trip the detector a few frames after its cut
    on_grid = [c for c in detected
               if abs(c / sub - round(c / sub)) * sub <= 1.01 * frame or any(0 <= c - p <= 3.01 * frame for p in planned)]
    pct = 100 * len(on_grid) / len(detected) if detected else 100
    check(R, 'Cuts on the beat', pct >= 85, f"{len(on_grid)}/{len(detected)} detected cuts within a frame of the ¼-beat grid ({pct:.0f}%)")
    found = [p for p in planned if any(abs(p - c) <= 2 * frame for c in detected)]
    recall = 100 * len(found) / len(planned) if planned else 100
    # soft cuts between similar frames (white title to white title) are legitimately invisible to the detector
    check(R, 'Planned cuts are visible', recall >= 70, f"{len(found)}/{len(planned)} planned cuts detected ({recall:.0f}%)", 'warn')

    # 3. Shape: the end is calmer than the peak (breathe -> build -> peak -> land).
    dur = info['duration']
    quarters = [sum(1 for c in detected if q * dur / 4 <= c < (q + 1) * dur / 4) for q in range(4)]
    tail = [c for c in detected if c > dur * 0.85]
    check(R, 'The ending lands', len(tail) <= max(2, 0.15 * dur), f"{len(tail)} cuts in the final 15%; cuts per quarter {quarters}", 'warn')
    # Form: the film says what shape it chose, and doesn't fall into the trailer habit by default.
    notes = tl.get('notes') or {}
    check(R, 'Form is chosen', bool(notes.get('form')) and bool(notes.get('sound')),
          f"form: {notes.get('form') or '—'}; sound: {notes.get('sound') or '—'}"[:160] if notes.get('form') or notes.get('sound') else "no form or sound in F.notes()", 'warn')
    m = tl.get('music') or {}
    check(R, 'Real music', bool(m.get('track')) or bool(m.get('composed')) or m.get('style') == 'room',
          f"track {m['track']}" if m.get('track') else f"composed for this cut ({m['composed']})" if m.get('composed') else
          f"generated sketch score ({m.get('style')}): fine for a draft; for delivery compose one on tools/synth.py, or use a supplied or Lyria track (tools/music.py)", 'warn')
    first_logo = min([s['start'] for s in tl['scenes'] if s['kind'] == 'logo'] or [dur])
    body = [c for c in detected if c < first_logo - frame]
    lens = np.diff([0] + body + [first_logo]) if body else np.array([first_logo])
    third = max(1, len(lens) // 3)
    early, late = float(np.median(lens[:-third])) if len(lens) > third else 0, float(np.median(lens[-third:]))
    accelerates = len(lens) >= 6 and late < 0.55 * early
    stops = any(ev['type'] == 'drop' and first_logo - 4 <= ev['t'] <= first_logo + 0.5 for ev in tl['events'])
    trailer = str(notes.get('form', '')).lower().startswith('trailer')
    check(R, 'Not the trailer habit', trailer or not (accelerates and stops),
          f"shots {early:.1f}s early, {late:.1f}s before the logo; {'music stops before the logo' if stops else 'no stop before the logo'}"
          + (' (declared trailer)' if trailer else ''), 'warn')
    logos = [s for s in tl['scenes'] if s['kind'] == 'logo']
    if logos:
        hold = logos[-1]['end'] - logos[-1]['start']
        check(R, 'Logo holds', hold >= 2.5, f"logo on screen {hold:.2f}s (≥ 2.5s)")

    # 4. Every scene with words is on screen long enough to read them: words/3.5 + 0.6s, at least 1.2s.
    slow = []
    for s in tl['scenes']:
        words = len(s.get('words', '').split())
        if not words:
            continue
        need = max(1.2, words / 3.5 + 0.6)
        have = s['end'] - s['start']
        if have + 1e-3 < need:
            slow.append(f"{s['name']} needs {need:.1f}s, has {have:.1f}s")
    check(R, 'Every line is readable', not slow, '; '.join(slow) or 'all words held long enough')
    long_text = [s['name'] for s in tl['scenes'] if s['kind'] == 'type' and len(s.get('words', '').split()) > 9]
    check(R, 'Short lines (≤ 9 words)', not long_text, ', '.join(long_text) or 'all lines short', 'warn')

    # 5. No accidental black, no dead air on screen.
    def meant(s, e):
        # a dark title card or a deliberate blackout after a drop is design, not an accident
        cover = sum(max(0, min(e, x['end']) - max(s, x['start'])) for x in tl['scenes'] if x['kind'] in HOLD_OK)
        drop = any(ev['type'] == 'drop' and abs(ev['t'] - s) <= 0.5 and e - s <= 2.5 for ev in tl['events'])
        return cover >= 0.8 * (e - s) or drop
    blacks = [b for b in V.black_segments(a.video) if b[0] > 0.05 and b[1] < dur - 0.05 and not meant(*b)]
    check(R, 'No black frames', not blacks, ', '.join(f"{s:.2f}–{e:.2f}s" for s, e in blacks) or 'none')
    frozen = []
    for s, e in V.frozen_segments(a.video, 2.5):
        mid = (s + e) / 2
        here = [x for x in tl['scenes'] if x['start'] <= mid < x['end']]
        if here and not any(x['kind'] in HOLD_OK for x in here):
            frozen.append(f"{s:.1f}–{e:.1f}s in {here[-1]['name']}")
    check(R, 'Nothing sits frozen', not frozen, ', '.join(frozen) or 'motion everywhere it should be', 'warn')
    flashes, stutters = V.glitches(a.video, fps)
    check(R, 'No flashes', not flashes, ', '.join(f'{t:.2f}s' for t in flashes[:8]) or 'no frame breaks from its neighbours')
    check(R, 'Smooth motion', len(stutters) <= 2, ', '.join(f'{t:.2f}s' for t in stutters[:8]) or 'no repeated frames inside motion',
          'warn' if len(stutters) <= 6 else 'fail')

    # 6. Sound: loudness on target, peaks safe, and the last moment is quiet.
    if info['has_audio']:
        L = V.loudness(a.video)
        check(R, 'Loudness on target', L['integrated'] is not None and abs(L['integrated'] - a.lufs) <= 1.0,
              f"{L['integrated']} LUFS integrated (target {a.lufs}), LRA {L['lra']} LU")
        check(R, 'Peaks are safe', L['true_peak'] is not None and L['true_peak'] <= -0.5, f"peak {L['true_peak']} dBFS (≤ −0.5)")
        y, sr = V.audio_mono(a.video)
        end_db = 20 * np.log10(np.sqrt(np.mean(y[-int(0.25 * sr):].astype(np.float64) ** 2)) + 1e-9)
        check(R, 'Sound resolves at the end', end_db < -30, f"last 0.25s at {end_db:.1f} dBFS", 'warn')
        curve = V.rms_curve(y, sr, step=max(0.5, dur / 40))
        # produced launch music always has a sub; under 2% below 60 Hz sounds thin next to the references
        if (tl.get('music') or {}).get('style') not in (None, 'room'):
            spec = np.abs(np.fft.rfft(y.astype(np.float64))) ** 2
            f = np.fft.rfftfreq(len(y), 1 / sr)
            total = spec[(f >= 20) & (f < 11000)].sum() or 1
            share = lambda lo, hi: 100 * spec[(f >= lo) & (f < hi)].sum() / total
            sub, low, pres = share(20, 60), share(60, 150), share(2000, 6000)
            check(R, 'Has a low end', sub >= 2 and sub + low <= 75,
                  f"{sub:.0f}% below 60 Hz, {low:.0f}% at 60–150 Hz, {pres:.1f}% presence (references: 10–60% sub)", 'warn')
    else:
        check(R, 'Has a soundtrack', False, 'no audio stream')
        curve = []

    # 7. Originality: no stretch of the film may look like a reference film.
    if a.refs and os.path.exists(a.refs):
        o = originality.check(a.video, json.load(open(a.refs)))
        # near-copies someone looked at and judged a coincidence: F.notes({reviewed: [{from, to, ref, why}]}).
        # They're listed in the report, not failed; the reason has to be written down, and it's visible to anyone reading it.
        rev = [r for r in (notes.get('reviewed') or []) if r.get('why')]
        waived = [n for n in o['near'] if any(r['from'] <= n['t'] <= r['to'] and r.get('ref', n['ref']) == n['ref'] for r in rev)]
        o['near'] = [n for n in o['near'] if n not in waived]
        o['share'] = len(o['near']) / o['frames'] if o['frames'] else 0.0
        ts = [n['t'] for n in o['near']]
        worst = max([sum(1 for u in ts if t <= u < t + 2) for t in ts] or [0])
        detail = f"{len(o['near'])}/{o['frames']} frames close to a reference ({100 * o['share']:.1f}%)"
        if o['near']:
            n = min(o['near'], key=lambda x: x['hamming'])
            detail += f"; closest {n['t']}s ~ {n['ref']} @ {n['ref_t']}s"
        if waived:
            detail += f"; {len(waived)} more reviewed as coincidence ({'; '.join(r['why'] for r in rev)})"
        check(R, 'Original (not a reference)', o['share'] <= 0.05 and worst < 3, detail)

    # 8. Layout: the renderer's audit of where every visible word sat (engine/render.mjs writes layout.json).
    lay = os.path.join(os.path.dirname(a.manifest), 'layout.json')
    if os.path.exists(lay):
        issues = json.load(open(lay))
        check(R, 'Type placement', not issues,
              '; '.join(f"{i['what']} {i['kind']} at {i['from']}–{i['to']}s" for i in issues[:4]) + (f" (+{len(issues) - 4} more)" if len(issues) > 4 else '')
              if issues else 'every word in title-safe, off pictures and off other words')

    sheet = V.contact_sheet(a.video, os.path.join(a.out, 'contact.jpg'))
    fails = [r for r in R if r['status'] == 'fail']
    warns = [r for r in R if r['status'] == 'warn']

    shots = np.diff([0] + detected + [dur])
    lines = [f"# Critic report: {os.path.basename(a.video)}", '',
             f"**{'PASS' if not fails else 'FAIL'}** · {len(R) - len(fails) - len(warns)} passed, {len(warns)} warnings, {len(fails)} failed", '',
             f"{info['width']}×{info['height']} · {fps:g} fps · {dur:.2f}s · {tl['bpm']} BPM · {len(detected)} cuts · median shot {np.median(shots):.2f}s", '',
             '| | Check | Detail |', '|---|---|---|']
    icon = {'pass': '✅', 'warn': '⚠️', 'fail': '❌'}
    lines += [f"| {icon[r['status']]} | {r['check']} | {r['detail']} |" for r in R]
    lines += ['', '## Cut rhythm (shot length per shot, in order)', '', '```']
    top = max(shots) if len(shots) else 1
    lines += [f"{i:>3} {s:5.2f}s {V.bar(s, top)}" for i, s in enumerate(shots)]
    lines += ['```', '', '## Loudness over time (dB RMS)', '', '```']
    if curve:
        lo = min(curve)
        lines += [f"{i * max(0.5, dur / 40):6.1f}s {c:6.1f} {V.bar(c - lo, max(curve) - lo or 1)}" for i, c in enumerate(curve)]
    lines += ['```', '', f"![contact sheet]({os.path.basename(sheet)})", '',
              'Now look at contact.jpg yourself and score it with the rubric in skills/video-critic.']
    open(os.path.join(a.out, 'report.md'), 'w').write('\n'.join(lines) + '\n')
    json.dump({'video': a.video, 'pass': not fails, 'checks': R, 'cuts': detected, 'loudness_curve': curve}, open(os.path.join(a.out, 'report.json'), 'w'), indent=2)
    # the terminal gets aligned columns; report.md keeps the table
    w = max(len(r['check']) for r in R)
    print('\n'.join(lines[:5]))
    print('\n'.join(f"{icon[r['status']]}  {r['check']:<{w}}  {r['detail']}" for r in R))
    print(f"▸ critic -> {a.out}/report.md")
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
