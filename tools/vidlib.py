"""Shared video and audio measurements for the critic and the reference analyzer (ffmpeg + numpy)."""
import json
import os
import re
import subprocess

import numpy as np

FONT = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf') if os.path.exists(p)), None)


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def probe(path):
    out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', path]).stdout
    j = json.loads(out)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    num, den = v['r_frame_rate'].split('/')
    return {
        'duration': float(j['format']['duration']),
        'width': v['width'],
        'height': v['height'],
        'fps': float(num) / float(den),
        'has_audio': any(s['codec_type'] == 'audio' for s in j['streams']),
    }


def cuts(path, threshold=0.25):
    """Hard cuts via ffmpeg scene scores."""
    err = run(['ffmpeg', '-hide_banner', '-i', path, '-an', '-filter:v', f"select='gt(scene,{threshold})',showinfo", '-f', 'null', '-']).stderr
    return [float(x) for x in re.findall(r'pts_time:([0-9.]+)', err)]


def loudness(path):
    err = run(['ffmpeg', '-hide_banner', '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
    summary = err[err.rfind('Summary:'):]
    i = re.search(r'I:\s+(-?[0-9.]+) LUFS', summary)
    lra = re.search(r'LRA:\s+(-?[0-9.]+) LU', summary)
    peak = re.search(r'Peak:\s+(-?[0-9.]+|-inf) dBFS', summary)
    return {
        'integrated': float(i.group(1)) if i else None,
        'lra': float(lra.group(1)) if lra else None,
        'true_peak': float(peak.group(1)) if peak and peak.group(1) != '-inf' else None,
    }


def black_segments(path, min_dur=0.1):
    err = run(['ffmpeg', '-hide_banner', '-i', path, '-an', '-vf', f'blackdetect=d={min_dur}:pix_th=0.06', '-f', 'null', '-']).stderr
    return [(float(a), float(b)) for a, b in re.findall(r'black_start:([0-9.]+) black_end:([0-9.]+)', err)]


def frozen_segments(path, min_dur=2.0):
    err = run(['ffmpeg', '-hide_banner', '-i', path, '-an', '-vf', f'freezedetect=n=0.002:d={min_dur}', '-f', 'null', '-']).stderr
    starts = [float(x) for x in re.findall(r'freeze_start: ([0-9.]+)', err)]
    ends = [float(x) for x in re.findall(r'freeze_end: ([0-9.]+)', err)]
    dur = probe(path)['duration']
    return [(s, ends[i] if i < len(ends) else dur) for i, s in enumerate(starts)]


def audio_mono(path, sr=22050):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32), sr


def rms_curve(y, sr, step=0.5):
    n = int(step * sr)
    segs = [y[i:i + n] for i in range(0, len(y), n)]
    return [round(float(20 * np.log10(np.sqrt(np.mean(s.astype(np.float64) ** 2)) + 1e-9)), 1) for s in segs if len(s)]


def contact_sheet(path, out, cols=6, rows=None, width=320):
    """Evenly spaced timestamped frames tiled into one image."""
    info = probe(path)
    rows = rows or max(2, min(8, int(np.ceil(info['duration'] / 2.5 / cols))))
    n = cols * rows
    fps = n / info['duration']
    text = f":fontfile={FONT}" if FONT else ''
    vf = (f"fps={fps:.5f},scale={width}:-2,drawtext=text='%{{pts\\:hms}}'{text}:x=6:y=6:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.55,"
          f"tile={cols}x{rows}:padding=4:color=white")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', vf, '-frames:v', '1', out], check=True)
    return out


def tempo_and_onsets(y, sr):
    """Tempo and onset times with librosa when it is installed; None otherwise."""
    try:
        import librosa  # noqa: WPS433 (optional dependency)
    except ImportError:
        return None
    y = y.astype(np.float32)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time')
    return {'tempo': float(np.atleast_1d(tempo)[0]), 'beats': librosa.frames_to_time(beats, sr=sr).tolist(), 'onsets': onsets.tolist()}


def bar(value, scale, width=28):
    n = int(round(min(1.0, value / scale) * width)) if scale else 0
    return '█' * n + '·' * (width - n)
