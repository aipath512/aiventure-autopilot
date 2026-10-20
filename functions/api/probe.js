import { limitedFetch } from '../_lib/net.js';
import { sniffImage } from '../_lib/imgsize.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function onRequestGet({ request }) {
  const urls = (new URL(request.url).searchParams.get('urls') || '').split('|').filter(Boolean).slice(0, 14);
  if (!urls.length) return json({ error: 'Lipsește urls' }, 400);
  const out = {};
  await Promise.all(urls.map(async (u) => {
    const r = await limitedFetch(u, { maxBytes: 65536, range: true, timeout: 8000 });
    if (r.error) { out[u] = { ok: false, error: r.error }; return; }
    const img = sniffImage(r.bytes);
    out[u] = { ok: r.status >= 200 && r.status < 300, status: r.status, type: img ? img.type : r.type, w: img ? img.w : null, h: img ? img.h : null, finalUrl: r.finalUrl };
  }));
  return json(out);
}
