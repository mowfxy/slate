#!/usr/bin/env node
// Record a real command-line session as a cast: every chunk of output with the time it appeared.
// engine/players/terminal.html plays a cast back (sped up if you like) so record.mjs can film it.
//
// usage: node engine/termcast.mjs --out films/<name>/shots/render.cast.json [--cols 96] -- node engine/render.mjs films/<name> --draft
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT} from './serve.mjs';

const args = process.argv.slice(2);
const dash = args.indexOf('--');
if (dash < 0) { console.error('usage: node engine/termcast.mjs --out cast.json [--cols 96] -- <command...>'); process.exit(1); }
const own = args.slice(0, dash), cmd = args.slice(dash + 1);
const opt = (k, d) => { const i = own.indexOf(`--${k}`); return i >= 0 ? own[i + 1] : d; };
const out = path.resolve(opt('out', 'cast.json'));
const cols = parseInt(opt('cols', '96'), 10);

const t0 = performance.now();
const events = [];
const child = spawn(cmd[0], cmd.slice(1), {cwd: ROOT, env: {...process.env, COLUMNS: String(cols), FORCE_COLOR: '0'}});
const take = (stream) => (d) => { const s = d.toString(); events.push([+((performance.now() - t0) / 1000).toFixed(3), s]); stream.write(s); };
child.stdout.on('data', take(process.stdout));
child.stderr.on('data', take(process.stderr));
child.on('close', (code) => {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify({command: cmd.join(' ').replace(ROOT + '/', ''), cols, code, duration: (performance.now() - t0) / 1000, events}, null, 1));
  console.log(`\n▸ cast -> ${path.relative(process.cwd(), out)} (${events.length} chunks, ${((performance.now() - t0) / 1000).toFixed(1)}s, exit ${code})`);
  process.exit(code ?? 1);
});
