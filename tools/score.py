#!/usr/bin/env python3
"""Score and sound design generated from a film's manifest.

The edit is the score. Tempo, the energy arc, every landing, click and hit come
from build/manifest.json (written by engine/render.mjs), so picture and sound
cannot drift apart.

Instruments are synthesized, but modelled rather than beeped: a felt piano with
stretched, inharmonic partials, unison strings and a hammer; a detuned analog
pad that breathes with the arc; a sub; brushed percussion; paper, air and room
foley; a two-band convolution room; glue compression and a soft clipper.

usage: score.py build/manifest.json --out build [--music track.wav] [--lufs -14]
writes: music.wav, sfx.wav, mix.wav (48 kHz stereo, loudness-normalized)

Styles (manifest music.style):
  felt   - felt piano, pad, soft pulse. Calm, human products, study, writing.
  glass  - bell plucks over a bright pad. Clean tools, demos, precision.
  pulse  - driving minor pulse, kick and claps. Teasers, ads, energy.
"""
import argparse
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}

# Progressions: (root offset in semitones, voicing intervals). One chord per two bars.
PROGRESSIONS = {
    'felt': [(0, [0, 7, 14, 16, 23]), (9, [0, 7, 10, 14, 15]), (5, [0, 7, 11, 16, 18]), (7, [0, 5, 7, 14, 17])],  # Imaj9 vim9 IVmaj7#11 Vsus
    'glass': [(0, [0, 4, 7, 11, 14]), (5, [0, 4, 7, 11, 14]), (9, [0, 3, 7, 10, 14]), (7, [0, 5, 7, 10, 14])],
    'pulse': [(0, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]), (3, [0, 4, 7, 11, 14]), (10, [0, 4, 7, 9, 14])],
}
MAJOR_PENTA = [0, 2, 4, 7, 9]


# ------------------------------------------------------------------ basics

def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def rng(seed):
    return np.random.default_rng(seed)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def place(buf, sig, t, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into a stereo buffer at time t (seconds)."""
    i = int(round(t * SR))
    if i >= buf.shape[0] or i + len(sig) <= 0:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
    j0 = max(0, -i)
    i0 = max(0, i)
    n = min(len(sig) - j0, buf.shape[0] - i0)
    buf[i0:i0 + n] += sig[j0:j0 + n] * gain


def one_pole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x, axis=0)


def one_pole_hp(x, cutoff):
    return x - one_pole_lp(x, cutoff)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x, axis=0)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x, axis=0)


# ------------------------------------------------------------------ room

def room_ir(seconds=3.2, rt_low=1.5, rt_high=0.55, predelay=0.018, seed=1):
    """Stereo room: early reflections, then a diffuse tail whose highs die faster than its lows."""
    n = int(seconds * SR)
    r = rng(seed)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = r.standard_normal(n)
        lo = lowpass(noise, 900) * np.exp(-6.9 * t / rt_low)
        hi = highpass(noise, 900) * np.exp(-6.9 * t / rt_high)
        tail = (lo + 0.7 * hi) * np.minimum(1, t / 0.06)
        ir[:, c] = tail
        for k in range(10):  # early reflections
            d = int((0.004 + r.uniform(0.003, 0.05)) * SR)
            ir[d, c] += r.uniform(0.3, 0.8) * (1 if r.random() > 0.5 else -1)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def reverb(x, ir, wet):
    out = np.zeros_like(x)
    for c in range(2):
        out[:, c] = fftconvolve(x[:, c], ir[:, c])[: len(x)]
    return x * (1 - wet) + out * wet * 1.5


# ------------------------------------------------------------------ instruments

def felt_piano(freq, dur, vel=0.6, seed=0):
    """Felt piano: stretched partials, two detuned strings per note, felt-damped highs, a soft hammer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng(seed)
    B = 0.00035  # inharmonicity
    out = np.zeros(n)
    bright = 0.35 + 0.65 * vel
    for k in range(1, 16):
        fk = freq * k * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** (1.6 - 0.6 * bright)) * np.exp(-((k - 1) / (3 + 7 * bright)))
        tau = 2.8 / (1 + 0.35 * (k - 1)) * (220 / max(freq, 110)) ** 0.35
        for det in (-0.6, 0.6):  # unison strings beat slowly
            ph = r.uniform(0, 2 * np.pi)
            out += amp * 0.5 * np.sin(2 * np.pi * (fk + det * k * 0.15) * t + ph) * (0.7 * np.exp(-t / tau) + 0.3 * np.exp(-t / (tau * 4)))
    attack = np.minimum(1, t / 0.004)
    hammer = lowpass(r.standard_normal(min(n, int(0.03 * SR))), 1200 + 2500 * vel) * np.exp(-np.arange(min(n, int(0.03 * SR))) / (0.006 * SR)) * 0.25 * vel
    out[: len(hammer)] += hammer
    release = np.ones(n)
    rn = min(n, int(0.25 * SR))
    release[-rn:] = np.linspace(1, 0, rn) ** 2
    return lowpass(out * attack * release, 1800 + 4000 * vel) * vel


def analog_pad(freq, n, bright, seed):
    """Seven detuned saws per note, low-passed by a filter that opens with the arc (bright is per-sample 0..1)."""
    r = rng(seed)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for v in range(7):
        det = (v - 3) * 0.045
        f = freq * 2 ** (det / 12)
        ph = r.uniform(0, 1)
        saw = 2 * ((f * t + ph) % 1) - 1
        pan = (v - 3) / 3
        out[:, 0] += saw * np.cos((pan + 1) * np.pi / 4)
        out[:, 1] += saw * np.sin((pan + 1) * np.pi / 4)
    # time-varying low-pass, processed in blocks
    res = np.zeros_like(out)
    blk = 2048
    zi = None
    for i in range(0, n, blk):
        c = 280 + 2600 * float(np.mean(bright[i:i + blk])) ** 1.4
        sos = butter(2, min(c, 9000), btype='low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        res[i:i + blk], zi = sosfilt(sos, out[i:i + blk], axis=0, zi=zi)
    return res / 7


def sub(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t)
    return np.tanh(1.5 * s) * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.08)


def soft_kick(r):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    s[:200] += lowpass(r.standard_normal(200), 2000) * np.linspace(0.3, 0, 200)
    return np.tanh(1.3 * s)


def brush(r, n_sec=0.18):
    n = int(n_sec * SR)
    t = np.arange(n) / SR
    s = bandpass(r.standard_normal(n), 3000, 11000)
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.05)
    return s * env


def rim(r):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.012) + bandpass(r.standard_normal(n), 1500, 5000) * np.exp(-t / 0.006) * 0.6
    return s


def clap(r):
    n = int(0.3 * SR)
    s = bandpass(r.standard_normal(n), 900, 4500)
    env = env_exp(n, 0.07)
    for d in (0.0, 0.011, 0.022):
        env[int(d * SR):int(d * SR) + 60] += 0.6
    return s * env * 0.6


def pluck(freq, dur=0.6, bright=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / (0.12 + 0.1 * (1 - bright))) * np.minimum(1, t / 0.002)
    s = np.sin(2 * np.pi * freq * t + 0.6 * bright * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.05))
    s += 0.25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t / 0.06)
    return s * env


def bell(freq, dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, tau in ((1, 1, 1.6), (2.0, 0.35, 0.9), (3.01, 0.18, 0.5), (4.2, 0.08, 0.3)):
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    return s * np.minimum(1, t / 0.004)


# ------------------------------------------------------------------ foley

def paper_rustle(r, dur=1.2):
    """Crinkle: sparse filtered clicks in a band, over a breath of noise."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    clicks = np.zeros(n)
    dens = np.sin(np.pi * t / dur) ** 2
    idx = np.where(r.random(n) < 0.004 * dens)[0]
    clicks[idx] = r.uniform(-1, 1, len(idx))
    crinkle = bandpass(clicks, 1800, 9000) * 3
    air = bandpass(r.standard_normal(n), 600, 5000) * dens * 0.12
    return crinkle + air


def paper_tap(r, soft=True):
    """A sheet landing: a soft low thump with a papery top."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (90 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.04)
    top = bandpass(r.standard_normal(n), 1200, 7000) * np.exp(-t / (0.012 if soft else 0.02))
    return thump * 0.6 + top * (0.35 if soft else 0.6)


def flick(r):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    p = t / 0.35
    s = bandpass(r.standard_normal(n), 2000, 10000) * np.sin(np.pi * p) ** 3
    pan = np.linspace(-0.5, 0.5, n)
    return np.stack([s * np.cos((pan + 1) * np.pi / 4), s * np.sin((pan + 1) * np.pi / 4)], axis=1) * 1.4


def whoosh(dur, r):
    dur = float(np.clip(dur, 0.35, 1.4))
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = r.standard_normal(n)
    s = lowpass(noise, 700) * (1 - p) + bandpass(noise, 1200, 6000) * p
    env = np.sin(np.pi * p) ** 2
    pan = np.linspace(-0.6, 0.6, n)
    return np.stack([s * env * np.cos((pan + 1) * np.pi / 4), s * env * np.sin((pan + 1) * np.pi / 4)], axis=1)


def swell(dur, r):
    """Air that rises into a moment: band-swept noise plus a reversed-bloom shimmer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = r.standard_normal(n)
    s = lowpass(noise, 500) * (1 - p) + bandpass(noise, 1500, 8000) * p
    return s * p ** 2.4


def thud(r, soft=True):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(42 + 40 * np.exp(-t / 0.06)) / SR) * np.exp(-t / (0.35 if soft else 0.7))
    return np.tanh(boom * 1.2) + np.pad(paper_tap(r, soft), (0, n - int(0.25 * SR))) * 0.6


def clapper(r):
    """A slate's sticks meeting: two hardwood strikes a few ms apart, a short woody body, a dry crack on top."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, (delay, amp) in enumerate(((0.0, 1.0), (0.0042, 0.55))):
        d = int(delay * SR)
        tt = t[: n - d]
        body = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / tau) for f, a, tau in ((610, 0.8, 0.022), (1430, 0.55, 0.014), (2950, 0.3, 0.008)))
        crack = highpass(r.standard_normal(n - d), 1400) * np.exp(-tt / 0.006)
        out[d:] += amp * (body + 0.9 * crack)
    thump = np.sin(2 * np.pi * (95 + 80 * np.exp(-t / 0.008)) * t) * np.exp(-t / 0.05) * 0.5
    return np.tanh(1.4 * (out + thump)) * 0.9


def key_tap(r):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    click = lowpass(highpass(r.standard_normal(n), 2500), 8000) * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * r.uniform(1300, 1900) * t) * np.exp(-t / 0.006) * 0.4
    return (click + body) * r.uniform(0.55, 1.0)


def ui_click(r):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return highpass(r.standard_normal(n), 1800) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.02) * 0.6


def tick(freq):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2.76 * t)) * np.exp(-t / 0.04) * np.minimum(1, t / 0.001)


# ------------------------------------------------------------------ arc

def energy_curve(man, n):
    """Per-sample energy: the manifest's music.arc [[t, e], ...] if present, else scene energies, smoothed."""
    arc = (man.get('music') or {}).get('arc')
    x = np.arange(n) / SR
    if arc:
        ts, es = zip(*arc)
        e = np.interp(x, ts, es)
        k = int(0.08 * SR)
    else:
        e = np.zeros(n)
        for s in man['scenes']:
            if s.get('kind') == 'type' and not s.get('cut', True):
                continue
            e[int(s['start'] * SR):int(s['end'] * SR)] = s.get('energy', 0.5)
        k = int(0.6 * SR)
    kernel = np.hanning(k)
    kernel /= kernel.sum()
    return np.convolve(np.pad(e, (k // 2, k - k // 2 - 1), mode='edge'), kernel, mode='valid')


def silences(events):
    """Windows where music stops: from each 'drop' to the next 'thud' or 'hit' (or 1 beat later)."""
    out = []
    for ev in events:
        if ev['type'] == 'drop':
            nxt = next((e['t'] for e in events if e['t'] > ev['t'] and e['type'] in ('thud', 'hit')), ev['t'] + 0.7)
            out.append((ev['t'], nxt))
    return out


# ------------------------------------------------------------------ score

def compose(man):
    dur = man['duration']
    n = int(np.ceil(dur * SR)) + 1
    beat = 60.0 / man['bpm']
    style = (man.get('music') or {}).get('style') or man.get('musicStyle') or 'felt'
    prog = PROGRESSIONS.get(style, PROGRESSIONS['felt'])
    key = (man.get('music') or {}).get('key') or man.get('key') or 'D'
    root = 48 + NOTE.get(key, 2)
    e = energy_curve(man, n)
    events = man['events']
    hush = silences(events)
    resolve = next((ev['t'] for ev in events if ev['type'] == 'resolve'), None)
    end_music = resolve if resolve is not None else dur
    r = rng(11)

    def quiet(t):
        return any(a - 0.02 <= t < b for a, b in hush)

    def chord_at(t):
        return prog[int(t // (beat * 8)) % len(prog)]

    pad = np.zeros((n, 2))
    keys = np.zeros((n, 2))
    drums = np.zeros((n, 2))
    low = np.zeros((n, 2))

    # Pad: one chord per two bars, filter follows the arc.
    t0, k = 0.0, 0
    while t0 < end_music:
        off, chord = prog[k % len(prog)]
        a, b = int(t0 * SR), min(n, int(min(t0 + beat * 8, end_music) * SR) + int(0.4 * SR))
        seg = b - a
        if seg > 0:
            fade = np.minimum(1, np.minimum(np.arange(seg), seg - np.arange(seg)) / (0.4 * SR))
            for v, iv in enumerate(chord[:4]):
                pad[a:b] += analog_pad(midi_hz(root + off + iv), seg, e[a:b], seed=k * 10 + v) * fade[:, None] * 0.06
        k += 1
        t0 += beat * 8
    # duck the pad with the arc so quiet passages are really quiet
    pad *= (0.35 + 0.65 * e)[:, None]

    # Lead + rhythm on an eighth-note grid.
    step = beat / 2
    i = 0
    motif = [0, 2, 1, 3, 2, 4, 3, 1]  # chord-tone indices, a gentle rising-falling figure
    while i * step < end_music - 1e-6:
        t = i * step
        en = float(e[min(n - 1, int(t * SR))])
        off, chord = chord_at(t)
        on_beat = i % 2 == 0
        bar_pos = i % 8
        if quiet(t):
            i += 1
            continue
        if style == 'felt':
            # piano: sparse at low energy (every 2 beats), eighths when it rises
            every = 4 if en < 0.3 else 2 if en < 0.5 else 1
            if i % every == 0 and en > 0.08:
                tone = chord[motif[(i // every) % len(motif)] % len(chord)]
                f = midi_hz(root + 12 + off + tone)
                vel = 0.32 + 0.35 * en + (0.08 if on_beat else 0) + r.uniform(-0.04, 0.04)
                place(keys, felt_piano(f, 2.6, vel, seed=i), t + r.uniform(0, 0.008), gain=0.22, pan=0.25 * np.sin(i * 0.7))
            if bar_pos == 0 and en > 0.2:  # left hand: root + fifth, low
                place(keys, felt_piano(midi_hz(root - 12 + off), 3.5, 0.4 + 0.3 * en, seed=1000 + i), t, gain=0.14, pan=-0.15)
                place(keys, felt_piano(midi_hz(root - 5 + off), 3.5, 0.35 + 0.3 * en, seed=2000 + i), t + 0.02, gain=0.12, pan=-0.1)
            if on_beat and en > 0.4:
                place(low, sub(midi_hz(root - 12 + off), beat * 0.9), t, gain=0.16 * en)
            if en > 0.55:
                if bar_pos in (0, 4) or (bar_pos == 7 and en > 0.7):
                    place(drums, soft_kick(r), t, gain=0.42 * en)
                place(drums, brush(r), t + (0.012 if not on_beat else 0), gain=0.05 + (0.04 if not on_beat else 0), pan=0.3)
                if bar_pos in (2, 6) and en > 0.62:
                    place(drums, rim(r), t, gain=0.05, pan=-0.2)
        elif style == 'glass':
            if en > 0.28:
                place(keys, pluck(midi_hz(root + 24 + off + chord[i % len(chord)]), 0.6, en), t, gain=0.16 * min(1, en * 1.6), pan=0.35 if i % 2 else -0.35)
            if on_beat and en > 0.42:
                place(low, sub(midi_hz(root - 12 + off), beat * 0.9), t, gain=0.2)
            if on_beat and en > 0.62:
                place(drums, soft_kick(r), t, gain=0.5 * en)
            if not on_beat and en > 0.7:
                place(drums, brush(r, 0.06), t, gain=0.1, pan=0.25)
        else:  # pulse
            if on_beat and en > 0.3:
                place(drums, soft_kick(r), t, gain=0.62 * max(0.5, en))
            if en > 0.35:
                place(low, sub(midi_hz(root - 12 + off), step * 0.9), t, gain=0.2 * en)
            if not on_beat and en > 0.45:
                place(drums, brush(r, 0.06), t, gain=0.14, pan=-0.2)
            if on_beat and (i // 2) % 2 == 1 and en > 0.7:
                place(drums, clap(r), t, gain=0.32)
            if en > 0.5 and i % 3 != 2:
                place(keys, pluck(midi_hz(root + 24 + off + chord[(i * 2) % len(chord)]), 0.35, en), t, gain=0.12, pan=0.4 if i % 2 else -0.4)
        i += 1

    # Sidechain: the pad breathes around each kick.
    duck = np.ones(n)
    for ev_t in [k_ * step for k_ in range(int(end_music / step) + 1) if (k_ % 8) in (0, 4)]:
        a = int(ev_t * SR)
        m = min(n - a, int(0.3 * SR))
        if m > 0 and e[min(n - 1, a)] > 0.55:
            duck[a:a + m] = np.minimum(duck[a:a + m], 1 - 0.35 * np.exp(-np.arange(m) / (0.09 * SR)))
    pad *= duck[:, None]

    # Silences: the music stops dead (the room keeps ringing, because reverb is applied after).
    gate = np.ones(n)
    for a, b in hush:
        ia, ib = int(a * SR), int(b * SR)
        fall = int(0.03 * SR)
        gate[ia:ia + fall] = np.minimum(gate[ia:ia + fall], np.linspace(1, 0, len(gate[ia:ia + fall])))
        gate[ia + fall:ib] = 0
        rise = int(0.25 * SR)
        gate[ib:ib + rise] = np.minimum(gate[ib:ib + rise], np.linspace(0, 1, len(gate[ib:ib + rise])))
    for layer in (pad, low, keys, drums):
        layer *= gate[:, None]

    # Moments: landings play the scale upward, hits bloom, the resolve rings out.
    for ev in events:
        typ, t = ev['type'], ev['t']
        if typ == 'land':
            off, chord = chord_at(t)
            scale = [root + 12 + d + 12 * o for o in range(3) for d in MAJOR_PENTA]
            idx = int(round(ev.get('i', 0) / max(1, ev.get('n', 1)) * (len(scale) - 1)))
            vel = 0.3 if ev.get('soft') else 0.55
            place(keys, felt_piano(midi_hz(scale[idx]), 2.2, vel, seed=int(t * 100)), t, gain=0.16 if ev.get('soft') else 0.26, pan=(idx / len(scale) - 0.5) * 0.9)
        elif typ == 'hit':
            off, chord = chord_at(t)
            for v, iv in enumerate(chord[:4]):
                place(keys, felt_piano(midi_hz(root + off + iv), 4, 0.75, seed=v), t + v * 0.012, gain=0.2, pan=(v - 1.5) * 0.3)
        elif typ == 'glint':
            place(keys, bell(midi_hz(root + 36 + 7), 2.5), t, gain=0.05, pan=0.4)
    if resolve is not None:
        tail = dur - resolve + 1
        for v, iv in enumerate([0, 7, 16, 19, 26]):  # rolled, open voicing
            place(keys, felt_piano(midi_hz(root - 12 + iv + (12 if v else 0)), max(2.5, tail), 0.5 - 0.04 * v, seed=500 + v), resolve + v * 0.045, gain=0.24, pan=(v - 2) * 0.2)
        place(low, sub(midi_hz(root - 12), max(1.0, tail - 0.5)), resolve, gain=0.08)
        a = int(resolve * SR)
        seg = n - a
        bright = np.linspace(0.5, 0.1, seg)
        for v, iv in enumerate([0, 7, 16]):
            pad[a:] += analog_pad(midi_hz(root + iv), seg, bright, seed=900 + v) * (np.minimum(1, np.arange(seg) / (0.3 * SR)) * np.exp(-np.arange(seg) / (2.5 * SR)))[:, None] * 0.05

    room = room_ir()
    pad = highpass(pad, 140)
    keys = highpass(keys, 55)
    music = reverb(pad, room, 0.35) + reverb(keys, room, 0.32) + reverb(drums, room, 0.12) + low
    fade_n = int(0.6 * SR)
    music[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None] ** 2
    return music[: int(round(dur * SR))]


def sound_design(man):
    dur = man['duration']
    n = int(round(dur * SR))
    out = np.zeros((n, 2))
    r = rng(42)
    room = room_ir(1.4, 0.7, 0.3, seed=3)
    for ev in man['events']:
        typ, t = ev['type'], ev['t']
        if typ == 'key':
            place(out, key_tap(r), t, gain=0.12 * ev.get('gain', 1), pan=r.uniform(-0.15, 0.15))
        elif typ == 'click':
            place(out, ui_click(r), t, gain=0.22)
        elif typ == 'clap':
            place(out, clapper(r), t - 0.002, gain=0.5 * ev.get('gain', 1))
        elif typ == 'pop':
            place(out, tick(1200), t, gain=0.08)
        elif typ == 'whoosh':
            place(out, whoosh(ev.get('len', 0.6), r), t, gain=0.035 if ev.get('soft') else 0.07)
        elif typ == 'rustle':
            place(out, paper_rustle(r, ev.get('len', 1.2)), t, gain=0.09, pan=r.uniform(-0.6, 0.6))
        elif typ == 'land':
            place(out, paper_tap(r, ev.get('soft', True)), t - 0.01, gain=0.06 if ev.get('soft', True) else 0.16, pan=r.uniform(-0.3, 0.3))
        elif typ == 'swell':
            place(out, swell(ev.get('len', 2.0), r), t, gain=0.1)
        elif typ == 'thud':
            place(out, thud(r, ev.get('soft', True)), t, gain=0.22)
        elif typ == 'flip':
            place(out, flick(r), t, gain=0.08)
        elif typ == 'tick':
            place(out, tick(1600 + 200 * ev.get('i', 0)), t, gain=0.05, pan=0.2 * ev.get('i', 0) - 0.2)
        elif typ == 'cut' and ev.get('accent'):
            place(out, tick(2400), t, gain=0.03)
    # a faint room tone keeps silence from sounding like a dropout
    tone = lowpass(r.standard_normal((n, 2)), 400) * 0.004
    return reverb(out, room, 0.18) + tone


# ------------------------------------------------------------------ mastering

def glue(x, thresh_db=-18, ratio=2.0, attack=0.01, release=0.15):
    """Gentle RMS bus compressor, linked stereo."""
    level = np.sqrt(lowpass(np.mean(x ** 2, axis=1), 1 / (2 * np.pi * attack)) + 1e-12)
    db = 20 * np.log10(level)
    over = np.maximum(0, db - thresh_db)
    gain_db = -over * (1 - 1 / ratio)
    gain_db = lowpass(gain_db, 1 / (2 * np.pi * release))
    return x * (10 ** (gain_db / 20))[:, None]


def soft_clip(x, ceiling=0.95):
    return np.tanh(x / ceiling) * ceiling


def load_music(path, dur, offset=0.0):
    """Use a supplied track: decode with ffmpeg, trim from offset, fade out at the end."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(offset), '-i', path, '-t', str(dur), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    n = int(round(dur * SR))
    out = np.zeros((n, 2))
    out[: min(n, len(x))] = x[:n]
    fade_n = int(1.0 * SR)
    out[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None]
    return out


def write(path, x):
    peak = np.max(np.abs(x)) or 1
    x = x / max(1.0, peak / 0.98)
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


def loudnorm(src, dst, lufs, tp=-1.0):
    """Two-pass EBU R128 normalization."""
    first = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f'loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = json.loads(first[first.rindex('{'):first.rindex('}') + 1])
    af = (f"loudnorm=I={lufs}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    # a look-ahead limiter after the gain: sharp transients (claps, clicks) otherwise overshoot once encoded to AAC
    lim = 10 ** ((tp - 0.8) / 20)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'{af},aresample=192000,alimiter=limit={lim:.4f}:attack=1:release=40:level=disabled,aresample={SR}', '-ar', str(SR), dst], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('manifest')
    ap.add_argument('--out', default='.')
    ap.add_argument('--music', help='use this track instead of the generated score')
    ap.add_argument('--offset', type=float, default=0.0, help='seconds to skip into --music so its downbeat lands at 0')
    ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    man = json.load(open(a.manifest))
    os.makedirs(a.out, exist_ok=True)
    music = load_music(a.music, man['duration'], a.offset) * 0.8 if a.music else compose(man)
    sfx = sound_design(man)
    write(os.path.join(a.out, 'music.wav'), music)
    write(os.path.join(a.out, 'sfx.wav'), sfx)
    mix = music * 0.85 + sfx
    mix = soft_clip(glue(mix / (np.max(np.abs(mix)) or 1) * 0.9))
    raw = os.path.join(a.out, 'mix.raw.wav')
    write(raw, mix)
    loudnorm(raw, os.path.join(a.out, 'mix.wav'), a.lufs)
    os.remove(raw)
    style = (man.get('music') or {}).get('style') or man.get('musicStyle')
    print(f"▸ score: {man['duration']:.2f}s, {man['bpm']} BPM, {style} in {(man.get('music') or {}).get('key') or man.get('key')}, "
          f"{len(man['events'])} cues, mastered to {a.lufs} LUFS -> {a.out}/mix.wav")


if __name__ == '__main__':
    main()
