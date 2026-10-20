import { limitedFetch } from '../_lib/net.js';
// \u003c / \u003e în loc de < / >: JSON rămâne valid, dar HTML-ul nu mai este „curățat” de proxy-uri sau unelte intermediare.
const json = (o, s = 200) => new Response(JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e'), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams; const url = q.get('url'); const kind = q.get('kind') || 'html';
  if (!url) return json({ error: 'Lipsește url' }, 400);
  const r = await limitedFetch(url);
  if (r.error) return json({ error: r.error }, 400);
  const okType = kind === 'sitemap' ? /xml|text\/plain/ : /html|xhtml/;
  if (!okType.test(r.type)) return json({ error: 'Tip de conținut neașteptat: ' + (r.type || 'necunoscut'), status: r.status, finalUrl: r.finalUrl }, 415);
  return json({ status: r.status, finalUrl: r.finalUrl, type: r.type, text: new TextDecoder('utf-8').decode(r.bytes) });
}
