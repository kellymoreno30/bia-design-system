const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.ts':   'application/typescript',
  '.tsx':  'application/typescript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Redirect / to the real path so relative links (<link href="../core/...">)
  // resolve correctly from the browser's perspective.
  if (url === '/') {
    res.writeHead(302, { Location: '/packages/docs/token-inspector.html' });
    res.end();
    return;
  }

  const filePath = path.join(ROOT, url);

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + url);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  🚀 BIA Token Inspector running at:\n`);
  console.log(`     http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
