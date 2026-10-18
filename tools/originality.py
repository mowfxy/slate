#!/usr/bin/env python3
"""Originality check: does a render look like one of the reference films?

Taste is learned from references; their frames must not come back out. This
fingerprints frames (a 9x8 difference hash for layout, an 8x8x8 color
histogram for palette) and flags render frames that are close to a reference
frame on both at once. Plain or near-black frames are skipped: every film has
some, and they prove nothing.

  originality.py fingerprint ref1.mp4 ref2.mp4 ... --out refs.json   # store fingerprints, not footage
  originality.py check out/film.mp4 --refs refs.json [--out report.json]

Exit code 1 when more than --max-share of the render's frames (default 5%)
are near-copies, or when any single 2-second window is mostly near-copies.
"""
import argparse
import json
import os
import subprocess
import sys
for _s in (sys.stdout, sys.stderr):  # ▸ and ✓ on a cp1252 console
    getattr(_s, 'reconfigure', lambda **k: None)(encoding='utf-8', errors='replace')

import numpy as np

W, H = 64, 36
FLAT = 1.5  # grey levels: neighbours closer than this count as flat
MIN_EDGES = 6  # a frame needs this many non-flat neighbour pairs to have a layout worth comparing


def frames(path, every=0.5):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={1 / every},scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W, 3)


def dhash(img):
    g = img.astype(np.float64) @ [0.299, 0.587, 0.114]
    # 9x8 by block-averaging the 64x36 frame
    ys = np.linspace(0, H, 9).astype(int)
    xs = np.linspace(0, W, 10).astype(int)
    small = np.array([[g[ys[i]:ys[i + 1], xs[j]:xs[j + 1]].mean() for j in range(9)] for i in range(8)])
    # three states per pair of neighbouring blocks: brighter, darker, or flat. On a white UI or a plain card
    # most neighbours are flat, and a two-state hash would turn their noise into a random layout that matches
    # any other white frame; flat pairs must match flat pairs
    d = small[:, 1:] - small[:, :-1]
    return np.where(np.abs(d) < FLAT, 0, np.sign(d)).astype(np.int8).flatten()


def hist(img):
    q = (img // 32).reshape(-1, 3).astype(int)
    h = np.bincount(q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2], minlength=512).astype(np.float64)
    return h / h.sum()


def informative(img):
    g = img.astype(np.float64).mean(axis=2)
    return g.std() > 10 and g.mean() > 12


def fingerprint(path, every=0.5):
    out = []
    for i, f in enumerate(frames(path, every)):
        if informative(f):
            out.append({'t': round(i * every, 2), 'hash': ''.join({1: '1', -1: '0', 0: '='}[int(b)] for b in dhash(f)), 'hist': {str(k): round(float(v), 4) for k, v in enumerate(hist(f)) if v >= 0.001}})
    return out


def check(video, refs, every=0.5, max_hamming=10, min_hist=0.72):
    ref_hashes = []
    ref_hists = []
    labels = []
    for name, fps in refs.items():
        for fp in fps:
            ref_hashes.append(np.array([{'1': 1, '0': -1, '=': 0}[c] for c in fp['hash']], dtype=np.int8))
            h = np.zeros(512)
            for k, v in fp['hist'].items():
                h[int(k)] = v
            ref_hists.append(h)
            labels.append((name, fp['t']))
    if not labels:
        return {'frames': 0, 'near': [], 'share': 0.0}
    RH = np.array(ref_hashes)
    RC = np.array(ref_hists)
    near = []
    scored = 0
    for i, f in enumerate(frames(video, every)):
        if not informative(f):
            continue
        h = dhash(f)
        # a frame with almost no layout (one small mark on a plain ground) matches every other near-empty frame
        # and proves nothing, like a plain frame
        if np.count_nonzero(h) < MIN_EDGES:
            continue
        scored += 1
        ham = (RH != h).sum(axis=1)
        inter = np.minimum(RC, hist(f)).sum(axis=1)
        # close on layout AND palette
        hit = np.where((ham <= max_hamming) & (inter >= min_hist))[0]
        if len(hit):
            k = hit[np.argmin(ham[hit])]
            near.append({'t': round(i * every, 2), 'ref': labels[k][0], 'ref_t': labels[k][1], 'hamming': int(ham[k]), 'palette': round(float(inter[k]), 2)})
    return {'frames': scored, 'near': near, 'share': len(near) / scored if scored else 0.0}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    a1 = sub.add_parser('fingerprint')
    a1.add_argument('videos', nargs='+')
    a1.add_argument('--out', required=True)
    a1.add_argument('--names', nargs='*', help='labels to store instead of file names')
    a2 = sub.add_parser('check')
    a2.add_argument('video')
    a2.add_argument('--refs', required=True)
    a2.add_argument('--out')
    a2.add_argument('--max-share', type=float, default=0.05)
    a = ap.parse_args()

    if a.cmd == 'fingerprint':
        data = json.load(open(a.out, encoding='utf-8')) if os.path.exists(a.out) else {}
        for i, v in enumerate(a.videos):
            name = a.names[i] if a.names and i < len(a.names) else os.path.splitext(os.path.basename(v))[0]
            data[name] = fingerprint(v)
            print(f"▸ {name}: {len(data[name])} informative frames")
        json.dump(data, open(a.out, 'w', encoding='utf-8'))
        return 0

    refs = json.load(open(a.refs, encoding='utf-8'))
    res = check(a.video, refs)
    # a run of near-copies is worse than scattered coincidences
    worst = 0
    ts = [n['t'] for n in res['near']]
    for t in ts:
        worst = max(worst, sum(1 for u in ts if t <= u < t + 2))
    res['worst_2s'] = worst
    res['pass'] = res['share'] <= a.max_share and worst < 3
    if a.out:
        json.dump(res, open(a.out, 'w', encoding='utf-8'), indent=2)
    print(f"▸ originality: {len(res['near'])}/{res['frames']} frames close to a reference ({100 * res['share']:.1f}%), worst 2s window {worst}")
    for n in res['near'][:8]:
        print(f"   {n['t']:6.1f}s looks like {n['ref']} @ {n['ref_t']}s (hash distance {n['hamming']}, palette {n['palette']})")
    return 0 if res['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
