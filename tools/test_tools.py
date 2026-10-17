"""Smoke tests for the audio and critic tools: python3 -m unittest tools/test_tools.py"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score  # noqa: E402

# the shape engine/render.mjs writes to build/manifest.json
TL = {
    'title': 't', 'fps': 30, 'width': 320, 'height': 180, 'bpm': 120, 'duration': 6.0,
    'music': {'key': 'D', 'style': 'pulse'}, 'post': {'grain': 0, 'vignette': 0, 'blur': 1},
    'scenes': [
        {'name': 'a', 'kind': 'world', 'start': 0, 'end': 4, 'energy': 0.9, 'words': ''},
        {'name': 'b', 'kind': 'type', 'start': 4, 'end': 6, 'energy': 0.4, 'words': 'Hello there'},
    ],
    'events': [{'t': 0.5, 'type': 'key'}, {'t': 1.0, 'type': 'click'}, {'t': 1.5, 'type': 'land', 'i': 3, 'n': 10}, {'t': 2.0, 'type': 'whoosh', 'len': 0.5},
               {'t': 2.5, 'type': 'drop'}, {'t': 3.0, 'type': 'thud'}, {'t': 3.0, 'type': 'cut'}, {'t': 4.0, 'type': 'hit'}, {'t': 5.0, 'type': 'resolve'},
               {'t': 1.2, 'type': 'rustle'}, {'t': 2.2, 'type': 'flip'}, {'t': 2.4, 'type': 'tick', 'i': 1}],
}


class ScoreTest(unittest.TestCase):
    def test_compose_length_and_silence_at_end(self):
        for style in [s for s in score.STYLES if s != 'room']:
            music = score.compose({**TL, 'music': {'key': 'D', 'style': style}})
            self.assertEqual(music.shape, (int(round(6.0 * score.SR)), 2))
            self.assertTrue(np.isfinite(music).all())
            self.assertGreater(np.abs(music).max(), 0.01)
            self.assertLess(np.abs(music[-50:]).max(), 1e-3)

    def test_room_is_silent_and_endings_differ(self):
        self.assertEqual(np.abs(score.compose({**TL, 'music': {'key': 'D', 'style': 'room'}})).max(), 0)
        after = {}
        for end in score.ENDINGS:
            m = score.compose({**TL, 'music': {'key': 'D', 'style': 'solo', 'end': end}})
            after[end] = np.sqrt((m[int(5.2 * score.SR):int(5.35 * score.SR)] ** 2).mean())
        self.assertLess(after['cut'], 1e-4)  # dead after the resolve cue
        self.assertGreater(after['ring'], after['phrase'])  # ring adds a chord, phrase only lets the room ring

    def test_drop_is_silent(self):
        music = score.compose({**TL, 'music': {'key': 'D', 'style': 'felt'}})
        gap = music[int(2.6 * score.SR):int(2.9 * score.SR)]
        before = music[int(2.0 * score.SR):int(2.4 * score.SR)]
        # only the room tail rings in the gap
        self.assertLess(np.sqrt((gap ** 2).mean()), 0.5 * np.sqrt((before ** 2).mean()))

    def test_produced_styles_have_a_low_end(self):
        import sampler
        if not sampler.available():
            self.skipTest('no fluidsynth or SoundFont')
        long = {**TL, 'duration': 8.0, 'scenes': [{**TL['scenes'][0], 'end': 8.0}], 'events': [{'t': 7.0, 'type': 'resolve'}]}
        for style in ('groove', 'pluck', 'cinema', 'bright'):
            m = score.compose({**long, 'music': {'key': 'F', 'style': style, 'arc': [[0, 0.7], [8, 0.7]]}}).mean(axis=1)
            spec = np.abs(np.fft.rfft(m)) ** 2
            f = np.fft.rfftfreq(len(m), 1 / score.SR)
            sub = spec[(f >= 20) & (f < 60)].sum() / spec[(f >= 20) & (f < 11000)].sum()
            self.assertGreater(sub, 0.02, style)  # the references all sit at 10-60%

    def test_mix_is_mastered(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'manifest.json')
            json.dump(TL, open(p, 'w'))
            subprocess.run([sys.executable, os.path.join(HERE, 'score.py'), p, '--out', d], check=True, capture_output=True)
            err = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(d, 'mix.wav'), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
            lufs = float(err[err.rfind('I:'):].split()[1])
            self.assertAlmostEqual(lufs, -14.0, delta=1.0)


class CriticTest(unittest.TestCase):
    def test_critic_runs_on_a_tiny_render(self):
        with tempfile.TemporaryDirectory() as d:
            build = os.path.join(d, 'build')
            os.makedirs(build)
            json.dump(TL, open(os.path.join(build, 'manifest.json'), 'w'))
            vid = os.path.join(d, 'v.mp4')
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=6', '-f', 'lavfi', '-i', 'sine=f=220:d=6',
                            '-shortest', '-pix_fmt', 'yuv420p', vid], check=True)
            r = subprocess.run([sys.executable, os.path.join(HERE, 'critic.py'), vid, '--manifest', os.path.join(build, 'manifest.json'), '--out', os.path.join(d, 'c')],
                               capture_output=True, text=True)
            report = json.load(open(os.path.join(d, 'c', 'report.json')))
            names = {c['check'] for c in report['checks']}
            self.assertIn('Loudness on target', names)
            self.assertIn('Original (not a reference)', names)
            self.assertTrue(os.path.exists(os.path.join(d, 'c', 'contact.jpg')))
            self.assertIn(r.returncode, (0, 1))


if __name__ == '__main__':
    unittest.main()


class OriginalityTest(unittest.TestCase):
    def test_flags_a_copy_and_passes_a_different_film(self):
        import originality
        with tempfile.TemporaryDirectory() as d:
            ref, same, other = (os.path.join(d, n) for n in ('ref.mp4', 'same.mp4', 'other.mp4'))
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=4', '-pix_fmt', 'yuv420p', ref], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', ref, '-vf', 'eq=brightness=0.02', '-pix_fmt', 'yuv420p', same], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'mandelbrot=s=320x180:r=30', '-t', '4', '-pix_fmt', 'yuv420p', other], check=True)
            refs = {'ref': originality.fingerprint(ref)}
            refs = json.loads(json.dumps(refs))  # as stored on disk
            self.assertGreater(originality.check(same, refs)['share'], 0.5)
            self.assertEqual(originality.check(other, refs)['share'], 0.0)


class MusicTest(unittest.TestCase):
    """tools/music.py: the brief, reading a Lyria response, and fitting a take to the film's grid."""

    def setUp(self):
        import music
        self.music = music
        self.dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.dir, 'build'))
        self.man = {**TL, 'bpm': 120, 'duration': 6.0, 'notes': {'form': 'A groove in one gear.', 'sound': 'Warm keys and a sub.'},
                    'music': {'key': 'D', 'track': 'music/track.wav', 'arc': [[0, 0.3], [4, 0.8], [6, 0.2]]}}
        with open(os.path.join(self.dir, "build", "manifest.json"), "w") as f:
            json.dump(self.man, f)

    def test_brief_follows_the_film(self):
        text = self.music.brief(self.man)
        self.assertIn('120 BPM', text)
        self.assertIn('No vocals', text)
        self.assertIn('Warm keys and a sub.', text)
        self.assertIn("[0:00 - 0:04]", text)
        self.assertIn('resolves on a final chord', text)  # the resolve cue at 5s

    def test_reads_audio_from_steps_and_legacy_outputs(self):
        import base64
        enc = base64.b64encode(b'ID3abc').decode()
        self.assertEqual(self.music.audio_of({'steps': [{'type': 'model_output', 'content': [{'type': 'text', 'text': 'x'}, {'type': 'audio', 'data': enc, 'mime_type': 'audio/mpeg'}]}]}), (b'ID3abc', 'audio/mpeg'))
        self.assertEqual(self.music.audio_of({'outputs': [{'type': 'audio', 'data': enc}]})[0], b'ID3abc')
        self.assertEqual(self.music.audio_of({'steps': []}), (None, None))

    def test_fit_stretches_to_tempo_and_trims(self):
        from scipy.io import wavfile
        # a click track at 116 BPM that starts half a beat late: fit must bring it to 120 and to length
        sr, bpm = 48000, 116.0
        x = np.zeros(int(10 * sr))
        for k in range(18):
            i = int((0.26 + k * 60 / bpm) * sr)
            x[i:i + 600] += np.sin(np.arange(600) / 600 * np.pi) * (1.0 if k % 4 == 0 else 0.5) * np.sin(np.arange(600) * 0.3)
        os.makedirs(os.path.join(self.dir, 'music'))
        wavfile.write(os.path.join(self.dir, 'music', 'take-1.wav'), sr, (x * 20000).astype(np.int16))
        try:
            import librosa  # noqa: F401
        except ImportError:
            self.skipTest('needs librosa')
        out = self.music.fit(self.dir, 'music/take-1.wav')
        r, y = wavfile.read(out)
        self.assertEqual(len(y), int(6.0 * 48000))
        meta = json.load(open(os.path.join(self.dir, 'music', 'track.json')))
        self.assertAlmostEqual(meta['stretch'], 120 / meta['tempo'], places=3)
        self.assertLess(abs(meta['tempo'] - bpm), 3)
        # the scorer picks the fitted track up from the manifest
        res = subprocess.run([sys.executable, os.path.join(HERE, 'score.py'), os.path.join(self.dir, 'build', 'manifest.json'), '--out', os.path.join(self.dir, 'build')], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stderr)


class SynthTest(unittest.TestCase):
    def test_song_mixes_to_levels_and_loudness(self):
        import soundfile  # noqa: F401  (pyloudnorm's dependency chain)
        from synth import Song, active_rms_db
        s = Song(bpm=120, beats=8, tail=1.0)
        s.bus('pad', verb=0.4, duck=0.4)
        s.bus('kick')
        s.pad([57, 61, 64], at=0, beats=8, cutoff=1200)
        for b in range(8):
            s.kick(at=b)
        with tempfile.TemporaryDirectory() as d:
            lufs = s.master(os.path.join(d, 'mix.wav'), lufs=-14, levels={'pad': -24, 'kick': -16})
            self.assertAlmostEqual(lufs, -14, delta=1.0)
            from scipy.io import wavfile
            sr, x = wavfile.read(os.path.join(d, 'mix.wav'))
            self.assertEqual(sr, 48000)
            self.assertLessEqual(np.abs(x).max(), 10 ** (-0.9 / 20))  # limited under -1 dBFS (plus rounding)
        # the levels put each bus where the mix says, whatever it came out at
        self.assertAlmostEqual(active_rms_db(s.buses['pad'] * s.sends['pad']['gain']), -24, delta=0.5)
        self.assertAlmostEqual(active_rms_db(s.buses['kick'] * s.sends['kick']['gain']), -16, delta=0.5)

    def test_deterministic(self):
        from synth import Song
        a, b = Song(bpm=100, beats=4, tail=0.5), Song(bpm=100, beats=4, tail=0.5)
        for s in (a, b):
            s.pluck(69, at=0)
            s.hat(at=1)
            s.clap(at=2)
        self.assertTrue(all(np.array_equal(a.buses[k], b.buses[k]) for k in a.buses))
