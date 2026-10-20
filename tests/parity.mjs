// Rulare: node tests/parity.mjs <rădăcina-site-ului> [origin]
// Verifică motorul pe un site local: fiecare pagină HTML, cu fișierele referite luate de pe disc.
import fs from 'node:fs'; import path from 'node:path';
import { audit, parsePage } from '../public/scorer.js';
import { sniffImage } from '../functions/_lib/imgsize.js';
const root = path.resolve(process.argv[2]); const origin = process.argv[3] || 'https://firmsfinder.eu';
const sm = fs.existsSync(root + '/sitemap.xml') ? new Set([...fs.readFileSync(root + '/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) : null;
const skip = new Set(['homepage-link.html', '404.html', 'utm/index.html']);
function walk(d, o = []) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === '.git' || f.name === 'node_modules') continue; const p = path.join(d, f.name); f.isDirectory() ? walk(p, o) : p.endsWith('.html') && o.push(p); } return o; }
let tot = 0, n = 0; const fails = {};
for (const f of walk(root).sort()) {
  const rel = path.relative(root, f); if (skip.has(rel)) continue;
  const url = origin + '/' + rel.replace(/index\.html$/, '');
  const page = parsePage(fs.readFileSync(f, 'utf8'), url);
  const probe = {};
  const need = [page.meta('og:image'), ...page.links.map((l) => l.a.href)].filter(Boolean);
  for (const u of need) { try { const a = new URL(u, url); if (a.origin !== origin) continue; const p = path.join(root, a.pathname); if (fs.existsSync(p) && fs.statSync(p).isFile()) { const img = sniffImage(fs.readFileSync(p).subarray(0, 65536)); probe[a.href] = { ok: true, w: img?.w ?? null, h: img?.h ?? null, type: img?.type }; } } catch {} }
  const a = audit(page, { sitemapUrls: sm, probe });
  tot += a.score; n++;
  for (const c of a.checks) if (c.pass === false) (fails[c.id] ||= []).push(rel);
}
console.log(`pagini=${n} scor mediu=${(tot / n).toFixed(1)}`);
for (const [k, v] of Object.entries(fails).sort((a, b) => b[1].length - a[1].length)) console.log(`  PICAT ${String(v.length).padStart(2)}/${n}  ${k}`, v.length <= 3 ? v.join(', ') : '');
