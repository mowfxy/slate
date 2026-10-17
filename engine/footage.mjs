#!/usr/bin/env node
// Footage that isn't recorded with engine/record.mjs: bring in a video file, or generate one.
//
//   node engine/footage.mjs prepare clip.mp4 --out films/<name>/footage/clip.webm [--from 2.5 --to 9] [--width 1920] [--fps 30]
//       Converts any video (phone footage, a screen recording, a stock or generated clip) into what the
//       renderer can seek frame-accurately: VP9 WebM at the film's frame rate, a keyframe every half second,
//       no audio. Headless Chromium can't decode H.264 MP4, so every non-WebM clip must go through this.
//
//   GEMINI_API_KEY=... node engine/footage.mjs generate "slow push across a desk at dawn, 35mm, shallow focus" --out films/<name>/footage/desk.webm
//       Generates a clip with Google's Veo through the Gemini API, then prepares it as above.
//       [--model veo-3.0-generate-001] [--aspect 16:9] [--negative "text, logos"]
//       Generated footage is for texture and atmosphere. The product itself is always real footage.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function prepare(input, out, {from, to, width = 1920, fps = 30} = {}) {
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  const args = ['-v', 'error', '-y'];
  if (from != null) args.push('-ss', String(from));
  if (to != null) args.push('-to', String(to));
  args.push('-i', input, '-an', '-vf', `scale=${width}:-2:flags=lanczos,fps=${fps}`, '-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0',
    '-g', String(Math.round(fps / 2)), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-pix_fmt', 'yuv420p', out);
  const r = spawnSync('ffmpeg', args, {stdio: 'inherit'});
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${input}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], {encoding: 'utf8'});
  const duration = parseFloat(probe.stdout);
  // the same sidecar record.mjs writes, so F.footage() can read either
  fs.writeFileSync(out.replace(/\.webm$/, '.json'), JSON.stringify({source: path.basename(input), fps, duration, marks: {start: 0}, events: [], rects: {}}, null, 2));
  console.log(`▸ footage -> ${out} (${duration.toFixed(2)}s)`);
}

const API = 'https://generativelanguage.googleapis.com/v1beta';

export async function generate(prompt, out, {model = 'veo-3.0-generate-001', aspect = '16:9', negative} = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to the environment, or record or supply real footage instead.');
  const headers = {'x-goog-api-key': key, 'content-type': 'application/json'};
  const body = {instances: [{prompt}], parameters: {aspectRatio: aspect, ...(negative && {negativePrompt: negative})}};
  let res = await fetch(`${API}/models/${model}:predictLongRunning`, {method: 'POST', headers, body: JSON.stringify(body)});
  if (!res.ok) throw new Error(`Veo request failed: ${res.status} ${await res.text()}`);
  let op = await res.json();
  process.stdout.write(`▸ generating with ${model}`);
  while (!op.done) {
    await new Promise((r) => setTimeout(r, 10000));
    process.stdout.write('.');
    res = await fetch(`${API}/${op.name}`, {headers});
    op = await res.json();
  }
  process.stdout.write('\n');
  if (op.error) throw new Error(`Veo failed: ${JSON.stringify(op.error)}`);
  const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error(`Veo returned no video: ${JSON.stringify(op.response).slice(0, 400)}`);
  const vid = await fetch(uri, {headers: {'x-goog-api-key': key}});
  const tmp = path.join(os.tmpdir(), `veo-${Date.now()}.mp4`);
  fs.writeFileSync(tmp, Buffer.from(await vid.arrayBuffer()));
  prepare(tmp, out);
  fs.writeFileSync(out.replace(/\.webm$/, '.prompt.txt'), `${model}\n${prompt}\n`);
  fs.rmSync(tmp);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, what, ...rest] = process.argv.slice(2);
  const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
  const num = (k) => (opt(k) != null ? parseFloat(opt(k)) : undefined);
  if (cmd === 'prepare' && what) prepare(what, opt('out', what.replace(/\.[^.]+$/, '.webm')), {from: num('from'), to: num('to'), width: num('width') ?? 1920, fps: num('fps') ?? 30});
  else if (cmd === 'generate' && what) await generate(what, opt('out', 'footage/generated.webm'), {model: opt('model'), aspect: opt('aspect'), negative: opt('negative')});
  else { console.error('usage: node engine/footage.mjs prepare <video> --out <file.webm> | generate "<prompt>" --out <file.webm>'); process.exit(1); }
}
