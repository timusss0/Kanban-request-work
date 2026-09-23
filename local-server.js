// Small server for running the app locally (npm run dev) and on Hostinger (npm start)
// Mimics how Vercel runs api/tickets.js and serves the public/ folder
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import handler from './api/tickets.js';

const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const root = path.resolve('public');

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API route
  if (url.pathname === '/api/tickets') {
    let raw = '';
    for await (const chunk of req) raw += chunk;

    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }

    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    };

    try {
      return await handler(req, res);
    } catch (err) {
      console.error('API error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  // Static files from public/
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end('Forbidden');

  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(PORT, () => console.log(`Open http://localhost:${PORT}`));