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

TL = {
    'title': 't', 'fps': 30, 'width': 320, 'height': 180, 'bpm': 120, 'key': 'D', 'musicStyle': 'pulse', 'duration': 6.0, 'totalFrames': 180,
    'scenes': [
        {'index': 0, 'type': 'montage', 'start': 0, 'end': 4, 'startFrame': 0, 'durationFrames': 120, 'energy': 0.9},
        {'index': 1, 'type': 'titleCard', 'start': 4, 'end': 6, 'startFrame': 120, 'durationFrames': 60, 'energy': 0.4},
    ],
    'events': [{'t': 0.5, 'type': 'key'}, {'t': 1.0, 'type': 'click'}, {'t': 2.0, 'type': 'whoosh', 'len': 0.5},
               {'t': 3.0, 'type': 'cut'}, {'t': 4.0, 'type': 'hit'}, {'t': 5.0, 'type': 'resolve'}],
    'reading': [],
}


class ScoreTest(unittest.TestCase):
    def test_compose_length_and_silence_at_end(self):
        for style in ('pulse', 'glass'):
            music = score.compose({**TL, 'musicStyle': style})
            self.assertEqual(music.shape, (int(round(6.0 * score.SR)), 2))
            self.assertTrue(np.isfinite(music).all())
            self.assertGreater(np.abs(music).max(), 0.01)
            self.assertLess(np.abs(music[-50:]).max(), 1e-3)

    def test_mix_is_mastered(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'timeline.json')
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
            json.dump(TL, open(os.path.join(build, 'timeline.json'), 'w'))
            vid = os.path.join(d, 'v.mp4')
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=6', '-f', 'lavfi', '-i', 'sine=f=220:d=6',
                            '-shortest', '-pix_fmt', 'yuv420p', vid], check=True)
            r = subprocess.run([sys.executable, os.path.join(HERE, 'critic.py'), vid, '--timeline', os.path.join(build, 'timeline.json'), '--out', os.path.join(d, 'c')],
                               capture_output=True, text=True)
            report = json.load(open(os.path.join(d, 'c', 'report.json')))
            names = {c['check'] for c in report['checks']}
            self.assertIn('Loudness on target', names)
            self.assertTrue(os.path.exists(os.path.join(d, 'c', 'contact.jpg')))
            self.assertIn(r.returncode, (0, 1))


if __name__ == '__main__':
    unittest.main()
