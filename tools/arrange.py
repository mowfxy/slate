"""Reference-grade scores: arranged for real sampled instruments, produced like modern launch-film music.

The bar is set by measured reference films (skills/sound-design/references/reference-sound.md):
a real low end (a sub that carries 10-60% of the energy), sampled instruments rather than toy synths,
a rhythm that locks to the cut, sidechained pads, mono lows, a wide top, mastered around -13 LUFS.

Each style is an arrangement, not a preset. It reads the film's energy arc (music.arc) to decide which
parts play and how hard, and the film's cues for the moments that need a note.

  groove  - drum machine, 808 sub, electric-piano stabs, mallet runs. Product demos and feature launches. 84-100 BPM.
  pluck   - harp and celesta arpeggios over a sub drone and a string section that swells. Teasers, big reveals. 120-140 BPM.
  cinema  - strings, choir and horns that swell, celli pulsing, deep drums on the hits. Brand films, stories. 70-100 BPM.
  bright  - piano pulse, strings, bass and a light kit in a major key. Friendly product walkthroughs. 92-106 BPM.
"""
import numpy as np

import sampler as S
from score import (SR, NOTE, MAJOR_PENTA, midi_hz, rng, place, lowpass, highpass, bandpass, room_ir, reverb, energy_curve, silences)

STYLES = ('groove', 'pluck', 'cinema', 'bright')

# one chord per bar (4 beats); (root offset, chord intervals from that root)
PROG = {
    'groove': [(9, [0, 3, 7, 10, 14]), (5, [0, 4, 7, 11, 14]), (0, [0, 4, 7, 11, 14]), (7, [0, 4, 7, 10, 14])],    # vi9 IVmaj9 Imaj9 V9
    'pluck': [(0, [0, 4, 7, 11, 14]), (7, [0, 4, 7, 14, 16]), (9, [0, 3, 7, 10, 14]), (5, [0, 4, 7, 11, 14])],     # I V vi IV, open
    'cinema': [(9, [0, 3, 7, 12, 15]), (5, [0, 4, 7, 12, 16]), (0, [0, 4, 7, 12, 14]), (7, [0, 5, 7, 12, 14])],    # vi IV I Vsus
    'bright': [(0, [0, 4, 7, 12, 16]), (7, [0, 4, 7, 12, 14]), (9, [0, 3, 7, 12, 15]), (5, [0, 4, 7, 12, 14])],    # I V vi IV
}
# RMS (dBFS) of the tonal parts, the drums and the sub while each plays, matched to the references' band balance
BALANCE = {'groove': (-17, -19, -23), 'pluck': (-17, -26, -22), 'cinema': (-16, -24, -25), 'bright': (-17, -22, -25)}
LEAD = {'groove': 'vibes', 'pluck': 'celesta', 'cinema': 'harp', 'bright': 'glock'}


# ------------------------------------------------------------------ synthesized parts the samples can't do well

def kick(r, punch=1.0):
    """A modern kick: a pitched sine thump with a click, saturated so it reads on phone speakers."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.035) * punch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * (np.exp(-t / 0.28))
    click = highpass(r.standard_normal(n), 2500) * np.exp(-t / 0.002) * 0.25
    return np.tanh(1.6 * (body + click)) * 0.9


def sub(freq, dur, slide_from=None, drive=1.6):
    """An 808-style sub: a sine that can slide into its note, driven a little so its harmonics carry on small speakers."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = np.full(n, freq)
    if slide_from:
        f = freq + (slide_from - freq) * np.exp(-t / 0.05)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / 0.006) * np.minimum(1, (dur - t) / 0.05) * (0.55 + 0.45 * np.exp(-t / 0.5))
    return np.tanh(drive * s) / np.tanh(drive) * env


def riser(dur, r):
    """Noise that climbs into a moment: filtered noise sweeping up, with a rising tone underneath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = r.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        c = 400 + 9000 * p[i] ** 2
        out[i:i + blk] = bandpass(noise[i:i + blk], c * 0.6, min(c * 1.4, 20000))
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * p)) / SR) * 0.15
    return (out * 0.5 + tone) * p ** 2.2


def boom(r):
    """A sub drop for big moments: a long falling sine and a dark thump."""
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * np.cumsum(30 + 50 * np.exp(-t / 0.3)) / SR) * np.exp(-t / 0.9)
    thump = lowpass(r.standard_normal(n), 180) * np.exp(-t / 0.08) * 0.6
    return np.tanh(1.3 * (s + thump))


# ------------------------------------------------------------------ helpers

def chord_pitches(root, off, ivs, lo, hi):
    return sorted({root + off + iv + 12 * o for iv in ivs for o in range(-4, 5) if lo <= root + off + iv + 12 * o <= hi})


def voiced(prev, targets, k):
    """Pick k chord tones close to the previous voicing, so chords move smoothly instead of jumping."""
    out = []
    for p in (prev or targets[:k]):
        c = min((q for q in targets if q not in out), key=lambda q: abs(q - p), default=None)
        if c is not None:
            out.append(c)
    return sorted(out[:k])


def duck(n, times, depth=0.5, release=0.16):
    """Sidechain: everything ducks under the kick and breathes back."""
    g = np.ones(n)
    m = int(0.45 * SR)
    curve = 1 - depth * np.exp(-np.arange(m) / (release * SR))
    for t in times:
        a = int(t * SR)
        if 0 <= a < n:
            k = min(m, n - a)
            g[a:a + k] = np.minimum(g[a:a + k], curve[:k])
    return g


def mono_low(x, f=140):
    """Below f the mix is mono (a club and a phone speaker both need that); above it stays wide."""
    lo = lowpass(x, f, 4)
    mid = lo.mean(axis=1, keepdims=True)
    return x - lo + np.repeat(mid, 2, axis=1)


def width(x, amount=1.25):
    m = (x[:, 0] + x[:, 1]) / 2
    s = (x[:, 0] - x[:, 1]) / 2 * amount
    return np.stack([m + s, m - s], axis=1)


# ------------------------------------------------------------------ the arranger

def arrange(man, style):
    dur = man['duration']
    n = int(np.ceil(dur * SR)) + 1
    beat = 60.0 / man['bpm']
    bar = beat * 4
    m = man.get('music') or {}
    root = 48 + NOTE.get(m.get('key') or 'D', 2)
    prog = PROG[style]
    e = energy_curve(man, n)
    events = man['events']
    hush = silences(events)
    resolve = next((ev['t'] for ev in events if ev['type'] == 'resolve'), None)
    ending = m.get('end') or ('ring' if resolve is not None else 'fade')
    if resolve is None and ending != 'fade':
        ending = 'fade'
    stop = dur if ending == 'fade' else resolve
    r = rng(7)
    E = lambda t: float(e[min(n - 1, max(0, int(t * SR)))])
    quiet = lambda t: any(a - 0.02 <= t < b for a, b in hush) or t >= stop - 1e-6
    chord = lambda t: prog[int(t // bar) % len(prog)]
    swing = float(m.get('swing', 0.54 if style == 'groove' else 0.5))
    sw = lambda i8: (i8 // 2) * beat + (swing * beat if i8 % 2 else 0)  # time of the i-th eighth inside a bar

    parts = {}   # instrument -> notes
    cc = {}      # instrument -> expression curve
    def add(inst, t, d, p, v):
        if t < stop - 1e-6 and not quiet(t):
            parts.setdefault(inst, []).append((t, min(d, max(0.05, stop + 0.4 - t)), p, v))
    kicks = []
    lows = np.zeros((n, 2))
    perc = np.zeros((n, 2))

    nbars = int(np.ceil(stop / bar)) + 1
    voicing = None
    for b in range(nbars):
        t0 = b * bar
        off, ivs = chord(t0)
        en = E(t0 + 0.01)
        targets = chord_pitches(root, off, ivs, root + 2, root + 22)
        voicing = voiced(voicing, targets, 4)

        if style == 'groove':
            if en > 0.06:  # pad: a quiet bed under everything, sidechained later
                for p in voicing:
                    add('warm pad', t0, bar, p, 34 + 30 * en)
            if en > 0.18:  # electric piano: whole-bar chords when calm, off-beat stabs when it moves
                if en < 0.45:
                    for p in voicing:
                        add('ep', t0, bar * 0.95, p + 12, 48 + 30 * en)
                else:
                    for k8 in (1, 4, 6) if b % 2 == 0 else (1, 3, 6):
                        for p in voicing:
                            add('ep', t0 + sw(k8), beat * 0.42, p + 12, 52 + 34 * en + (8 if k8 == 1 else 0))
            for k8 in range(8):
                t = t0 + sw(k8)
                if quiet(t):
                    continue
                en8 = E(t)
                if en8 > 0.3 and k8 in (0, 3, 4) or (en8 > 0.7 and k8 == 7 and b % 2):
                    kicks.append(t)
                if en8 > 0.4 and k8 in (2, 6):
                    add('tr808', t, 0.2, S.CLAP, 92 + 20 * en8)
                if en8 > 0.22:
                    add('tr808', t, 0.1, S.HAT, (58 if k8 % 2 else 82) + 30 * en8)
                    if en8 > 0.62:  # sixteenths
                        add('tr808', t + beat / 4, 0.08, S.HAT, 46 + 26 * en8)
                if en8 > 0.5 and k8 == 7 and b % 2 == 1:
                    add('tr808', t, 0.3, S.OPEN_HAT, 70)
            if en > 0.28:  # 808 on the kick pattern, following the chord root
                rt = root - 24 + off if off <= 7 else root - 36 + off
                for k8, d in ((0, 1.4), (3, 0.5), (4, 1.4)):
                    t = t0 + sw(k8)
                    if not quiet(t):
                        place(lows, sub(midi_hz(rt), beat * d, slide_from=midi_hz(rt + 12) if k8 == 0 and b % 4 == 0 else None), t, gain=0.5)
            if en > 0.55:  # a mallet run that climbs in sixteenths every other bar
                if b % 2 == 1:
                    run = chord_pitches(root, off, ivs, root + 14, root + 34)[:6]
                    for j, p in enumerate(run):
                        add(LEAD[style], t0 + beat * 2 + j * beat / 4, beat * 0.5, p, 60 + 8 * j)

        elif style == 'pluck':
            rt = root - 24 + off if off <= 5 else root - 36 + off
            if en > 0.04:
                place(lows, sub(midi_hz(rt), bar, drive=1.3), t0, gain=0.42 + 0.25 * en)
            if en > 0.1:
                for p in voicing:
                    add('strings', t0, bar, p, 40 + 60 * en)
                add('celli', t0, bar, rt + 12, 50 + 50 * en)
            arp = chord_pitches(root, off, ivs, root + 12, root + 36)
            pattern = [0, 2, 1, 3, 2, 4, 3, 5]
            step = beat / 4 if en > 0.62 else beat / 2
            if en > 0.12:
                for j in range(int(round(bar / step))):
                    t = t0 + j * step
                    p = arp[pattern[j % len(pattern)] % len(arp)]
                    v = 54 + 44 * en + (10 if j % 4 == 0 else 0)
                    add('harp', t, step * 2, p, v)
                    if en > 0.35:
                        add('celesta', t, step, p + 12, v - 18)
            if en > 0.5 and b % 2 == 0:
                add('timpani', t0, 1.0, rt + 24, 70 + 40 * en)
            if en > 0.72:
                for k in range(4):
                    kicks.append(t0 + k * beat)
                for k in range(16):
                    add('drums', t0 + k * beat / 4, 0.05, S.SHAKER, 50 + (20 if k % 4 == 2 else 0))

        elif style == 'cinema':
            rt = root - 24 + off if off <= 5 else root - 36 + off
            if en > 0.04:
                for p in voicing:
                    add('strings', t0, bar, p, 36 + 66 * en)
                add('basses', t0, bar, rt + 12, 46 + 60 * en)
                place(lows, sub(midi_hz(rt), bar, drive=1.1), t0, gain=0.25 + 0.3 * en)
            if en > 0.3:
                for p in voicing[1:]:
                    add('oohs', t0, bar, p, 30 + 60 * en)
            if en > 0.45:  # celli pulse in eighths
                for k in range(8):
                    add('celli', t0 + k * beat / 2, beat * 0.45, rt + 12, 56 + 40 * en + (12 if k % 2 == 0 else 0))
            if en > 0.62:
                for p in voicing[:3]:
                    add('horns', t0, bar, p - 12, 50 + 50 * en)
                add('orchestra kit', t0, 1.5, 35, 100)  # concert bass drum
            if en > 0.78:
                add('orchestra kit', t0 + beat * 2.5, 1.0, 35, 90)

        elif style == 'bright':
            rt = root - 12 + off if off <= 5 else root - 24 + off
            if en > 0.06:
                for p in voicing:
                    add('strings', t0, bar, p, 30 + 50 * en)
            if en > 0.12:  # piano: chords pulsing in eighths, a bass note on 1
                add('piano', t0, bar, rt, 60 + 30 * en)
                for k8 in range(8):
                    if en < 0.35 and k8 % 2:
                        continue
                    for p in voicing[1:]:
                        add('piano', t0 + sw(k8), beat * 0.45, p + 12, 44 + 36 * en + (10 if k8 % 2 == 0 else 0))
            if en > 0.35:
                add('fingered bass', t0, beat * 1.5, rt, 80)
                add('fingered bass', t0 + beat * 2, beat * 1.5, rt + 7 if off != 7 else rt + 5, 72)
            if en > 0.5:
                for k8 in range(8):
                    t = t0 + sw(k8)
                    if k8 in (0, 4):
                        kicks.append(t)
                    if k8 in (2, 6):
                        add('drums', t, 0.2, S.SNARE, 70 + 30 * en)
                    add('drums', t, 0.1, S.HAT, 50 + 30 * en + (12 if k8 % 2 == 0 else 0))

    # the film's own moments, on the style's lead instrument
    scale = [root + 12 + d + 12 * o for o in range(3) for d in MAJOR_PENTA]
    for ev in events:
        t, typ = ev['t'], ev['type']
        if typ == 'land':
            idx = int(round(ev.get('i', 0) / max(1, ev.get('n', 1)) * (len(scale) - 1)))
            add(LEAD[style], t, 1.2, scale[idx] + 12, 62 if ev.get('soft') else 88)
        elif typ == 'hit':
            off, ivs = chord(t)
            for p in chord_pitches(root, off, ivs, root - 12, root + 19)[:5]:
                add('piano', t, 3.0, p, 96)
                add('strings', t, 3.0, p + 12, 90)
            place(perc, boom(r), t, gain=0.5)
        elif typ == 'swell':
            L = ev.get('len', 2.0)
            place(perc, riser(L, r), t, gain=0.22)

    # the ending, on real instruments
    if ending == 'ring':
        off, ivs = (0, [0, 7, 16, 19, 26])
        tail = dur - resolve + 0.5
        for v, iv in enumerate(ivs):
            parts.setdefault('piano', []).append((resolve + v * 0.03, tail, root - 12 + iv + (12 if v else 0), 78 - 6 * v))
            parts.setdefault('strings', []).append((resolve, tail, root + iv, 62))
        place(lows, sub(midi_hz(root - 24), min(tail, 3.5), drive=1.2), resolve, gain=0.45)
        place(perc, boom(r), resolve, gain=0.3)
    elif ending == 'button':
        parts.setdefault('piano', []).append((resolve, 1.2, root - 12, 100))
        parts.setdefault('piano', []).append((resolve, 1.2, root, 100))
        parts.setdefault(LEAD[style], []).append((resolve, 1.2, root + 24, 100))
        place(lows, sub(midi_hz(root - 24), 0.8), resolve, gain=0.5)
        kicks.append(resolve)

    # render every sampled part
    G = {'warm pad': 0.5, 'ep': 0.9, 'tr808': 1.0, 'vibes': 0.8, 'strings': 0.9, 'celli': 0.8, 'harp': 1.0, 'celesta': 0.5,
         'timpani': 0.9, 'drums': 0.8, 'basses': 0.8, 'oohs': 0.55, 'horns': 0.6, 'orchestra kit': 1.0, 'piano': 0.9,
         'fingered bass': 0.9, 'glock': 0.45}
    stems = {k: S.render(v, k, dur + 0.01, G.get(k, 0.8)) for k, v in parts.items()}
    for k in stems:
        stems[k] = stems[k][:n] if len(stems[k]) >= n else np.vstack([stems[k], np.zeros((n - len(stems[k]), 2))])
    for t in kicks:
        if not quiet(t):
            place(perc, kick(r), t, gain=0.85)

    side = duck(n, [t for t in kicks if not quiet(t)], depth=0.55 if style == 'groove' else 0.35)
    tonal = np.zeros((n, 2))
    drums = perc.copy()
    for k, x in stems.items():
        if k in ('tr808', 'drums', 'orchestra kit', 'timpani'):
            drums += x
        else:
            tonal += highpass(x, 90 if k not in ('celli', 'basses', 'fingered bass') else 35) * (side[:, None] if k in ('warm pad', 'strings', 'oohs', 'ep') else 1)
    lows *= side[:, None] ** 0.5 if style != 'groove' else 1

    # silences cut everything, the room keeps ringing
    gate = np.ones(n)
    for a, b in hush:
        ia, ib = int(a * SR), min(n, int(b * SR))
        gate[ia:ia + int(0.02 * SR)] = np.linspace(1, 0, len(gate[ia:ia + int(0.02 * SR)]))
        gate[ia + int(0.02 * SR):ib] = 0
    if ending in ('button', 'cut'):
        ia = int(resolve * SR) + (int(1.0 * SR) if ending == 'button' else 0)
        f = int(0.04 * SR)
        gate[ia:ia + f] = np.minimum(gate[ia:ia + f], np.linspace(1, 0, len(gate[ia:ia + f])))
        gate[ia + f:] = 0

    # balance the three groups to the levels the references sit at (RMS while each group is playing)
    def level(x, db):
        act = np.abs(x).max(axis=1) > 1e-3
        if act.sum() < SR * 0.2:
            return x
        rms = np.sqrt((x[act] ** 2).mean())
        return x * (10 ** (db / 20) / max(rms, 1e-9))
    tonal_db, drum_db, low_db = BALANCE[style]
    tonal, drums, lows = level(tonal, tonal_db), level(drums, drum_db), level(lows, low_db)

    room = room_ir(3.6 if style in ('cinema', 'pluck') else 2.2, 2.0 if style == 'cinema' else 1.4, 0.6, seed=4)
    wet = {'groove': 0.18, 'pluck': 0.3, 'cinema': 0.38, 'bright': 0.22}[style]
    mix = reverb(width(tonal * gate[:, None], 1.1 if style == 'groove' else 0.9), room, wet) + reverb(drums * gate[:, None], room, 0.08) + lows * gate[:, None]
    mix = mono_low(mix)
    # presence and air: sampled instruments come out of the SoundFont dull next to produced music
    air = {'groove': 1.2, 'pluck': 1.0, 'cinema': 0.8, 'bright': 1.0}[style]
    mix = mix + air * highpass(mix, 2800, 2) + 0.5 * air * highpass(mix, 7000, 2)
    if ending == 'fade':
        fn = min(n - 1, int(float(m.get('fadeLen', 3.0)) * SR))
        mix[-fn:] *= np.linspace(1, 0, fn)[:, None] ** 1.5
    else:
        fn = int(0.5 * SR)
        mix[-fn:] *= np.linspace(1, 0, fn)[:, None] ** 2
    return mix[: int(round(dur * SR))]
