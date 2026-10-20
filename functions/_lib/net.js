// Protecție SSRF + descărcare limitată. Folosit de /api/fetch și /api/probe.
export function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return { error: 'URL invalid' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'Doar http/https' };
  if (u.username || u.password) return { error: 'URL cu credențiale nepermis' };
  if (u.port && !['80', '443'].includes(u.port)) return { error: 'Port nepermis' };
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return { error: 'Gazdă nepermisă' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || /^\[/.test(h)) return { error: 'Adresele IP nu sunt permise' };
  return { url: u };
}
export async function limitedFetch(raw, { maxBytes = 3_000_000, timeout = 10_000, range = false, hops = 5 } = {}) {
  let cur = raw;
  for (let i = 0; i <= hops; i++) {
    const c = checkUrl(cur);
    if (c.error) return { error: c.error };
    const headers = { 'User-Agent': 'AiVenture-Autopilot/1.0 (+audit schema.org si meta)', Accept: '*/*' };
    if (range) headers.Range = `bytes=0-${maxBytes - 1}`;
    let r;
    try { r = await fetch(c.url.href, { redirect: 'manual', headers, signal: AbortSignal.timeout(timeout) }); }
    catch (e) { return { error: 'Nu s-a putut încărca: ' + (e.name === 'TimeoutError' ? 'timp expirat' : 'eroare de rețea') }; }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get('location'); if (!loc) return { error: 'Redirecționare fără destinație' };
      cur = new URL(loc, c.url).href; continue;
    }
    const reader = r.body ? r.body.getReader() : null; const chunks = []; let n = 0;
    if (reader) {
      while (n < maxBytes) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; }
      try { await reader.cancel(); } catch {}
    }
    const buf = new Uint8Array(Math.min(n, maxBytes)); let o = 0;
    for (const ch of chunks) { const t = ch.slice(0, buf.length - o); buf.set(t, o); o += t.length; if (o >= buf.length) break; }
    return { status: r.status, finalUrl: c.url.href, type: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), bytes: buf, length: r.headers.get('content-length') };
  }
  return { error: 'Prea multe redirecționări' };
}
