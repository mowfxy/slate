// Static server for previews and renders. Serves the site (the project the films live in) at /, and Slate's own
// engine at /engine/ wherever Slate is installed, so a film in any project can import /engine/...
// usage: node engine/serve.mjs [port]   (from the project; SLATE_SITE overrides) then open http://localhost:4173/films/<name>/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream'};

const inside = (dir, f) => { const r = path.relative(dir, f); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

// the folder served at /: the one holding the film (Slate's own repo, the project, or the film's grandparent)
export function siteFor(filmDir) {
  if (process.env.SLATE_SITE) return path.resolve(process.env.SLATE_SITE);
  if (!filmDir) return process.cwd();
  if (inside(ROOT, filmDir)) return ROOT;
  if (inside(process.cwd(), filmDir)) return process.cwd();
  return path.dirname(path.dirname(filmDir));
}

export function serve(port = 0, site = siteFor()) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const base = p.startsWith('/engine/') ? ROOT : site;
    const file = path.join(base, p);
    if (!inside(base, file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    // bare imports (gsap, three) resolve through each film's import map to /engine/node_modules
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const size = fs.statSync(file).size;
    // byte ranges: without them the browser can't seek video, and every clip sits on its first frame
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : Math.max(0, size - parseInt(range[2], 10));
      const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
      if (start >= size || start > end) { res.writeHead(416, {'content-range': `bytes */${size}`}); return res.end(); }
      res.writeHead(206, {'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-store'});
      return fs.createReadStream(file, {start, end}).pipe(res);
    }
    res.writeHead(200, {'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({server, url: `http://127.0.0.1:${server.address().port}`})));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = siteFor();
  const {url} = await serve(parseInt(process.argv[2] || '4173', 10), site);
  console.log(`▸ Slate preview of ${site} at ${url}/films/<name>/  (space: play/pause, ←/→: step a frame)`);
}
