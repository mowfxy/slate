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
        for style in ('felt', 'pulse', 'glass'):
            music = score.compose({**TL, 'music': {'key': 'D', 'style': style}})
            self.assertEqual(music.shape, (int(round(6.0 * score.SR)), 2))
            self.assertTrue(np.isfinite(music).all())
            self.assertGreater(np.abs(music).max(), 0.01)
            self.assertLess(np.abs(music[-50:]).max(), 1e-3)

    def test_drop_is_silent(self):
        music = score.compose({**TL, 'music': {'key': 'D', 'style': 'felt'}})
        gap = music[int(2.6 * score.SR):int(2.9 * score.SR)]
        before = music[int(2.0 * score.SR):int(2.4 * score.SR)]
        # only the room tail rings in the gap
        self.assertLess(np.sqrt((gap ** 2).mean()), 0.5 * np.sqrt((before ** 2).mean()))

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
