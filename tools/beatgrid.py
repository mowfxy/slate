#!/usr/bin/env python3
"""Beat grid for a supplied music track, so the edit can be written in beats.

Prints the tempo, the first strong beat, and the render flags to use. With
--json, writes the full beat list. Needs librosa.

usage: beatgrid.py track.mp3 [--json beats.json]
"""
import argparse
import json
import sys
for _s in (sys.stdout, sys.stderr):  # ▸ and ✓ on a cp1252 console
    getattr(_s, 'reconfigure', lambda **k: None)(encoding='utf-8', errors='replace')

import numpy as np


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('track')
    ap.add_argument('--json')
    a = ap.parse_args()
    try:
        import librosa
    except ImportError:
        sys.exit('beatgrid needs librosa: python3 -m pip install librosa')
    y, sr = librosa.load(a.track, sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(frames, sr=sr)
    strength = librosa.onset.onset_strength(y=y, sr=sr)
    # the downbeat: of the first eight beats, the strongest of each candidate phase in a 4/4 bar
    s = strength[frames] if len(frames) else np.array([0])
    phase = int(np.argmax([s[p::4].mean() if len(s[p::4]) else 0 for p in range(4)])) if len(s) >= 8 else 0
    offset = float(beats[phase]) if len(beats) > phase else 0.0
    bpm = round(tempo, 2)
    print(f"tempo {bpm} BPM · {len(beats)} beats · first downbeat at {offset:.3f}s · {len(y) / sr:.1f}s long")
    print(f"use film({{bpm: {bpm}}}) and render with: --music {a.track} --offset {offset:.3f}")
    if a.json:
        json.dump({'bpm': bpm, 'offset': offset, 'beats': beats.tolist()}, open(a.json, 'w', encoding='utf-8'), indent=2)


if __name__ == '__main__':
    sys.exit(main())
