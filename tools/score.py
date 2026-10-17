#!/usr/bin/env python3
"""Score and sound design generated from a Slate timeline.

The edit is the score: tempo, sections, risers, hits and every UI sound come
from build/timeline.json, so picture and sound cannot drift apart.

usage: score.py build/timeline.json --out build [--music track.wav] [--lufs -14]
writes: music.wav, sfx.wav, mix.wav (48 kHz stereo, loudness-normalized)
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, lfilter

SR = 48000
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}

# Progressions as (root offset in semitones, chord intervals). One chord per two bars.
STYLES = {
    # airy, major-seventh glass: product demos, calm confidence
    'glass': [(0, [0, 4, 7, 11, 14]), (5, [0, 4, 7, 11, 14]), (9, [0, 3, 7, 10, 14]), (7, [0, 5, 7, 10, 14])],
    # driving minor pulse: teasers and ads
    'pulse': [(0, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]), (3, [0, 4, 7, 11, 14]), (10, [0, 4, 7, 9, 14])],
}


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
    return lfilter([1 - a], [1, -a], x)


def one_pole_hp(x, cutoff):
    return x - one_pole_lp(x, cutoff)


def reverb_ir(seconds=2.4, decay=0.55, seed=1):
    n = int(seconds * SR)
    r = rng(seed)
    t = np.arange(n) / SR
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], axis=1) * np.exp(-t / decay)[:, None]
    ir[:, 0] = one_pole_lp(ir[:, 0], 6000)
    ir[:, 1] = one_pole_lp(ir[:, 1], 5500)
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def apply_reverb(x, ir, wet):
    out = np.zeros_like(x)
    for c in range(2):
        out[:, c] = fftconvolve(x[:, c], ir[:, c])[: len(x)]
    return x * (1 - wet) + out * wet * 1.6


def energy_curve(tl, n):
    """Per-sample energy from scene energies, smoothed so sections swell rather than switch."""
    e = np.zeros(n)
    for s in tl['scenes']:
        a, b = int(s['start'] * SR), int(s['end'] * SR)
        e[a:b] = s['energy']
    k = int(0.6 * SR)
    kernel = np.hanning(k)
    kernel /= kernel.sum()
    return np.convolve(np.pad(e, (k // 2, k - k // 2 - 1), mode='edge'), kernel, mode='valid')


# ---------------------------------------------------------------- instruments

def pad_voice(freq, n, bright, seed):
    """Detuned additive saw; brightness (per-sample, 0..1) opens the harmonics."""
    r = rng(seed)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c, det in enumerate((-0.07, 0.07)):
        f = freq * 2 ** (det / 12)
        ph = r.uniform(0, 2 * np.pi)
        for h in range(1, 11):
            if f * h > 12000:
                break
            roll = np.exp(-(h - 1) / (0.8 + 5.5 * bright))
            out[:, c] += np.sin(2 * np.pi * f * h * t + ph * h) * roll / h
    return out


def pluck(freq, dur=0.5, bright=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / (0.12 + 0.1 * (1 - bright))) * np.minimum(1, t / 0.002)
    s = np.sin(2 * np.pi * freq * t + 0.6 * bright * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.05))
    s += 0.25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t / 0.06)
    return s * env


def kick(n_sec=0.45):
    n = int(n_sec * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16)
    s[:96] += one_pole_lp(rng(3).standard_normal(96), 3000) * 0.25 * np.linspace(1, 0, 96)
    return one_pole_lp(np.tanh(s * 1.6), 5000)


def hat(seed, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    s = one_pole_hp(rng(seed).standard_normal(n), 7000)
    return s * env_exp(n, 0.06 if open_ else 0.012)


def clap(seed):
    n = int(0.3 * SR)
    s = rng(seed).standard_normal(n)
    s = one_pole_hp(one_pole_lp(s, 4000), 900)
    env = env_exp(n, 0.08)
    for d in (0.0, 0.011, 0.022):
        env[int(d * SR):int(d * SR) + 60] += 0.6
    return s * env * 0.6


def bass_note(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(4 * np.pi * freq * t)
    return s * np.minimum(1, t / 0.01) * np.exp(-t / (dur * 0.9))


def riser(dur, seed=5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = rng(seed).standard_normal(n)
    # sweep a resonant-ish band upward by mixing progressively brighter filters
    lo = one_pole_lp(noise, 600)
    hi = one_pole_hp(noise, 2500)
    s = lo * (1 - p) + hi * p
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * p)) / SR) * 0.15
    return (s * 0.5 + tone) * p ** 2.2


def impact(seed=9):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crack = one_pole_lp(rng(seed).standard_normal(n), 3500) * np.exp(-t / 0.09)
    return np.tanh(boom * 1.4) * 0.9 + crack * 0.35


def bell(freq, dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, tau in ((1, 1, 1.6), (2.0, 0.35, 0.9), (3.01, 0.18, 0.5), (4.2, 0.08, 0.3)):
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    return s * np.minimum(1, t / 0.004)


# ------------------------------------------------------------------ sound fx

def sfx_key(r):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    click = one_pole_lp(one_pole_hp(r.standard_normal(n), 2500), 8000) * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * r.uniform(1300, 1900) * t) * np.exp(-t / 0.006) * 0.4
    return (click + body) * r.uniform(0.55, 1.0)


def sfx_click(r):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    a = one_pole_hp(r.standard_normal(n), 1800) * np.exp(-t / 0.006)
    thump = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.02) * 0.6
    return a + thump


def sfx_pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 520 + 520 * (1 - np.exp(-t / 0.02))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)


def sfx_whoosh(dur, r):
    dur = float(np.clip(dur, 0.35, 1.2))
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = r.standard_normal(n)
    s = one_pole_lp(noise, 900) * (1 - p) + one_pole_lp(one_pole_lp(one_pole_hp(noise, 1200), 4500), 4500) * p
    env = np.sin(np.pi * p) ** 2
    pan = np.linspace(-0.6, 0.6, n)
    l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([s * env * l, s * env * rr], axis=1) * 1.4


def sfx_tick(r):
    n = int(0.02 * SR)
    t = np.arange(n) / SR
    return one_pole_lp(one_pole_hp(r.standard_normal(n), 3000), 9000) * np.exp(-t / 0.003)


# --------------------------------------------------------------------- score

def compose(tl):
    dur = tl['duration']
    n = int(np.ceil(dur * SR)) + 1
    beat = 60.0 / tl['bpm']
    style = tl.get('musicStyle', 'glass')
    prog = STYLES.get(style, STYLES['glass'])
    root = 48 + NOTE.get(tl.get('key', 'D'), 2)  # C3 + key
    e = energy_curve(tl, n)
    events = tl['events']
    hits = [ev['t'] for ev in events if ev['type'] == 'hit']
    resolve = next((ev['t'] for ev in events if ev['type'] == 'resolve'), None)
    end_music = resolve if resolve is not None else dur

    pad = np.zeros((n, 2))
    rhythm = np.zeros((n, 2))
    melodic = np.zeros((n, 2))
    fx = np.zeros((n, 2))

    # Pad: chord per two bars, voiced around the root, brightness follows energy.
    bars2 = beat * 8
    k = 0
    t0 = 0.0
    while t0 < end_music:
        off, chord = prog[k % len(prog)]
        a, b = int(t0 * SR), min(n, int(min(t0 + bars2, end_music) * SR) + int(0.25 * SR))
        seg = b - a
        bright = e[a:b]
        for v, iv in enumerate(chord[:4]):
            freq = midi_hz(root + 12 + off + iv - (12 if off + iv > 9 else 0))
            voice = pad_voice(freq, seg, bright, seed=k * 10 + v)
            fade = np.minimum(1, np.minimum(np.arange(seg), seg - np.arange(seg)) / (0.25 * SR))
            pad[a:b] += voice * fade[:, None] * 0.08
        k += 1
        t0 += bars2

    # Rhythm and arpeggio on the beat grid, gated by energy. The bar before a hit drops out.
    def near_hit(t, window):
        return any(0 <= h - t < window for h in hits)

    step = beat / 2
    i = 0
    t = 0.0
    while t < end_music - 1e-6:
        idx = min(n - 1, int(t * SR))
        en = e[idx]
        chord_i = int(t // bars2) % len(prog)
        off, chord = prog[chord_i]
        on_beat = i % 2 == 0
        breath = near_hit(t, beat * 0.5)
        if not breath:
            if style == 'glass':
                if en > 0.28:
                    tone = chord[(i // 1) % len(chord)]
                    f = midi_hz(root + 24 + off + tone)
                    place(melodic, pluck(f, 0.6, en), t, gain=0.18 * min(1, en * 1.6), pan=0.35 if i % 2 else -0.35)
                if on_beat and en > 0.42:
                    place(rhythm, bass_note(midi_hz(root - 12 + off), beat * 0.95), t, gain=0.22)
                if on_beat and en > 0.62:
                    place(rhythm, kick(), t, gain=0.5 * en)
                if not on_beat and en > 0.7:
                    place(rhythm, hat(i), t, gain=0.12, pan=0.25)
            else:  # pulse
                if on_beat and en > 0.3:
                    place(rhythm, kick(), t, gain=0.62 * max(0.5, en))
                if en > 0.35:
                    place(rhythm, bass_note(midi_hz(root - 12 + off), step * 0.9), t, gain=0.2 * en)
                if not on_beat and en > 0.45:
                    place(rhythm, hat(i), t, gain=0.14, pan=-0.2)
                if en > 0.75:
                    place(rhythm, hat(i + 1000), t + step / 2, gain=0.07, pan=0.3)
                if on_beat and (i // 2) % 2 == 1 and en > 0.7:
                    place(rhythm, clap(i), t, gain=0.32)
                if en > 0.5 and i % 3 != 2:
                    tone = chord[(i * 2) % len(chord)]
                    place(melodic, pluck(midi_hz(root + 24 + off + tone), 0.35, en), t, gain=0.12, pan=0.4 if i % 2 else -0.4)
        i += 1
        t = i * step

    # Risers into hits, the hit itself, then a resolve chord that rings out over the logo.
    for h in hits:
        rd = min(beat * 4, h)
        place(fx, riser(rd), h - rd, gain=0.35)
        place(fx, impact(), h, gain=0.55)
        off, chord = prog[int(h // bars2) % len(prog)]
        for v, iv in enumerate(chord[:4]):
            place(melodic, bell(midi_hz(root + 12 + off + iv), 3.0), h, gain=0.09, pan=(v - 1.5) * 0.3)
    if resolve is not None:
        tail = dur - resolve
        for v, iv in enumerate([0, 7, 14, 16]):
            place(melodic, bell(midi_hz(root + 12 + iv), max(1.5, tail + 1)), resolve, gain=0.11, pan=(v - 1.5) * 0.25)
        place(fx, impact(seed=12) * 0.5, resolve, gain=0.3)

    ir = reverb_ir()
    music = apply_reverb(pad, ir, 0.35) + rhythm + apply_reverb(melodic, ir, 0.3) + apply_reverb(fx, ir, 0.25)
    # final fade so the last frame is quiet, not chopped
    fade_n = int(0.35 * SR)
    music[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None] ** 2
    return music[: int(round(dur * SR))]


def sound_design(tl):
    dur = tl['duration']
    n = int(round(dur * SR))
    out = np.zeros((n, 2))
    r = rng(42)
    for ev in tl['events']:
        typ, t = ev['type'], ev['t']
        if typ == 'key':
            place(out, sfx_key(r), t, gain=0.12, pan=r.uniform(-0.15, 0.15))
        elif typ == 'click':
            place(out, sfx_click(r), t, gain=0.3)
        elif typ == 'pop':
            place(out, sfx_pop(), t, gain=0.16)
        elif typ == 'whoosh':
            place(out, sfx_whoosh(ev.get('len', 0.6), r), t, gain=0.08)
        elif typ == 'cut' and not ev.get('scene'):
            place(out, sfx_tick(r), t, gain=0.05)
    return out


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
    """Two-pass EBU R128 normalization; returns measured integrated loudness of the result."""
    first = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f'loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = json.loads(first[first.rindex('{'):first.rindex('}') + 1])
    af = (f"loudnorm=I={lufs}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ar', str(SR), dst], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('timeline')
    ap.add_argument('--out', default='.')
    ap.add_argument('--music', help='use this track instead of the generated score')
    ap.add_argument('--offset', type=float, default=0.0, help='seconds to skip into --music so its downbeat lands at 0')
    ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    tl = json.load(open(a.timeline))
    os.makedirs(a.out, exist_ok=True)
    music = load_music(a.music, tl['duration'], a.offset) * 0.8 if a.music else compose(tl)
    sfx = sound_design(tl)
    write(os.path.join(a.out, 'music.wav'), music)
    write(os.path.join(a.out, 'sfx.wav'), sfx)
    raw = os.path.join(a.out, 'mix.raw.wav')
    write(raw, music * 0.85 + sfx)
    loudnorm(raw, os.path.join(a.out, 'mix.wav'), a.lufs)
    os.remove(raw)
    print(f"▸ score: {tl['duration']:.2f}s, {tl['bpm']} BPM, {tl.get('musicStyle')} in {tl.get('key')}, "
          f"{sum(1 for e in tl['events'] if e['type'] == 'key')} key taps, mastered to {a.lufs} LUFS -> {a.out}/mix.wav")


if __name__ == '__main__':
    sys.exit(main())
