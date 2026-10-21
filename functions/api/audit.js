// GET /api/audit?url=<homepage>  →  scor compact + verificările care pică (pentru ecranul Rețea).
import { limitedFetch } from '../_lib/net.js';
import { sniffImage } from '../_lib/imgsize.js';
import { parsePage, audit, GROUPS } from '../../public/scorer.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url') || '';
  const r = await limitedFetch(target, { maxBytes: 3_000_000, timeout: 12_000 });
  if (r.error) return json({ url: target, state: 'eroare', error: r.error });
  if (r.status >= 400) return json({ url: target, state: 'eroare', status: r.status, error: 'HTTP ' + r.status });
  if (!/html/.test(r.type)) return json({ url: target, state: 'eroare', status: r.status, type: r.type, error: 'Răspunsul nu este HTML (' + (r.type || 'fără tip') + ')' });
  const html = new TextDecoder('utf-8').decode(r.bytes);
  const page = parsePage(html, r.finalUrl);
  const urls = new Set(); const add = (u) => { try { urls.add(new URL(u, page.url).href); } catch {} };
  if (page.meta('og:image')) add(page.meta('og:image'));
  page.links.filter((l) => /icon|manifest/i.test(l.a.rel || '')).forEach((l) => l.a.href && add(l.a.href));
  const probe = {};
  await Promise.all([...urls].slice(0, 12).map(async (u) => {
    const p = await limitedFetch(u, { maxBytes: 65536, range: true, timeout: 8000 });
    if (p.error) { probe[u] = { ok: false, error: p.error }; return; }
    const img = sniffImage(p.bytes);
    probe[u] = { ok: p.status >= 200 && p.status < 300, status: p.status, type: img ? img.type : p.type, w: img ? img.w : null, h: img ? img.h : null, finalUrl: p.finalUrl };
  }));
  const a = audit(page, { sitemapUrls: null, probe, assume: new Set() });
  const groups = {};
  for (const g of GROUPS) { const f = a.checks.filter((x) => x.group === g.id); groups[g.id] = { bad: f.filter((x) => x.pass === false).length, total: f.length }; }
  return json({ url: target, finalUrl: r.finalUrl, state: 'ok', status: r.status, score: a.score, groups, fails: a.checks.filter((x) => x.pass === false).map((x) => ({ g: x.group, id: x.id, label: x.label, detail: x.detail })) });
}
