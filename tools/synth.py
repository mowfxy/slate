#!/usr/bin/env python3
"""A small electronic studio for scoring films, in code.

Why electronic: a film's score here is written by Claude, who can't play an
instrument or hear a take. Sampled acoustic instruments played from a script
(General MIDI pianos, strings, Rhodes) give that away at once: they sound like
a sketch of real players. Synthesizers have no real players to fall short of.
A saw pad, a filtered pluck, an 808-style kick and a sine sub *are* the real
instrument when they're synthesized, which is why most modern launch and
product music is built from exactly these sounds.

So this module is a set of well-made synth voices, drums and effects, plus a
mix bus, and each film composes its own score with them (films/<name>/score.py),
the same way it writes its own picture. Nothing here is a template.

    from synth import Song
    s = Song(bpm=120, beats=58)
    s.pad([57, 61, 64, 66], at=0, beats=8, gain=0.5)
    s.pluck(81, at=1, gain=0.4, cutoff=1800)
    s.kick(at=16)
    s.master('build/mix.wav', lufs=-14)

Everything is deterministic (seeded noise), 48 kHz stereo float. Per-sample DSP
(the state-variable filter, the compressor) runs through numba.
"""
import math

import numpy as np
from numba import njit
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ DSP primitives

@njit(cache=True)
def _svf(x, cutoff, q, mode):
    """Topology-preserving state-variable filter with per-sample cutoff. mode 0 lowpass, 1 bandpass, 2 highpass."""
    y = np.empty_like(x)
    ic1 = 0.0
    ic2 = 0.0
    k = 1.0 / q
    for i in range(x.shape[0]):
        fc = min(cutoff[i], SR * 0.45)
        g = math.tan(math.pi * fc / SR)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2
        elif mode == 1:
            y[i] = v1
        else:
            y[i] = x[i] - k * v1 - v2
    return y


def svf(x, cutoff, q=0.707, mode='lp'):
    c = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), x.shape).copy()
    return _svf(x.astype(np.float64), c, float(q), {'lp': 0, 'bp': 1, 'hp': 2}[mode])


def saw(freq, n, phase=0.0):
    """Band-limited sawtooth (polyBLEP). freq may be a scalar or a per-sample array."""
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2.0 * ph - 1.0
    # polyBLEP around the wrap
    a = ph < dt
    t = ph[a] / dt[a]
    y[a] -= t + t - t * t - 1.0
    b = ph > 1.0 - dt
    t = (ph[b] - 1.0) / dt[b]
    y[b] -= t * t + t + t + 1.0
    return y


def sine(freq, n, phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return np.sin(2 * np.pi * (phase + np.cumsum(f) / SR))


def adsr(n, a, d, s, r, hold=None):
    """Attack/decay/sustain over `hold` seconds, then release. Curves are exponential-ish, never clicking."""
    hold = n / SR - r if hold is None else hold
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1) ** 0.6
    dec = s + (1 - s) * np.exp(-np.maximum(t - a, 0) / max(d, 1e-4))
    env = np.where(t < a, att, dec)
    rel = np.where(t > hold, np.exp(-(t - hold) / max(r / 4, 1e-4)), 1.0)
    return env * rel


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def pan2(x, p):
    """Equal-power pan, p in -1..1."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x, axis=-1)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x, axis=-1)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=-1)


def shelf_tilt(x, db_per_oct_above_1k=0.0):
    """A gentle tilt: positive brightens, negative darkens, pivoting at 1 kHz."""
    if not db_per_oct_above_1k:
        return x
    hi = highpass(x, 1000, 1)
    g = 10 ** (db_per_oct_above_1k * 2 / 20) - 1
    return x + g * hi


def hall_ir(seconds=2.8, decay=1.9, damp=0.55, predelay=0.02, seed=3):
    """A stereo hall: decorrelated noise with an exponential tail that darkens as it decays, and a few early taps."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for ch in range(2):
        x = noise(n, seed + ch) * np.exp(-6.9 * t / decay)
        # darken over time: crossfade a bright and a dark copy
        dark = lowpass(x, 1800, 2)
        mix = np.clip(t / (decay * damp), 0, 1)
        x = (1 - mix) * x + mix * dark
        x = highpass(x, 120, 2)
        x[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
        for k, (dt, g) in enumerate([(0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.22), (0.053, 0.15)]):
            i = int((dt + 0.003 * ((ch + k) % 3)) * SR)
            x[i] += g * (1 if (k + ch) % 2 else -1) * 4
        out[ch] = x
    pd = int(predelay * SR)
    out = np.pad(out, ((0, 0), (pd, 0)))
    return out / np.sqrt(np.sum(out ** 2) / 2)


@njit(cache=True)
def _comp(x, thr, ratio, att, rel, knee):
    n = x.shape[1]
    g = np.ones(n)
    env = 0.0
    a = math.exp(-1.0 / (att * SR))
    r = math.exp(-1.0 / (rel * SR))
    for i in range(n):
        lvl = max(abs(x[0, i]), abs(x[1, i]))
        db = 20.0 * math.log10(lvl + 1e-9)
        over = db - thr
        if over < -knee / 2:
            red = 0.0
        elif over > knee / 2:
            red = over * (1.0 - 1.0 / ratio)
        else:
            red = (1.0 - 1.0 / ratio) * (over + knee / 2) ** 2 / (2 * knee)
        coef = a if red > env else r
        env = coef * env + (1 - coef) * red
        g[i] = 10.0 ** (-env / 20.0)
    return g


def compress(x, thr=-18, ratio=2.5, att=0.01, rel=0.15, knee=6, makeup=0.0):
    g = _comp(np.ascontiguousarray(x), float(thr), float(ratio), float(att), float(rel), float(knee))
    return x * g * 10 ** (makeup / 20)


def limit(x, ceiling_db=-1.0, look=0.004, rel=0.08):
    """Lookahead peak limiter: the gain drops before a peak arrives, so nothing clips and nothing crunches."""
    c = 10 ** (ceiling_db / 20)
    peak = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, c / np.maximum(peak, 1e-9))
    L = int(look * SR)
    # minimum over the lookahead window, then a smooth release
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(need, size=2 * L + 1, origin=0)
    g = np.concatenate([g[L:], np.full(L, g[-1])])
    out = np.empty_like(g)
    r = math.exp(-1 / (rel * SR))
    out = _release(g, r)
    out = uniform_filter1d(out, L)
    return x * np.minimum(out, need)


@njit(cache=True)
def _release(g, r):
    out = np.empty_like(g)
    cur = 1.0
    for i in range(g.shape[0]):
        cur = g[i] if g[i] < cur else r * cur + (1 - r) * g[i]
        out[i] = cur
    return out


# ------------------------------------------------------------------ the song

def active_rms_db(x, win=0.05, floor=30):
    """RMS in dB over the windows where a signal is actually playing (within `floor` dB of its loudest)."""
    m = x.mean(axis=0) if x.ndim == 2 else x
    w = int(win * SR)
    k = len(m) // w
    if k == 0:
        return -120.0
    e = (m[: k * w].reshape(k, w) ** 2).mean(axis=1)
    if e.max() <= 0:
        return -120.0
    on = e[e > e.max() * 10 ** (-floor / 10)]
    return 10 * np.log10(on.mean() + 1e-20)


class Song:
    """A multitrack session on a beat grid. Instruments write into named buses; master() mixes them."""

    def __init__(self, bpm, beats, tail=4.0, seed=7):
        self.bpm = bpm
        self.beat = 60.0 / bpm
        self.n = int((beats * self.beat + tail) * SR)
        self.buses = {}
        self.sends = {}
        self.seed = seed
        self.kicks = []

    def t(self, b):
        return b * self.beat

    def bus(self, name, verb=0.0, delay=0.0, duck=0.0, gain=1.0, hp=0.0, tilt=0.0):
        """A mix bus: verb/delay are send levels, duck is how much the kick pushes it down (sidechain)."""
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.n))
            self.sends[name] = dict(verb=verb, delay=delay, duck=duck, gain=gain, hp=hp, tilt=tilt)
        return self.buses[name]

    def _put(self, name, x, at_sec, p=0.0, gain=1.0):
        buf = self.bus(name)
        if x.ndim == 1:
            x = pan2(x, p)
        i = int(round(at_sec * SR))
        if i >= self.n:
            return
        j = min(self.n, i + x.shape[1])
        s = max(0, -i)
        buf[:, max(i, 0):j] += gain * x[:, s:j - i]

    def _rng(self):
        self.seed += 1
        return np.random.default_rng(self.seed)

    # ---- tonal voices

    def pad(self, notes, at, beats, gain=0.5, cutoff=1400, open_to=None, attack=0.8, release=2.2, voices=5, detune=0.14, bus='pad'):
        """A wide detuned-saw pad. The filter moves from cutoff to open_to across the chord."""
        dur = self.t(beats)
        n = int((dur + release) * SR)
        cut = np.geomspace(cutoff, open_to or cutoff, n)
        L = np.zeros(n)
        R = np.zeros(n)
        r = self._rng()
        for m in notes:
            f = hz(m)
            for v in range(voices):
                d = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune  # semitones
                drift = 1 + 0.0015 * np.sin(2 * np.pi * (0.13 + 0.07 * v) * np.arange(n) / SR + r.uniform(0, 6))
                x = saw(f * 2 ** (d / 12) * drift, n, r.uniform())
                p = (v / max(1, voices - 1)) * 2 - 1
                L += x * math.cos((p * 0.8 + 1) * math.pi / 4)
                R += x * math.sin((p * 0.8 + 1) * math.pi / 4)
        env = adsr(n, attack, 1.5, 0.85, release, hold=dur)
        k = 0.11 / (len(notes) * voices) ** 0.5
        L = svf(L, cut, 0.8) * env * k
        R = svf(R, cut * 1.03, 0.8) * env * k
        self._put(bus, np.stack([L, R]), self.t(at), gain=gain)

    def pluck(self, m, at, gain=0.4, cutoff=900, env_amt=3500, decay=0.22, length=0.6, p=0.0, q=1.1, bus='pluck'):
        """A filtered two-saw pluck: the filter snaps open and closes, like a plucked analog synth."""
        n = int(length * SR)
        f = hz(m)
        r = self._rng()
        x = saw(f * 2 ** (0.07 / 12), n, r.uniform()) + saw(f * 2 ** (-0.07 / 12), n, r.uniform()) + 0.5 * sine(f / 2, n)
        t = np.arange(n) / SR
        cut = cutoff + env_amt * np.exp(-t / (decay * 0.5))
        amp = np.exp(-t / decay) * np.minimum(1, t / 0.002) * np.minimum(1, (length - t) / 0.03)
        y = svf(x, cut, q) * amp * 0.28
        self._put(bus, y, self.t(at), p=p, gain=gain)

    def bell(self, m, at, gain=0.3, length=3.5, p=0.0, bus='bell'):
        """An FM bell: glassy, used sparingly (here: for the dot)."""
        n = int(length * SR)
        f = hz(m)
        t = np.arange(n) / SR
        idx = 2.2 * np.exp(-t / 0.35) + 0.3
        mod = np.sin(2 * np.pi * f * 3.5 * t) * idx
        y = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 1.1) * np.minimum(1, t / 0.003)
        y += 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.4)
        self._put(bus, y * 0.3, self.t(at), p=p, gain=gain)

    def sub(self, m, at, beats, gain=0.6, glide_from=None, bus='sub'):
        """A round sub: sine with a little drive for the second harmonic, so it reads on small speakers."""
        n = int(self.t(beats) * SR)
        f = np.full(n, hz(m))
        if glide_from is not None:
            g = int(0.06 * SR)
            f[:g] = np.geomspace(hz(glide_from), hz(m), g)
        x = sine(f, n)
        x = np.tanh(1.8 * x) / np.tanh(1.8)
        env = np.minimum(1, np.arange(n) / (0.004 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.03 * SR))
        self._put(bus, x * env * 0.5, self.t(at), gain=gain)

    def bass(self, m, at, beats, gain=0.4, cutoff=400, bus='bass'):
        """A short filtered-saw bass note above the sub, for motion in the low mids."""
        n = int(self.t(beats) * SR)
        t = np.arange(n) / SR
        x = saw(hz(m), n) + 0.6 * saw(hz(m) * 1.003, n)
        cut = cutoff + 900 * np.exp(-t / 0.05)
        amp = np.minimum(1, t / 0.003) * np.exp(-t / 0.25) * np.minimum(1, (n - np.arange(n)) / (0.02 * SR))
        self._put(bus, svf(x, cut, 1.2) * amp * 0.25, self.t(at), gain=gain)

    # ---- drums (808/909-style, synthesized like the originals)

    def kick(self, at, gain=0.8, tone=48, punch=1.0, bus='kick'):
        n = int(0.55 * SR)
        t = np.arange(n) / SR
        f = tone + (165 - tone) * np.exp(-t / 0.032) + 60 * np.exp(-t / 0.004)
        body = sine(f, n) * np.exp(-t / 0.28)
        click = highpass(noise(n, int(at * 97) % 1000), 2500) * np.exp(-t / 0.0025) * 0.25 * punch
        x = np.tanh(1.4 * (body + click))
        self._put(bus, x * 0.75, self.t(at), gain=gain)
        self.kicks.append(self.t(at))

    def clap(self, at, gain=0.4, p=0.05, bus='clap'):
        n = int(0.45 * SR)
        t = np.arange(n) / SR
        nz = bandpass(noise(n, int(at * 131) % 1000), 900, 5000)
        env = np.zeros(n)
        for k, dt in enumerate([0.0, 0.011, 0.022]):
            env += np.where(t >= dt, np.exp(-(t - dt) / 0.006), 0) * (0.8 if k < 2 else 1.0)
        env += np.where(t >= 0.03, 0.5 * np.exp(-(t - 0.03) / 0.11), 0)
        self._put(bus, nz * env * 0.35, self.t(at), p=p, gain=gain)

    def hat(self, at, gain=0.2, open_=False, p=0.2, bus='hat'):
        n = int((0.4 if open_ else 0.09) * SR)
        t = np.arange(n) / SR
        # six detuned squares at 808 ratios, through a bandpass, plus air
        metal = sum(np.sign(np.sin(2 * np.pi * f * t + i)) for i, f in enumerate([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]))
        x = highpass(bandpass(metal, 7000, 14000) * 0.3 + highpass(noise(n, int(at * 61) % 1000), 9000) * 0.5, 6000)
        x *= np.exp(-t / (0.12 if open_ else 0.022)) * np.minimum(1, t / 0.0008)
        self._put(bus, x * 0.3, self.t(at), p=p, gain=gain)

    def shaker(self, at, gain=0.1, p=-0.25, bus='hat'):
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        x = bandpass(noise(n, int(at * 17) % 1000), 4000, 11000) * np.sin(np.pi * np.clip(t / 0.07, 0, 1)) ** 2
        self._put(bus, x * 0.3, self.t(at), p=p, gain=gain)

    # ---- transitions and foley

    def riser(self, at, beats, gain=0.3, bus='fx'):
        dur = self.t(beats)
        n = int(dur * SR)
        t = np.arange(n) / SR
        u = t / dur
        x = svf(noise(n, int(at * 7) % 1000), 300 * (40 ** u), 2.0, 'bp')
        x += 0.15 * saw(hz(62) * 2 ** (u * 1.0), n) * u
        self._put(bus, np.stack([x, np.roll(x, 240)]) * (u ** 2.2) * 0.4, self.t(at), gain=gain)

    def swell(self, at, beats, gain=0.3, bus='fx'):
        """A reversed-cymbal-like swell that lands on `at + beats`."""
        dur = self.t(beats)
        n = int(dur * SR)
        u = np.arange(n) / n
        x = highpass(noise(n, int(at * 11) % 1000), 2500) * u ** 3
        self._put(bus, np.stack([x, np.roll(x, 300)]) * 0.25, self.t(at), gain=gain)

    def impact(self, at, gain=0.6, bus='fx'):
        n = int(3.0 * SR)
        t = np.arange(n) / SR
        boom = sine(36 + 50 * np.exp(-t / 0.08), n) * np.exp(-t / 0.9)
        body = lowpass(noise(n, int(at * 3) % 1000), 900) * np.exp(-t / 0.18) * 0.4
        x = np.tanh(1.5 * (boom + body)) * 0.6
        self._put(bus, x, self.t(at), gain=gain)

    def whoosh(self, at_sec, dur, gain=0.25, bus='fx'):
        n = int(dur * SR)
        u = np.arange(n) / n
        cut = 400 * (12 ** np.sin(np.pi * u * 0.85))
        x = svf(noise(n, int(at_sec * 5) % 1000), cut, 1.4, 'bp')
        shape = np.sin(np.pi * u) ** 1.6
        self._put(bus, np.stack([x * shape, np.roll(x, 400) * shape]) * 0.5, at_sec, gain=gain)

    def click(self, at_sec, gain=0.2, bus='foley'):
        n = int(0.03 * SR)
        t = np.arange(n) / SR
        x = highpass(noise(n, int(at_sec * 1000) % 997), 2500) * np.exp(-t / 0.0015) + 0.5 * np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.004)
        self._put(bus, x * 0.4, at_sec, gain=gain)

    def tick(self, at_sec, gain=0.15, pitch=1.0, bus='foley'):
        """A soft wooden landing: a short damped tone and a breath of noise."""
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        f = 820 * pitch * (1 + 0.25 * np.exp(-t / 0.004))
        x = sine(f, n) * np.exp(-t / 0.018) + 0.2 * bandpass(noise(n, int(at_sec * 313) % 1000), 1500, 6000) * np.exp(-t / 0.006)
        self._put(bus, x * 0.35, at_sec, gain=gain)

    # ---- mix

    def master(self, out, lufs=-14.0, verb=None, delay_beats=0.75, stems=None, levels=None):
        """Sum the buses through sends (hall, ping-pong delay), sidechain, a glue compressor and a limiter, to `lufs`.

        levels: {bus: dB}, each bus's loudness *while it plays* (RMS over its active windows), relative to full
        scale before the master. This is the mix: it's set by numbers, so a quiet synth voice and a hot kick
        meet where the mix says, whatever their raw levels came out at.
        """
        import pyloudnorm as pyln
        if levels:
            for name, db in levels.items():
                if name in self.buses:
                    self.sends[name]['gain'] = 10 ** ((db - active_rms_db(self.buses[name])) / 20)
        duck = self._duck()
        ir = verb if verb is not None else hall_ir()
        verb_in = np.zeros((2, self.n))
        dly_in = np.zeros((2, self.n))
        dry = np.zeros((2, self.n))
        for name, x in self.buses.items():
            s = self.sends[name]
            if s['hp']:
                x = highpass(x, s['hp'])
            if s['tilt']:
                x = shelf_tilt(x, s['tilt'])
            if s['duck']:
                x = x * (1 - s['duck'] * (1 - duck))
            x = x * s['gain']
            dry += x
            verb_in += x * s['verb']
            dly_in += x * s['delay']
            if stems:
                wavfile.write(f'{stems}/{name}.wav', SR, (x.T * 0.5).astype(np.float32))
        wet = np.stack([fftconvolve(verb_in[c], ir[c])[: self.n] for c in range(2)]) * 0.35
        mix = dry + wet + self._pingpong(dly_in, delay_beats)
        mix = highpass(mix, 28, 2)
        mix = compress(mix, thr=-16, ratio=2.0, att=0.015, rel=0.2, knee=8)
        meter = pyln.Meter(SR)
        loud = meter.integrated_loudness(mix.T)
        mix *= 10 ** ((lufs - loud) / 20)
        mix = limit(mix, -1.0)
        # fade the very end so the tail never stops on a click
        f = int(0.5 * SR)
        mix[:, -f:] *= np.linspace(1, 0, f) ** 2
        wavfile.write(out, SR, mix.T.astype(np.float32))
        return meter.integrated_loudness(mix.T)

    def _duck(self):
        """Sidechain gain from the kicks: dips fast, recovers over most of a beat."""
        g = np.ones(self.n)
        t = np.arange(int(self.beat * SR)) / SR
        shape = 1 - np.exp(-((t / (self.beat * 0.32)) ** 2) * 2.5)
        shape = np.minimum(shape, np.minimum(1, (t + 0.002) / 0.006) * 0 + shape)
        for k in self.kicks:
            i = int(k * SR)
            j = min(self.n, i + len(shape))
            g[i:j] = np.minimum(g[i:j], shape[: j - i])
        # soften the attack of the dip so it never clicks
        from scipy.ndimage import uniform_filter1d
        return uniform_filter1d(g, int(0.004 * SR))

    def _pingpong(self, x, beats, fb=0.42, taps=6):
        d = int(self.t(beats) * SR)
        out = np.zeros_like(x)
        cur = lowpass(highpass(x, 300), 5000)
        for k in range(1, taps + 1):
            cur = lowpass(cur, 4500, 1) * fb
            ch = k % 2
            src = cur[0] + cur[1]
            out[ch, k * d:] += src[: self.n - k * d] * 0.5
        return out
