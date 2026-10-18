// Finds the Python that has Slate's packages: $PYTHON, then the active virtualenv, then python3 / python / py -3
// on PATH, keeping the first that imports numpy. On Windows `python3` is often the Store stub, outside any venv.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const win = process.platform === 'win32';
// UTF-8 everywhere: the tools print ▸ and ✓, which a cp1252 console cannot encode
// SLATE_TOOLS and PYTHONPATH let a film's own score.py `from synth import Song` from any project
export const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tools');
export const pyEnv = {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', SLATE_TOOLS: TOOLS,
  PYTHONPATH: [TOOLS, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)};

let found;
export function findPython() {
  if (found) return found;
  if (process.env.PYTHON) return (found = [process.env.PYTHON]);
  const tries = [];
  if (process.env.VIRTUAL_ENV) tries.push([path.join(process.env.VIRTUAL_ENV, win ? 'Scripts/python.exe' : 'bin/python')]);
  tries.push(['python3'], ['python']);
  if (win) tries.push(['py', '-3']);
  for (const t of tries) {
    if (t[0].includes(path.sep) && !fs.existsSync(t[0])) continue;
    const r = spawnSync(t[0], [...t.slice(1), '-c', 'import numpy'], {stdio: 'ignore', env: pyEnv});
    if (r.status === 0) return (found = t);
  }
  return (found = [win ? 'python' : 'python3']);  // let the spawn fail with the usual message
}
