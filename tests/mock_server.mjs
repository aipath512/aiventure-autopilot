// Server local de test: servește public/ și simulează /api/* pe baza unui site local (ca să nu depindă de internet).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { sniffImage } from '../functions/_lib/imgsize.js';
const SITE = path.resolve(process.argv[2]); const PORT = Number(process.argv[3] || 8799); const PUB = path.resolve('public');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const fileFor = (u) => { const p = new URL(u).pathname; const f = path.join(SITE, p.endsWith('/') ? p + 'index.html' : p); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const J = (o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/api/fetch') { const f = fileFor(u.searchParams.get('url')); if (!f) return J({ error: 'Nu s-a găsit' }, 400); return J({ status: 200, finalUrl: u.searchParams.get('url'), type: 'text/html', text: fs.readFileSync(f, 'utf8') }); }
  if (u.pathname === '/api/probe') { const out = {}; for (const x of (u.searchParams.get('urls') || '').split('|')) { const f = fileFor(x); if (!f) { out[x] = { ok: false, status: 404 }; continue; } const i = sniffImage(fs.readFileSync(f).subarray(0, 65536)); out[x] = { ok: true, status: 200, type: i?.type || 'x', w: i?.w ?? null, h: i?.h ?? null }; } return J(out); }
  const f = path.join(PUB, u.pathname === '/' ? 'index.html' : u.pathname);
  if (f.startsWith(PUB) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nu există');
}).listen(PORT, () => console.log('mock pe ' + PORT));
