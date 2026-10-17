"""Sampled instruments for the score: write notes as MIDI, render them through FluidSynth with a SoundFont.

Synthesis alone sounds like a demo. Launch films are scored with real recorded instruments (pianos,
string sections, harps, mallets, choirs, drum machines), so the scorer plays its parts on sampled
ones when a SoundFont is installed, and falls back to its own synths when one isn't.

    apt install fluidsynth musescore-general-soundfont-lossless    (Debian/Ubuntu)
    brew install fluid-synth  + MuseScore_General.sf2 from musescore.org   (macOS)

SLATE_SOUNDFONT=/path/to/font.sf2 picks a specific font.
"""
import os
import shutil
import struct
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile

SR = 48000
FONTS = [
    os.environ.get('SLATE_SOUNDFONT', ''),
    '/usr/share/sounds/sf2/MuseScore_General_Full.sf2',
    '/usr/share/sounds/sf3/MuseScore_General.sf3',
    '/usr/share/sounds/sf2/MuseScore_General.sf2',
    os.path.expanduser('~/Library/Audio/Sounds/Banks/MuseScore_General.sf2'),
    '/opt/homebrew/share/soundfonts/default.sf2',
    '/usr/share/sounds/sf2/FluidR3_GM.sf2',
]

# (bank, program) in the General MIDI layout the MuseScore font follows
GM = {
    'piano': (0, 0), 'mellow piano': (8, 0), 'ep': (0, 4), 'fm ep': (0, 5), 'celesta': (0, 8), 'glock': (0, 9),
    'music box': (0, 10), 'vibes': (0, 11), 'marimba': (0, 12), 'kalimba': (0, 108), 'harp': (0, 46),
    'strings': (0, 49), 'strings fast': (0, 48), 'tremolo': (0, 44), 'pizz': (0, 45),
    'violins': (20, 49), 'violas': (30, 49), 'celli': (40, 49), 'basses': (50, 49),
    'celli pizz': (40, 45), 'violins trem': (20, 44),
    'choir': (0, 52), 'oohs': (0, 53), 'horns': (0, 60), 'timpani': (0, 47),
    'warm pad': (0, 89), 'halo pad': (0, 94), 'bowed glass': (0, 92), 'fingered bass': (0, 33), 'synth bass': (0, 38),
    'drums': (128, 0), 'tr808': (128, 25), 'electronic': (128, 24), 'brush kit': (128, 40), 'orchestra kit': (128, 48),
}
# General MIDI drum notes
KICK, RIM, SNARE, CLAP, HAT, PEDAL_HAT, OPEN_HAT, CRASH, RIDE, SHAKER, TAMB, LOW_TOM, HI_TOM, CONGA = 36, 37, 38, 39, 42, 44, 46, 49, 51, 70, 54, 45, 50, 63


def font():
    for f in FONTS:
        if f and os.path.exists(f):
            return f
    return None


def available():
    return shutil.which('fluidsynth') is not None and font() is not None


def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append(0x80 | (n & 0x7F))
        n >>= 7
    return bytes(reversed(out))


def write_midi(path, notes, program, bank=0, channel=0, ppq=960, cc=None):
    """notes: [(start_s, dur_s, midi_pitch, velocity 1..127)], at 120 BPM so one tick is 1/1920 s.
    cc: optional [(t, controller, value)] (11 = expression, 64 = sustain)."""
    tick = lambda s: int(round(s * ppq * 2))
    ch = 9 if bank == 128 else channel
    ev = []
    if bank == 128:
        ev.append((0, 0, bytes([0xB0 | ch, 0, 127 if program else 0])))
    else:
        ev.append((0, 0, bytes([0xB0 | ch, 0, bank])))
    ev.append((0, 1, bytes([0xC0 | ch, program & 0x7F])))
    ev.append((0, 2, bytes([0xB0 | ch, 91, 0])))  # the mix adds its own room; no SoundFont reverb
    ev.append((0, 3, bytes([0xB0 | ch, 93, 0])))
    for t, c, v in cc or []:
        ev.append((tick(t), 4, bytes([0xB0 | ch, c, int(np.clip(v, 0, 127))])))
    for s, d, p, v in notes:
        p = int(np.clip(round(p), 0, 127))
        ev.append((tick(s), 6, bytes([0x90 | ch, p, int(np.clip(round(v), 1, 127))])))
        ev.append((tick(s + max(d, 0.01)), 5, bytes([0x80 | ch, p, 0])))
    ev.sort(key=lambda e: (e[0], e[1]))
    track, last = b'', 0
    track += _vlq(0) + b'\xff\x51\x03' + (500000).to_bytes(3, 'big')  # 120 BPM
    for t, _, data in ev:
        track += _vlq(t - last) + data
        last = t
    track += _vlq(0) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, ppq) + b'MTrk' + struct.pack('>I', len(track)) + track)


def render(notes, instrument, length, gain=1.0, cc=None):
    """Play notes on a named instrument (see GM) and return a stereo float array of `length` seconds."""
    n = int(round(length * SR))
    if not notes or not available():
        return np.zeros((n, 2))
    bank, prog = GM[instrument] if isinstance(instrument, str) else instrument
    with tempfile.TemporaryDirectory() as d:
        mid, wav = os.path.join(d, 'p.mid'), os.path.join(d, 'p.wav')
        write_midi(mid, notes, prog, bank, cc=cc)
        subprocess.run(['fluidsynth', '-ni', '-q', '-r', str(SR), '-g', '0.6', '-R', '0', '-C', '0', '-o', 'synth.polyphony=256',
                        '-F', wav, font(), mid], check=True, capture_output=True)
        sr, x = wavfile.read(wav)
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    out = np.zeros((n, 2))
    out[: min(n, len(x))] = x[:n]
    return out * gain
