#!/usr/bin/env python3
"""The critic: watches a render like an editor and says what to fix.

Measures the rendered file (not the plan) and checks it against the timeline
and the taste rules in skills/video-taste. Writes report.md, report.json and
contact.jpg. Exit code 1 when any check fails, so it can gate a render loop.

usage: critic.py out/film.mp4 --timeline build/timeline.json --out build/critic [--lufs -14]
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vidlib as V  # noqa: E402

TEXT_SCENES = {'typeTitle', 'bracketTitle', 'titleCard', 'logoEnd', 'promptBox'}
HOLD_OK = {'typeTitle', 'bracketTitle', 'titleCard', 'logoEnd', 'logo'}


def check(results, name, ok, detail, severity='fail'):
    results.append({'check': name, 'status': 'pass' if ok else severity, 'detail': detail})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video')
    ap.add_argument('--timeline', required=True)
    ap.add_argument('--out', default='critic')
    ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    tl = json.load(open(a.timeline))
    spec_dir = os.path.dirname(os.path.dirname(os.path.abspath(a.timeline)))
    spec = json.load(open(os.path.join(spec_dir, 'spec.json'))) if os.path.exists(os.path.join(spec_dir, 'spec.json')) else {'scenes': []}
    info = V.probe(a.video)
    fps = info['fps']
    frame = 1 / fps
    beat = 60 / tl['bpm']
    R = []

    # 1. Duration and format match the plan.
    check(R, 'Duration matches the timeline', abs(info['duration'] - tl['duration']) <= 2 * frame + 0.05,
          f"{info['duration']:.2f}s rendered vs {tl['duration']:.2f}s planned")
    check(R, 'Frame size and rate', (info['width'], info['height']) == (tl['width'], tl['height']) and abs(fps - tl['fps']) < 0.01,
          f"{info['width']}×{info['height']} @ {fps:g}fps")

    # 2. Cuts land on the beat grid (quarter-beat subdivisions), and the planned cuts are really there.
    detected = []
    for c in V.cuts(a.video, threshold=0.15):
        if not detected or c - detected[-1] > 2.5 * frame:  # one cut, not its entrance animation
            detected.append(c)
    planned = sorted({round(e['t'], 4) for e in tl['events'] if e['type'] == 'cut'})
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
    last = tl['scenes'][-1]
    if last['type'] == 'logoEnd':
        hold = last['end'] - last['start']
        check(R, 'Logo holds', hold >= 2.5, f"logo on screen {hold:.2f}s (≥ 2.5s)")

    # 4. Every title is on screen long enough to read: typed lines hold max(1s, words/4 + 0.4s) after the last letter.
    slow = []
    for r in tl['reading']:
        sc = tl['scenes'][r['scene']]
        if sc['type'] not in TEXT_SCENES or not r['words']:
            continue
        typed = sc.get('typedAt', 0) or 0
        need = typed + max(1.0, r['words'] / 4 + 0.4) if sc['type'] in ('typeTitle', 'bracketTitle') else r['words'] / 3 + 0.5
        if r['seconds'] + 1e-3 < need:
            slow.append(f"scene {r['scene']} needs {need:.1f}s, has {r['seconds']:.1f}s")
    check(R, 'Every title is readable', not slow, '; '.join(slow) or 'all titles held long enough')
    long_text = [f"scene {i}" for i, s in enumerate(spec.get('scenes', [])) if s.get('text') and len(s['text'].replace('*', '').split()) > 9]
    check(R, 'Short lines (≤ 9 words)', not long_text, ', '.join(long_text) or 'all lines short', 'warn')

    # 5. No accidental black, no dead air on screen.
    blacks = [b for b in V.black_segments(a.video) if b[0] > 0.05 and b[1] < dur - 0.05]
    check(R, 'No black frames', not blacks, ', '.join(f"{s:.2f}–{e:.2f}s" for s, e in blacks) or 'none')
    frozen = []
    for s, e in V.frozen_segments(a.video, 2.5):
        mid = (s + e) / 2
        sc = next((x for x in tl['scenes'] if x['start'] <= mid < x['end']), None)
        if sc and sc['type'] not in HOLD_OK:
            frozen.append(f"{s:.1f}–{e:.1f}s in {sc['type']}")
    check(R, 'Nothing sits frozen', not frozen, ', '.join(frozen) or 'motion everywhere it should be', 'warn')

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
    else:
        check(R, 'Has a soundtrack', False, 'no audio stream')
        curve = []

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
              'Now look at contact.jpg yourself: is there one idea, does every frame have one focal point, does the type breathe, does the end land?']
    open(os.path.join(a.out, 'report.md'), 'w').write('\n'.join(lines) + '\n')
    json.dump({'video': a.video, 'pass': not fails, 'checks': R, 'cuts': detected, 'loudness_curve': curve}, open(os.path.join(a.out, 'report.json'), 'w'), indent=2)
    print('\n'.join(lines[:len(R) + 7]))
    print(f"▸ critic -> {a.out}/report.md")
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
