#!/usr/bin/env python3
"""Dayline's score, composed for this cut: 120 BPM in D, 58 beats.

The film is one take that gets fuller as the day does: a pad and a closed pluck
under the first line, the pluck opening when the dot drops into the app, the
groove arriving with the press, a breath for "Plans change.", the groove back
for the move, its fullest for the week, then one low hit under the name with a
single bell for the dot, and the chord rings out.

The dot has the only bell in the film, twice: when it ends the first line, and
when it lands in the name. Landings in the app are soft ticks, not notes.

usage: score.py build/manifest.json --out build   (engine/render.mjs runs it)
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../tools'))
from synth import Song  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('manifest')
ap.add_argument('--out', default='build')
ap.add_argument('--lufs', type=float, default=-14.0)
ap.add_argument('--stems', action='store_true')
a, _ = ap.parse_known_args()
man = json.load(open(a.manifest))
BPM = man['bpm']
BEATS = man['duration'] / (60 / BPM)

s = Song(bpm=BPM, beats=BEATS, tail=0.0)
s.bus('pad', verb=0.5, duck=0.45, gain=0.9)
s.bus('pluck', verb=0.3, delay=0.28, duck=0.3, gain=0.85, hp=180)
s.bus('arp2', verb=0.35, delay=0.3, duck=0.3, gain=0.6, hp=300)
s.bus('bell', verb=0.6, delay=0.25, gain=0.9)
s.bus('sub', duck=0.7, gain=1.0)
s.bus('bass', duck=0.5, gain=0.7, hp=60)
s.bus('kick', gain=0.95)
s.bus('clap', verb=0.25, gain=0.75)
s.bus('hat', verb=0.08, gain=0.75)
s.bus('fx', verb=0.4, gain=0.8)
s.bus('foley', verb=0.12, gain=0.9)

# ------------------------------------------------------------------ harmony: one chord per bar
# pad voicings (rootless, mid register) and bass roots, in D major
CH = {
    'D': ([57, 61, 64, 66, 69], 38),      # Dmaj9
    'Bm': ([54, 57, 61, 62, 66], 35),     # Bm9
    'G': ([54, 57, 59, 62, 66], 31),      # Gmaj9
    'A': ([52, 57, 59, 62, 64], 33),      # A sus
    'Em': ([54, 55, 59, 62, 66], 40),     # Em9
    'D69': ([57, 59, 62, 64, 66, 69], 38),
}
# bar -> chord (a bar is 4 beats)
BARS = ['D', 'D', 'Bm', 'G', 'D', 'Bm', 'G', 'Em', 'G', 'A', 'D', 'Bm', 'D69', 'D69', 'D69']


def chord(beat):
    return CH[BARS[min(int(beat // 4), len(BARS) - 1)]]


# ------------------------------------------------------------------ the pad: under everything until the name
for bar in range(12):
    notes, _ = CH[BARS[bar]]
    s.pad(notes, at=bar * 4, beats=4, gain=0.42 if bar < 2 else 0.5, cutoff=900 if bar < 2 else 1300, open_to=1500 if bar < 2 else 2200, attack=1.2 if bar == 0 else 0.08, release=0.9)

# ------------------------------------------------------------------ the pluck: closed, opening with the day
ORDER = [0, 2, 1, 3, 2, 4, 1, 3]


def arp(b0, b1, step=0.5, cutoff=900, env=2500, gain=0.36, octave=12, bus='pluck'):
    b = b0
    k = 0
    while b < b1 - 1e-6:
        notes, _ = chord(b)
        n = sorted(notes)[ORDER[k % 8] % len(notes)] + octave
        s.pluck(n, at=b, gain=gain * (1.0 if k % 2 == 0 else 0.78), cutoff=cutoff, env_amt=env, p=(-0.35 if k % 2 else 0.35), bus=bus)
        b += step
        k += 1


arp(1, 8, step=0.5, cutoff=500, env=1200, gain=0.28)          # closed, under the first line
arp(8, 14, step=0.5, cutoff=800, env=2200, gain=0.32)         # the app opens
arp(16, 24, step=0.25, cutoff=1000, env=3200, gain=0.34)      # the day is placed: sixteenths
arp(25, 28, step=1.0, cutoff=600, env=1500, gain=0.26)        # "Plans change.": a breath
arp(28, 38, step=0.25, cutoff=1000, env=3000, gain=0.32)
arp(40, 48, step=0.25, cutoff=1300, env=4200, gain=0.36)      # the week: fullest
arp(40, 48, step=0.5, cutoff=1600, env=3000, gain=0.2, octave=24, bus='arp2')

# ------------------------------------------------------------------ low end and drums
def groove(b0, b1, clap=True, hats=True, open_hats=False, bass=True):
    b = b0
    while b < b1 - 1e-6:
        _, root = chord(b)
        s.kick(at=b, gain=0.8)
        s.sub(root, at=b, beats=1.0, gain=0.62)
        if bass:
            s.bass(root + 12, at=b + 0.5, beats=0.45, gain=0.32)
        if clap and int(round(b)) % 2 == 1:
            s.clap(at=b, gain=0.42)
        if hats:
            s.hat(at=b + 0.5, gain=0.2, open_=open_hats)
            s.hat(at=b + 0.25, gain=0.07)
            s.hat(at=b + 0.75, gain=0.09)
        b += 1


# the press: one low drop on beat 14, a beat of air, then the groove from the bar
s.impact(at=14, gain=0.35)
s.sub(38, at=14, beats=2, gain=0.5, glide_from=50)
groove(16, 24, clap=True, hats=True)
# "Plans change.": everything drops out but the pad and a held sub
s.impact(at=24, gain=0.45)
s.sub(31, at=24, beats=4, gain=0.55)
s.riser(at=26, beats=2, gain=0.35)
groove(28, 30, clap=False, hats=True, bass=False)
groove(30, 38, clap=True, hats=True)
s.swell(at=31, beats=2, gain=0.3)       # into the drop
# a fill into the week: claps on sixteenths, rising
for k in range(8):
    s.clap(at=38 + k * 0.25, gain=0.12 + 0.03 * k)
s.sub(33, at=38, beats=2, gain=0.55)
s.riser(at=38, beats=2, gain=0.3)
groove(40, 48, clap=True, hats=True, open_hats=True)
for b in range(40, 48):
    s.shaker(at=b + 0.25, gain=0.12)
    s.shaker(at=b + 0.75, gain=0.12)

# ------------------------------------------------------------------ the name: one low hit, a bell for the dot, the chord rings
s.impact(at=48, gain=0.7)
s.kick(at=48, gain=0.6)
s.sub(38, at=48, beats=6, gain=0.55)
s.pad(CH['D69'][0], at=48, beats=8, gain=0.55, cutoff=2400, open_to=900, attack=0.02, release=3.0)
s.swell(at=46, beats=2, gain=0.35)
for k, n in enumerate([81, 78, 76, 73, 69]):
    s.pluck(n, at=48 + k * 0.75, gain=0.26 * (0.85 ** k), cutoff=1400, env_amt=2400, p=0.3 * (-1) ** k)

# ------------------------------------------------------------------ foley, from the picture's own cues
for e in man['events']:
    t, kind = e['t'], e['type']
    if kind == 'click':
        s.click(t, gain=0.5)
    elif kind == 'land':
        s.tick(t, gain=0.22 if e.get('n') else 0.16, pitch=1.0 + 0.04 * (e.get('i', 0) % 5))
    elif kind == 'tick':
        s.tick(t, gain=0.12 if e.get('soft') else 0.18, pitch=1.1 + 0.03 * (e.get('i', 0) % 4))
    elif kind == 'lift':
        s.whoosh(t, 0.75, gain=0.06)
    elif kind == 'drop':
        s.tick(t, gain=0.3, pitch=0.8)
    elif kind == 'whoosh':
        s.whoosh(t, e.get('len', 0.8) + 0.2, gain=0.3)
    elif kind == 'dot':
        s.bell(81, at=t / s.beat, gain=0.5)
        s.bell(93, at=t / s.beat, gain=0.12, p=0.3)
    elif kind == 'open':
        s.swell(at=t / s.beat - 1, beats=1, gain=0.25)

os.makedirs(a.out, exist_ok=True)
stems = None
if a.stems:
    stems = os.path.join(a.out, 'stems')
    os.makedirs(stems, exist_ok=True)
# the mix, by numbers: each bus's level while it plays (dBFS RMS before the master)
LEVELS = {'kick': -15, 'sub': -19, 'bass': -26, 'pad': -23, 'pluck': -19, 'arp2': -29, 'clap': -24, 'hat': -30,
          'bell': -22, 'fx': -25, 'foley': -27}
lufs = s.master(os.path.join(a.out, 'mix.wav'), lufs=a.lufs, stems=stems, levels=LEVELS)
print(f'▸ score: Dayline, {BPM} BPM in D, {man["duration"]:.1f}s, {lufs:.1f} LUFS -> {a.out}/mix.wav')
