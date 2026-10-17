// Static server for previews and renders. Serves the repo root so films can import /engine/...
// usage: node engine/serve.mjs [port]   then open http://localhost:4173/films/<name>/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream'};

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
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
  const {url} = await serve(parseInt(process.argv[2] || '4173', 10));
  console.log(`▸ Slate preview at ${url}/films/<name>/  (space: play/pause, ←/→: step a frame)`);
}
