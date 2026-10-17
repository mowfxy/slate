#!/usr/bin/env node
// Render a Slate spec end to end: timeline -> score -> video -> critic.
// usage: node scripts/render.mjs <example-dir|spec.json> [--out file.mp4] [--stills 0,2.5,10] [--no-audio] [--no-critic] [--scale 0.5]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {buildTimeline} from '../src/lib/timeline.mjs';
import {findChrome} from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--no-audio', '--no-critic'].includes(args[i - 1])));
if (!target) {
  console.error('usage: render.mjs <example-dir|spec.json> [--out file.mp4] [--stills 0,2.5] [--no-audio] [--no-critic] [--scale 0.5]');
  process.exit(1);
}
const specPath = fs.statSync(target).isDirectory() ? path.join(target, 'spec.json') : target;
const dir = path.dirname(path.resolve(specPath));
const name = path.basename(dir);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const build = path.join(dir, 'build');
fs.mkdirSync(build, {recursive: true});

// 1. timeline: the single source of truth for cuts and sound
const tl = buildTimeline(spec);
fs.writeFileSync(path.join(build, 'timeline.json'), JSON.stringify(tl, null, 2));
console.log(`▸ ${tl.title}: ${tl.duration.toFixed(2)}s, ${tl.totalFrames} frames @ ${tl.fps}fps, ${tl.scenes.length} scenes, ${tl.bpm} BPM`);

// 2. score: generated from the timeline unless the spec brings its own music
let audio = null;
const stills = opt('stills');
if (!flag('no-audio') && !stills) {
  const py = process.env.PYTHON || 'python3';
  const scoreArgs = [path.join(repo, 'tools/score.py'), path.join(build, 'timeline.json'), '--out', build];
  if (spec.audio?.music) scoreArgs.push('--music', path.join(dir, spec.audio.music), '--offset', String(spec.audio.offset ?? 0));
  if (spec.audio?.lufs) scoreArgs.push('--lufs', String(spec.audio.lufs));
  execFileSync(py, scoreArgs, {stdio: 'inherit'});
  audio = 'build/mix.wav';
}

// 3. video
const chrome = findChrome({headlessShell: true});
const browserExecutable = chrome ?? undefined;
console.log('▸ bundling');
const serveUrl = await bundle({entryPoint: path.join(here, '../src/index.ts'), publicDir: dir});
const inputProps = {spec, audio};
const composition = await selectComposition({serveUrl, id: 'Film', inputProps, browserExecutable});
const scale = Number(opt('scale', 1));

if (stills) {
  const outDir = path.join(build, 'stills');
  fs.mkdirSync(outDir, {recursive: true});
  for (const s of stills.split(',').map(Number)) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(s * tl.fps));
    const output = path.join(outDir, `${name}-${String(s).replace('.', '_')}s.png`);
    await renderStill({composition, serveUrl, frame, output, inputProps, browserExecutable, scale});
    console.log(`  still ${s}s -> ${path.relative(process.cwd(), output)}`);
  }
  process.exit(0);
}

const out = path.resolve(opt('out', path.join(repo, 'out', `${name}.mp4`)));
fs.mkdirSync(path.dirname(out), {recursive: true});
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 18,
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  audioBitrate: '256k',
  outputLocation: out,
  inputProps,
  browserExecutable,
  scale,
  onProgress: ({progress}) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== last) {
      last = pct;
      process.stdout.write(`  rendering ${pct}%\n`);
    }
  },
});
console.log(`▸ video -> ${path.relative(process.cwd(), out)}`);

// 4. critic: watch the cut like an editor would
if (!flag('no-critic')) {
  const py = process.env.PYTHON || 'python3';
  try {
    execFileSync(py, [path.join(repo, 'tools/critic.py'), out, '--timeline', path.join(build, 'timeline.json'), '--out', path.join(build, 'critic')], {stdio: 'inherit'});
  } catch {
    console.error('▸ critic found problems: fix them and render again (see build/critic/report.md)');
    process.exitCode = 1;
  }
}
