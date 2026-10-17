// Footage frames for a render: every clip in films/<name>/footage/ extracted once to build/frames/<clip>/
// (JPEG per frame plus meta.json). The runtime draws these instead of seeking <video>, which is not
// frame-exact in Chromium (see useFrames in runtime/slate.js). Re-extracts only when a clip changes.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export function extractFrames(filmDir, build, log = console.log) {
  const dir = path.join(filmDir, 'footage');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter((x) => /\.(webm|mp4|mov)$/i.test(x))) {
    const src = path.join(dir, f), out = path.join(build, 'frames', f.replace(/\.\w+$/, '')), meta = path.join(out, 'meta.json');
    if (fs.existsSync(meta) && fs.statSync(meta).mtimeMs > fs.statSync(src).mtimeMs) continue;
    fs.rmSync(out, {recursive: true, force: true});
    fs.mkdirSync(out, {recursive: true});
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height', '-of', 'json', src], {encoding: 'utf8'});
    const st = JSON.parse(probe.stdout).streams[0];
    const [n, d] = st.r_frame_rate.split('/').map(Number);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-fps_mode', 'passthrough', '-q:v', '2', path.join(out, '%06d.jpg')], {stdio: 'inherit'});
    if (r.status !== 0) { console.error(`▸ could not extract frames from ${f}; it will play by seeking`); continue; }
    const count = fs.readdirSync(out).filter((x) => x.endsWith('.jpg')).length;
    fs.writeFileSync(meta, JSON.stringify({fps: n / (d || 1), count, width: st.width, height: st.height}));
    log(`footage ${f}: ${count} frames @ ${(n / (d || 1)).toFixed(2)} fps`);
  }
}
