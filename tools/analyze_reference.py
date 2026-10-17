#!/usr/bin/env python3
"""Study reference videos: the measurements behind a taste note.

For each video: format, cut list, shot-length rhythm, loudness and energy over
time, tempo and how often cuts land on musical onsets (librosa, optional), and a
timestamped contact sheet to look at. Writes <out>/<name>/analysis.md + sheet.jpg
and a combined <out>/summary.md table.

usage: analyze_reference.py video1.mp4 [video2.mp4 ...] --out references/
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vidlib as V  # noqa: E402


def analyze(path, out_root):
    name = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(out_root, name)
    os.makedirs(out, exist_ok=True)
    info = V.probe(path)
    dur = info['duration']
    cuts = V.cuts(path)
    shots = np.diff([0] + cuts + [dur])
    quarters = [sum(1 for c in cuts if q * dur / 4 <= c < (q + 1) * dur / 4) for q in range(4)]
    res = {'name': name, **info, 'cuts': cuts, 'shots': len(shots), 'median_shot': float(np.median(shots)),
           'shortest_shot': float(shots.min()), 'cuts_per_quarter': quarters}
    if info['has_audio']:
        res['loudness'] = V.loudness(path)
        y, sr = V.audio_mono(path)
        res['energy_db_per_second'] = V.rms_curve(y, sr, 1.0)
        tempo = V.tempo_and_onsets(y, sr)
        if tempo:
            onsets = np.array(tempo['onsets'])
            synced = [c for c in cuts if len(onsets) and np.min(np.abs(onsets - c)) <= 0.05]
            res['tempo'] = round(tempo['tempo'], 1)
            res['cuts_on_onsets'] = f"{len(synced)}/{len(cuts)}"
    V.contact_sheet(path, os.path.join(out, 'sheet.jpg'))

    md = [f"# {name}", '',
          f"{info['width']}×{info['height']} · {info['fps']:g} fps · {dur:.1f}s · {len(cuts)} cuts · median shot {res['median_shot']:.2f}s · shortest {res['shortest_shot']:.2f}s", '']
    if 'loudness' in res:
        md.append(f"Loudness {res['loudness']['integrated']} LUFS, LRA {res['loudness']['lra']} LU, peak {res['loudness']['true_peak']} dBFS")
    if 'tempo' in res:
        md.append(f"Tempo ≈ {res['tempo']} BPM; cuts within 50 ms of a musical onset: {res['cuts_on_onsets']}")
    md += ['', f"Cuts per quarter: {quarters} (rising = accelerating edit)", '', '## Shot rhythm', '', '```']
    top = shots.max() if len(shots) else 1
    md += [f"{i:>3} @{([0] + cuts)[i]:6.2f}s {s:5.2f}s {V.bar(s, top)}" for i, s in enumerate(shots)]
    md += ['```', '']
    if 'energy_db_per_second' in res:
        e = res['energy_db_per_second']
        lo = min(e)
        md += ['## Energy (dB RMS per second)', '', '```'] + [f"{i:>4}s {v:6.1f} {V.bar(v - lo, (max(e) - lo) or 1)}" for i, v in enumerate(e)] + ['```', '']
    md += ['![sheet](sheet.jpg)', '', '## Notes (fill in after looking at the sheet)', '',
           '- The one idea:', '- Structure (breathe / build / peak / land):', '- Type (family, size, how it enters):',
           '- Motion (camera, transitions, the repeated shape):', '- Color:', '- Sound (music, SFX, where it drops):', '- Steal this:']
    open(os.path.join(out, 'analysis.md'), 'w').write('\n'.join(md) + '\n')
    json.dump(res, open(os.path.join(out, 'analysis.json'), 'w'), indent=2)
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('videos', nargs='+')
    ap.add_argument('--out', default='references')
    a = ap.parse_args()
    rows = [analyze(v, a.out) for v in a.videos]
    lines = ['| Reference | Format | Length | Cuts | Median shot | Loudness | Tempo |', '|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append(f"| [{r['name']}]({r['name']}/analysis.md) | {r['width']}×{r['height']} @ {r['fps']:g} | {r['duration']:.1f}s | {len(r['cuts'])} | "
                     f"{r['median_shot']:.2f}s | {r.get('loudness', {}).get('integrated', '–')} LUFS | {r.get('tempo', '–')} |")
    open(os.path.join(a.out, 'summary.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    sys.exit(main())
