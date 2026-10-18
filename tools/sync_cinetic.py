#!/usr/bin/env python3
"""Vendor cinetic (MIT, Leonxlnx) into skills/cinetic from a checkout of the mowfxy/cinetic fork, and apply
Slate's two edits: a narrower description (launch-video is the plugin's entry point; cinetic is its
Remotion/HyperFrames engine) and a note on where its paths start inside the plugin.

  git -C ../cinetic fetch upstream && git -C ../cinetic merge upstream/main     # bring the fork up to date
  python3 tools/sync_cinetic.py ../cinetic                                        # copy and patch
  node skills/cinetic/scripts/test/lint-film.test.mjs                             # then run its tests

Also refreshes docs/cinetic-*.md and evals/cinetic-evals.json, and records the vendored commit in
skills/cinetic/VENDORED.
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DESCRIPTION = (
    "The Remotion and HyperFrames engines for Slate's launch-video director, from cinetic: logo stings with "
    "ProRes 4444 alpha versions, seamless landing-page loops with GIF and WebM, UI walkthroughs with SRT captions, "
    "9:16 and 1:1 re-layouts from one timeline, films built from the person's React components or in an existing "
    "Remotion or HyperFrames project, and invented brands with a full brand kit. Also holds the 273-technique "
    "library (pick.py), the generated-look lint, pixel forensics, the A/V audit and delivery scripts that "
    "launch-video runs on every film. Use when launch-video chooses a cinetic engine, when someone asks for "
    "Remotion, HyperFrames or cinetic by name, or to review or fix an existing Remotion film."
)

NOTE = (
    "> **Inside the Slate plugin.** This skill's root is `${CLAUDE_SKILL_DIR}`: every `scripts/…`, `assets/…` and "
    "`references/…` path below starts there (`bash ${CLAUDE_SKILL_DIR}/scripts/new-film.sh …`), until "
    "`new-film.sh` has copied the scripts into the film project. `launch-video` directs; this skill builds. "
    "Setup: `${CLAUDE_PLUGIN_ROOT}/docs/cinetic-setup.md`. On Windows run the bash scripts from Git Bash or WSL.\n"
)


def patch(text):
    text = re.sub(r'^description: .*$', 'description: ' + DESCRIPTION, text, count=1, flags=re.M)
    if 'Inside the Slate plugin' not in text:
        text = re.sub(r'^(# cinetic\n\n)', r'\1' + NOTE.replace('\\', '\\\\') + '\n', text, count=1, flags=re.M)
    return text.replace('install earshot (`docs/setup.md`)', 'install earshot (`${CLAUDE_PLUGIN_ROOT}/docs/cinetic-setup.md`)')


def main():
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'cinetic'))
    skill = os.path.join(src, 'skills', 'cinetic')
    if not os.path.isfile(os.path.join(skill, 'SKILL.md')):
        sys.exit(f'no cinetic checkout at {src}')
    dst = os.path.join(ROOT, 'skills', 'cinetic')
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(skill, dst, ignore=shutil.ignore_patterns('node_modules', '__pycache__', '*.pyc'))
    p = os.path.join(dst, 'SKILL.md')
    with open(p, encoding='utf-8') as f:
        text = patch(f.read())
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    for a, b in [('docs/setup.md', 'docs/cinetic-setup.md'), ('docs/evaluation.md', 'docs/cinetic-evaluation.md'),
                 ('CHANGELOG.md', 'docs/cinetic-CHANGELOG.md'), ('evals/evals.json', 'evals/cinetic-evals.json')]:
        os.makedirs(os.path.dirname(os.path.join(ROOT, b)), exist_ok=True)
        shutil.copyfile(os.path.join(src, a), os.path.join(ROOT, b))
    rev = subprocess.run(['git', '-C', src, 'describe', '--tags', '--always'], capture_output=True, text=True).stdout.strip()
    with open(os.path.join(dst, 'VENDORED'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'cinetic {rev or "unknown"} from {src.replace(os.sep, "/").split("/")[-1]} '
                '(https://github.com/mowfxy/cinetic, a fork of https://github.com/Leonxlnx/cinetic). MIT: see LICENSE.txt.\n')
    print(f'▸ vendored cinetic {rev} into skills/cinetic')


if __name__ == '__main__':
    main()
