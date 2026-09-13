// Static dev server with HTTP Range support (Python's http.server has none, and a <video> cannot seek — or reach `ended` early — without it).
// usage: node tools/serve.mjs [port=8766] [root=.]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const port = +(process.argv[2] || 8766), root = path.resolve(process.argv[3] || '.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.md': 'text/markdown' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  const size = fs.statSync(file).size, type = types[path.extname(file).toLowerCase()] || 'application/octet-stream', range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1, status = 200;
  if (range && (range[1] || range[2])) { start = range[1] ? +range[1] : size - +range[2]; end = range[2] && range[1] ? Math.min(+range[2], size - 1) : size - 1; if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); } status = 206; }
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' }; if (status === 206) head['Content-Range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(status, head); if (req.method === 'HEAD') return res.end(); fs.createReadStream(file, { start, end }).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}/ (ranges on)`));
