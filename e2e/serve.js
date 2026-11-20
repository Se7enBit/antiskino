// Serves the web export (dist/) like GitHub Pages does under /antiskino:
// /c/demo-thalassa → c/demo-thalassa.html, unknown paths → 404.html.
// Usage: node e2e/serve.js [port]
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(process.cwd(), 'dist');
const base = '/antiskino';
const port = Number(process.argv[2] ?? 8081);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

function resolve(urlPath) {
  const relative = decodeURIComponent(urlPath).slice(base.length) || '/';
  const file = path.normalize(path.join(root, relative));
  if (!file.startsWith(root)) return null;
  for (const candidate of [file, `${file}.html`, path.join(file, 'index.html')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

http
  .createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    const file = urlPath.startsWith(base) ? resolve(urlPath) : null;
    const target = file ?? path.join(root, '404.html');
    res.writeHead(file ? 200 : 404, {
      'content-type': types[path.extname(target)] ?? 'application/octet-stream',
    });
    fs.createReadStream(target).pipe(res);
  })
  .listen(port, '127.0.0.1');
