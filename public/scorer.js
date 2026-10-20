// AiVenture Autopilot — motor de scor + propuneri de corecție (reguli, fără AI).
// Aceleași 38 de verificări folosite la auditul FirmsFinder.eu (28 meta + 10 schema.org).
// Funcționează în browser și în Node (fără DOM).

export const VERSION = '1.0';

/* ───────────── parsare ───────────── */
const ENT = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const unent = (s) => (s || '').replace(/&(amp|quot|#39|lt|gt);/g, (m) => ENT[m]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function tags(src, name) {
  const out = []; const re = new RegExp('<' + name + '\\b([^>]*)>', 'gi'); let m;
  while ((m = re.exec(src))) {
    const a = {}; let x; ATTR.lastIndex = 0;
    while ((x = ATTR.exec(m[1]))) a[x[1].toLowerCase()] = unent(x[2] !== undefined ? x[2] : x[3]);
    out.push({ raw: m[0], index: m.index, a });
  }
  return out;
}
const headOf = (html) => { const i = html.search(/<\/head>/i); return i >= 0 ? html.slice(0, i) : html.slice(0, 30000); };

export function parsePage(html, url) {
  const head = headOf(html);
  const metas = tags(head, 'meta'); const links = tags(head, 'link');
  const tm = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const hm = html.match(/<html\b[^>]*>/i);
  const lang = hm ? (hm[0].match(/\blang\s*=\s*["']([^"']+)["']/i) || [])[1] || '' : '';
  const meta = (k) => { const t = metas.find((m) => m.a.property === k || m.a.name === k); return t && t.a.content !== undefined ? t.a.content : null; };
  const canon = links.find((l) => (l.a.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  const blocks = []; const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { try { blocks.push({ ok: true, data: JSON.parse(m[1]) }); } catch { blocks.push({ ok: false }); } }
  return {
    url, html, head, metas, links, meta,
    title: tm ? unent(tm[1].replace(/\s+/g, ' ').trim()) : '',
    lang, canonical: canon ? canon.a.href : null, blocks,
    hasCharset: /<meta[^>]+charset\s*=/i.test(head) || /http-equiv\s*=\s*["']content-type/i.test(head),
  };
}

function nodesOf(blocks) {
  const out = [];
  for (const b of blocks) if (b.ok && b.data && typeof b.data === 'object') {
    const d = b.data; const arr = Array.isArray(d) ? d : d['@graph'] ? d['@graph'] : [d];
    for (const n of arr) if (n && typeof n === 'object') out.push(n);
  }
  return out;
}
const typesOf = (n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]);
const WP = ['WebPage', 'CollectionPage', 'AboutPage', 'ContactPage', 'ProfilePage'];

function collectIds(o, defined, refs) {
  if (Array.isArray(o)) { o.forEach((v) => collectIds(v, defined, refs)); return; }
  if (o && typeof o === 'object') {
    if (typeof o['@id'] === 'string') (Object.keys(o).length > 1 ? defined : refs).add(o['@id']);
    Object.values(o).forEach((v) => collectIds(v, defined, refs));
  }
}
function collectUrls(o, acc) {
  if (Array.isArray(o)) { o.forEach((v) => collectUrls(v, acc)); return; }
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && ['url', 'usageInfo', 'termsOfService', 'publishingPrinciples', '@id'].includes(k)) acc.push(v);
      else collectUrls(v, acc);
    }
  }
}
const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const isSlashy = (path) => !/\.[a-z0-9]{1,6}$/i.test(path.split('/').pop() || '');

/* ───────────── verificările (38) ───────────── */
export const GROUPS = [
  { id: 'titlu', label: 'Titlu și descriere' },
  { id: 'baza', label: 'Canonical, robots, limbă, viewport' },
  { id: 'og', label: 'Open Graph (text)' },
  { id: 'ogimg', label: 'Imaginea Open Graph' },
  { id: 'tw', label: 'Twitter Card' },
  { id: 'icon', label: 'Iconuri și manifest' },
  { id: 'theme', label: 'Culoarea temei' },
  { id: 'schema', label: 'Schema.org (JSON-LD)' },
];

// ctx: { sitemapUrls:Set|null, probe:{url:{ok,type,w,h}}, assume:Set }
export function audit(page, ctx = {}) {
  const probe = ctx.probe || {}; const assume = ctx.assume || new Set();
  const abs = (u) => { try { return new URL(u, page.url).href; } catch { return null; } };
  const fileOk = (u) => { const a = abs(u); return !!a && (assume.has(a) || !!(probe[a] && probe[a].ok)); };
  const checks = []; const add = (id, group, label, pass, detail = '') => checks.push({ id, group, label, pass, detail });
  const P = page; const m = P.meta;
  const t = P.title; const d = m('description') || '';
  add('title', 'titlu', 'Titlu 15–65 caractere', t.length >= 15 && t.length <= 65, `${t.length} caractere`);
  add('desc', 'titlu', 'Descriere 70–170 caractere', d.length >= 70 && d.length <= 170, `${d.length} caractere`);
  const can = P.canonical;
  add('canon', 'baza', 'Canonical prezent', !!can, can || 'lipsește');
  if (ctx.sitemapUrls) add('canon_sm', 'baza', 'Canonical apare în sitemap', !!can && ctx.sitemapUrls.has(can), can || '');
  else add('canon_sm', 'baza', 'Canonical apare în sitemap', null, 'sitemap indisponibil, verificare omisă');
  add('robots', 'baza', 'Meta robots', !!m('robots'));
  add('lang', 'baza', 'Atributul lang pe <html>', !!P.lang);
  add('vp', 'baza', 'Viewport și charset', P.metas.some((x) => x.a.name === 'viewport') && P.hasCharset);
  for (const k of ['og:title', 'og:description', 'og:url', 'og:type', 'og:locale', 'og:site_name']) add(k, 'og', k, !!m(k));
  add('og:image', 'ogimg', 'og:image prezent', !!m('og:image'));
  add('og:image:alt', 'ogimg', 'og:image:alt prezent', !!m('og:image:alt'));
  add('og:dims', 'ogimg', 'og:image 1200×630 declarat', m('og:image:width') === '1200' && m('og:image:height') === '630');
  const oi = m('og:image') ? abs(m('og:image')) : null; const pr = oi ? probe[oi] : null;
  const extOk = !!oi && /\.(jpe?g|png)(\?|$)/i.test(oi);
  const realOk = !pr || !pr.w || (pr.w === 1200 && pr.h === 630);
  add('og:file', 'ogimg', 'Fișierul og:image există, jpg/png, 1200×630', !!oi && fileOk(m('og:image')) && extOk && realOk,
    !oi ? 'lipsește' : !fileOk(m('og:image')) ? 'fișierul nu a putut fi încărcat' : !extOk ? 'format nepotrivit (folosiți jpg sau png)' : !realOk ? `dimensiune reală ${pr.w}×${pr.h}` : '');
  add('og:url=can', 'og', 'og:url = canonical', !!can && m('og:url') === can, `${m('og:url') || '—'}`);
  add('tw:card', 'tw', 'twitter:card = summary_large_image', m('twitter:card') === 'summary_large_image');
  for (const k of ['twitter:title', 'twitter:description', 'twitter:image']) add(k, 'tw', k, !!m(k));
  const lk = (f) => P.links.some(f);
  const rel = (l, r) => (l.a.rel || '').toLowerCase().split(/\s+/).includes(r);
  const ic = [
    ['icon_ico', 'favicon.ico', (l) => rel(l, 'icon') && /\.ico(\?|$)/i.test(l.a.href || '')],
    ['icon_svg', 'favicon.svg', (l) => rel(l, 'icon') && (l.a.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(l.a.href || ''))],
    ['icon_32', 'PNG 32×32', (l) => rel(l, 'icon') && l.a.sizes === '32x32'],
    ['icon_16', 'PNG 16×16', (l) => rel(l, 'icon') && l.a.sizes === '16x16'],
    ['icon_apple', 'apple-touch-icon', (l) => rel(l, 'apple-touch-icon')],
    ['icon_manifest', 'manifest', (l) => rel(l, 'manifest')],
  ];
  for (const [id, label, f] of ic) {
    const l = P.links.find(f);
    add(id, 'icon', 'Icon ' + label, !!l && fileOk(l.a.href), !l ? 'eticheta lipsește' : fileOk(l.a.href) ? '' : 'fișierul nu a putut fi încărcat: ' + l.a.href);
  }
  add('theme', 'theme', 'theme-color', !!m('theme-color'));

  // schema
  const jsonOk = P.blocks.length > 0 && P.blocks.every((b) => b.ok);
  add('ld:valid', 'schema', 'JSON-LD prezent și valid', jsonOk, P.blocks.length ? (jsonOk ? '' : 'bloc JSON invalid') : 'lipsește');
  const nodes = nodesOf(P.blocks);
  add('ld:graph', 'schema', '@context schema.org și @graph', jsonOk && P.blocks.every((b) => b.data && typeof b.data['@context'] === 'string' && /schema\.org/.test(b.data['@context'])) && P.blocks.some((b) => b.data && b.data['@graph']));
  const wps = nodes.filter((n) => typesOf(n).some((x) => WP.includes(x)));
  add('ld:wp', 'schema', 'WebPage cu url = canonical', wps.length > 0 && !!can && wps.every((n) => n.url === can));
  const types = new Set(nodes.flatMap(typesOf));
  const ldText = JSON.stringify(P.blocks.map((b) => b.data || null));
  add('ld:siteorg', 'schema', 'WebSite și Organization', types.has('WebSite') && (types.has('Organization') || /"publisher"/.test(ldText)));
  const home = can ? new URL(can).pathname === '/' : new URL(P.url).pathname === '/';
  add('ld:crumb', 'schema', 'BreadcrumbList (pagini interioare)', home || types.has('BreadcrumbList'));
  const defined = new Set(); const refs = new Set(); collectIds(P.blocks.map((b) => b.data), defined, refs);
  const org = originOf(can || P.url);
  const unresolved = [...refs].filter((r) => !defined.has(r) && originOf(r) === org);
  add('ld:ids', 'schema', 'Toate referințele @id se rezolvă', unresolved.length === 0, unresolved.slice(0, 3).join(', '));
  const urls = []; collectUrls(P.blocks.map((b) => b.data), urls);
  const slashy = !!can && can.endsWith('/');
  const bad = slashy ? urls.map((u) => u.split('#')[0]).filter((u) => originOf(u) === org && new URL(u).pathname !== '/' && !u.endsWith('/') && isSlashy(new URL(u).pathname)) : [];
  add('ld:slash', 'schema', 'URL-urile interne din schema folosesc slash final', bad.length === 0, [...new Set(bad)].slice(0, 3).join(', '));
  add('ld:lang', 'schema', 'inLanguage pe WebPage', wps.length > 0 && wps.every((n) => !!n.inLanguage));
  const ds = nodes.filter((n) => typesOf(n).includes('Dataset'));
  add('ld:license', 'schema', 'License pe seturile de date', ds.every((n) => !!n.license), ds.filter((n) => !n.license).map((n) => n['@id'] || n.name).slice(0, 3).join(', '));
  const topIds = nodes.map((n) => n['@id']).filter(Boolean);
  add('ld:dup', 'schema', 'Fără @id duplicat', topIds.length === new Set(topIds).size);

  const scored = checks.filter((c) => c.pass !== null);
  const passed = scored.filter((c) => c.pass).length;
  return { score: scored.length ? Math.round((1000 * passed) / scored.length) / 10 : 0, passed, total: scored.length, skipped: checks.length - scored.length, checks };
}

/* ───────────── editare HTML ───────────── */
function insertHead(html, snippet) {
  const i = html.search(/<\/head>/i); if (i < 0) return html;
  return html.slice(0, i) + snippet + '\n' + html.slice(i);
}
function replaceOrInsert(html, matcher, tagHtml) {
  // înlocuiește prima etichetă potrivită din head, șterge restul; dacă nu există, o inserează.
  const found = tags(headOf(html), tagHtml.startsWith('<meta') ? 'meta' : 'link').filter(matcher);
  if (!found.length) return insertHead(html, tagHtml);
  let out = html;
  for (let i = found.length - 1; i >= 0; i--) { const f = found[i]; out = out.slice(0, f.index) + (i === 0 ? tagHtml : '') + out.slice(f.index + f.raw.length); }
  return out;
}
export function applyOps(html, ops) {
  let out = html;
  for (const op of ops) {
    if (op.op === 'meta') {
      const attr = op.attr || (/^og:/.test(op.key) ? 'property' : 'name');
      out = replaceOrInsert(out, (t) => t.a.property === op.key || t.a.name === op.key, `<meta ${attr}="${op.key}" content="${esc(op.content)}">`);
    } else if (op.op === 'charset') {
      if (!/<meta[^>]+charset\s*=/i.test(headOf(out))) out = out.replace(/<head\b[^>]*>/i, (h) => h + '\n<meta charset="utf-8">');
    } else if (op.op === 'title') {
      if (/<title[^>]*>[\s\S]*?<\/title>/i.test(headOf(out))) out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(op.content).replace(/&quot;/g, '"')}</title>`);
      else out = insertHead(out, `<title>${esc(op.content).replace(/&quot;/g, '"')}</title>`);
    } else if (op.op === 'lang') {
      out = out.replace(/<html\b([^>]*)>/i, (m0, a) => (/\blang\s*=/.test(a) ? `<html${a.replace(/\blang\s*=\s*(["'])[^"']*\1/i, `lang="${op.content}"`)}>` : `<html lang="${op.content}"${a}>`));
    } else if (op.op === 'link') {
      const key = op.key; // ex. "icon:32x32", "canonical", "manifest"
      const [rel0, sizes] = key.split(':');
      const attrs = Object.entries(op.attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
      out = replaceOrInsert(out, (t) => {
        const rels = (t.a.rel || '').toLowerCase().split(/\s+/);
        if (!rels.includes(rel0)) return false;
        if (rel0 === 'icon') {
          if (sizes === 'ico') return /\.ico(\?|$)/i.test(t.a.href || '');
          if (sizes === 'svg') return t.a.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(t.a.href || '');
          return t.a.sizes === sizes;
        }
        return true;
      }, `<link rel="${rel0}" ${attrs}>`);
    } else if (op.op === 'jsonld') {
      const body = `<script type="application/ld+json">\n${JSON.stringify(op.data, null, 2)}\n</script>`;
      const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi;
      if (re.test(out)) { re.lastIndex = 0; let done = false; out = out.replace(re, () => (done ? '' : ((done = true), body + '\n'))); }
      else out = insertHead(out, body);
    }
  }
  return out;
}

/* ───────────── propuneri (reguli) ───────────── */
const cut = (s, max) => { s = s.replace(/\s+/g, ' ').trim(); if (s.length <= max) return s; const c = s.slice(0, max - 1); return c.slice(0, c.lastIndexOf(' ') > max * 0.6 ? c.lastIndexOf(' ') : max - 1).replace(/[,;:\s-]+$/, '') + '…'; };
const textOf = (h) => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function firstParagraph(html) {
  const body = html.slice(html.search(/<body/i) >= 0 ? html.search(/<body/i) : 0);
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi; let m;
  while ((m = re.exec(body))) { const t = unent(textOf(m[1])); if (t.length >= 70) return t; }
  return '';
}
const h1Of = (html) => { const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i); return m ? unent(textOf(m[1])) : ''; };
const siteName = (P) => P.meta('og:site_name') || new URL(P.url).hostname.replace(/^www\./, '');
function guessLang(P) {
  if (P.lang) return P.lang;
  const loc = P.meta('og:locale'); if (loc) return loc.split(/[_-]/)[0].toLowerCase();
  return /[ăâîșț]/i.test(textOf(P.html).slice(0, 4000)) ? 'ro' : 'en';
}
const LOC = { ro: 'ro_RO', en: 'en_US', fr: 'fr_FR', de: 'de_DE', es: 'es_ES', it: 'it_IT' };
export function normalizeCanonical(url) {
  const u = new URL(url); u.hash = ''; ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((k) => u.searchParams.delete(k));
  if (!u.search && isSlashy(u.pathname) && !u.pathname.endsWith('/')) u.pathname += '/';
  return u.href;
}
const STD_ICONS = {
  'icon:ico': { href: '/favicon.ico', sizes: 'any', file: '/favicon.ico' },
  'icon:svg': { href: '/favicon.svg', type: 'image/svg+xml', file: '/favicon.svg' },
  'icon:32x32': { href: '/favicon-32x32.png', type: 'image/png', sizes: '32x32', file: '/favicon-32x32.png' },
  'icon:16x16': { href: '/favicon-16x16.png', type: 'image/png', sizes: '16x16', file: '/favicon-16x16.png' },
  'apple-touch-icon': { href: '/apple-touch-icon.png', sizes: '180x180', file: '/apple-touch-icon.png' },
  manifest: { href: '/site.webmanifest', file: '/site.webmanifest' },
};

function buildGraph(P, can, lang, inputs) {
  const origin = originOf(can); const home = new URL(can).pathname === '/';
  let nodes = nodesOf(P.blocks).map((n) => JSON.parse(JSON.stringify(n)));
  const seen = new Set(); nodes = nodes.filter((n) => { if (!n['@id']) return true; if (seen.has(n['@id'])) return false; seen.add(n['@id']); return true; });
  const has = (ty) => nodes.find((n) => typesOf(n).includes(ty));
  const notes = [];
  let orgNode = has('Organization');
  if (!orgNode) { orgNode = { '@type': 'Organization', '@id': origin + '/#organization', name: siteName(P), url: origin + '/' }; nodes.unshift(orgNode); }
  const orgId = orgNode['@id'] || origin + '/#organization';
  let site = has('WebSite');
  if (!site) { site = { '@type': 'WebSite', '@id': origin + '/#website', url: origin + '/', name: siteName(P), inLanguage: lang, publisher: { '@id': orgId } }; nodes.push(site); }
  const siteId = site['@id'] || origin + '/#website';
  const wps = nodes.filter((n) => typesOf(n).some((x) => WP.includes(x)));
  const title = P.meta('og:title') || P.title;
  if (!wps.length) nodes.push({ '@type': 'WebPage', '@id': can + '#webpage', url: can, name: title, description: P.meta('description') || undefined, inLanguage: lang, isPartOf: { '@id': siteId } });
  else wps.forEach((n) => { n.url = can; if (!n.inLanguage) n.inLanguage = lang; });
  if (!home && !has('BreadcrumbList')) {
    const segs = new URL(can).pathname.split('/').filter(Boolean);
    const items = [{ '@type': 'ListItem', position: 1, name: 'Acasă', item: origin + '/' }];
    let acc = origin; segs.forEach((s, i) => { acc += '/' + s; const last = i === segs.length - 1; items.push({ '@type': 'ListItem', position: i + 2, name: last ? (h1Of(P.html) || title) : decodeURIComponent(s).replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), item: acc + '/' }); });
    nodes.push({ '@type': 'BreadcrumbList', '@id': can + '#breadcrumb', itemListElement: items });
    notes.push('Breadcrumb derivat din adresa URL: verificați denumirile.');
  }
  for (const n of nodes.filter((x) => typesOf(x).includes('Dataset') && !x.license)) {
    if (inputs.license) n.license = inputs.license; else notes.push('Set de date fără licență: ' + (n['@id'] || n.name));
  }
  if (can.endsWith('/')) {
    const fix = (o) => {
      if (Array.isArray(o)) return o.map(fix);
      if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) { o[k] = typeof v === 'string' && ['url', 'usageInfo', 'termsOfService', 'publishingPrinciples', '@id'].includes(k) ? slash(v) : fix(v); } return o; }
      return o;
    };
    const slash = (v) => { try { const u = new URL(v); if (u.origin !== origin || u.pathname === '/' || u.pathname.endsWith('/') || !isSlashy(u.pathname)) return v; u.pathname += '/'; return u.href; } catch { return v; } };
    nodes = nodes.map(fix);
  }
  return { '@context': 'https://schema.org', '@graph': nodes, _notes: notes };
}

// Returnează propunerea pentru un grup: { ops, needs:[{key,label,placeholder,value}], files:[], notes:[], summary }
export function propose(groupId, P, a, inputs = {}) {
  const ops = []; const needs = []; const files = []; const notes = [];
  const failed = (id) => a.checks.find((c) => c.id === id && c.pass === false);
  const lang = guessLang(P);
  const can = P.canonical || normalizeCanonical(P.url);
  const title = P.meta('og:title') || P.title || h1Of(P.html) || siteName(P);
  if (groupId === 'titlu') {
    if (failed('title')) {
      let t = P.title || h1Of(P.html) || siteName(P);
      if (t.length < 15 && t !== siteName(P)) t = `${t} | ${siteName(P)}`;
      if (t.length > 65) t = cut(t, 65);
      ops.push({ op: 'title', content: inputs.title ?? t });
      needs.push({ key: 'title', label: 'Titlu (15–65 caractere)', value: inputs.title ?? t });
    }
    if (failed('desc')) {
      let dsc = P.meta('description') || P.meta('og:description') || firstParagraph(P.html);
      if (dsc.length < 70) dsc = (dsc + ' ' + firstParagraph(P.html)).trim();
      dsc = cut(dsc, 160); const v = inputs.desc ?? dsc;
      ops.push({ op: 'meta', key: 'description', attr: 'name', content: v });
      needs.push({ key: 'desc', label: 'Descriere (70–170 caractere)', value: v });
      if (v.length < 70) notes.push('Nu am găsit destul text în pagină pentru o descriere de 70+ caractere: scrieți-o dumneavoastră.');
    }
  }
  if (groupId === 'baza') {
    if (failed('canon')) ops.push({ op: 'link', key: 'canonical', attrs: { href: can } });
    if (failed('canon_sm')) notes.push(`Canonical-ul ${can} nu e în sitemap: adăugați-l în sitemap.xml (nu se poate corecta din pagină).`);
    if (failed('robots')) ops.push({ op: 'meta', attr: 'name', key: 'robots', content: 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1' });
    if (failed('lang')) ops.push({ op: 'lang', content: inputs.lang ?? lang }), needs.push({ key: 'lang', label: 'Limba paginii (ro, en, fr…)', value: inputs.lang ?? lang });
    if (failed('vp')) { ops.push({ op: 'charset' }); ops.push({ op: 'meta', attr: 'name', key: 'viewport', content: 'width=device-width,initial-scale=1' }); }
  }
  if (groupId === 'og') {
    const desc = P.meta('description') || P.meta('og:description') || '';
    const L = inputs.lang || lang;
    const want = { 'og:title': title, 'og:description': desc, 'og:url': can, 'og:type': 'website', 'og:locale': LOC[L] || 'en_US', 'og:site_name': siteName(P) };
    for (const [k, v] of Object.entries(want)) if ((failed(k) || (k === 'og:url' && failed('og:url=can'))) && v) ops.push({ op: 'meta', attr: 'property', key: k, content: v });
    if (failed('og:url=can') && !ops.some((o) => o.key === 'og:url')) ops.push({ op: 'meta', attr: 'property', key: 'og:url', content: can });
    if (failed('og:description') && !desc) notes.push('og:description are nevoie de o descriere: rezolvați mai întâi pasul „Titlu și descriere”.');
  }
  if (groupId === 'ogimg') {
    const cur = P.meta('og:image'); const guess = cur ? cur.replace(/\.webp(\?|$)/i, '.jpg$1') : new URL('/assets/og-image.jpg', can).href;
    const v = inputs.ogimage ?? guess;
    needs.push({ key: 'ogimage', label: 'Adresa imaginii 1200×630 (jpg sau png)', value: v });
    if (failed('og:image') || failed('og:dims') || v !== cur) {
      ops.push({ op: 'meta', attr: 'property', key: 'og:image', content: v });
      ops.push({ op: 'meta', attr: 'property', key: 'og:image:type', content: /\.png(\?|$)/i.test(v) ? 'image/png' : 'image/jpeg' });
      ops.push({ op: 'meta', attr: 'property', key: 'og:image:width', content: '1200' });
      ops.push({ op: 'meta', attr: 'property', key: 'og:image:height', content: '630' });
    }
    if (failed('og:image:alt')) ops.push({ op: 'meta', attr: 'property', key: 'og:image:alt', content: inputs.ogalt ?? title }), needs.push({ key: 'ogalt', label: 'Text alternativ imagine', value: inputs.ogalt ?? title });
    if (failed('og:file')) { const f = a.checks.find((c) => c.id === 'og:file'); notes.push('Imaginea trebuie să existe la adresa de mai sus și să aibă exact 1200×630. ' + (f.detail || '')); files.push(v); }
    if (/\.webp(\?|$)/i.test(v)) notes.push('WebP nu este afișat de toate rețelele de partajare: folosiți o copie jpg sau png.');
  }
  if (groupId === 'tw') {
    const img = P.meta('og:image') || inputs.ogimage;
    const map = { 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': P.meta('description') || P.meta('og:description') || '', 'twitter:image': img || '' };
    for (const [k, v] of Object.entries(map)) { if ((k === 'twitter:card' ? failed('tw:card') : failed(k)) && v) ops.push({ op: 'meta', attr: 'name', key: k, content: v }); }
    if (failed('twitter:image') && !img) notes.push('twitter:image are nevoie de og:image: rezolvați mai întâi pasul „Imaginea Open Graph”.');
  }
  if (groupId === 'icon') {
    const map = { icon_ico: 'icon:ico', icon_svg: 'icon:svg', icon_32: 'icon:32x32', icon_16: 'icon:16x16', icon_apple: 'apple-touch-icon', icon_manifest: 'manifest' };
    for (const [cid, key] of Object.entries(map)) {
      const c = a.checks.find((x) => x.id === cid); if (!c || c.pass !== false) continue;
      const std = STD_ICONS[key]; const { file, ...attrs } = std; const tagPresent = !/eticheta lipsește/.test(c.detail);
      if (!tagPresent) ops.push({ op: 'link', key, attrs: { ...attrs } });
      files.push(new URL(tagPresent ? (c.detail.split(': ').pop() || file) : file, P.url).href);
    }
    if (files.length) notes.push('Fișierele de mai jos trebuie încărcate pe site; scorul „verificat” le numără doar după ce răspund pe adresa lor.');
  }
  if (groupId === 'theme') {
    const v = inputs.theme ?? '#ffffff'; ops.push({ op: 'meta', attr: 'name', key: 'theme-color', content: v });
    needs.push({ key: 'theme', label: 'Culoare (hex)', value: v });
  }
  if (groupId === 'schema') {
    const graph = buildGraph(P, can, inputs.lang || lang, inputs); const gnotes = graph._notes; delete graph._notes;
    const sfailed = a.checks.filter((c) => c.group === 'schema' && c.pass === false);
    if (sfailed.some((c) => c.id === 'ld:valid') && P.blocks.some((b) => !b.ok)) notes.push('Există un bloc JSON-LD invalid; propunerea îl înlocuiește cu un graf nou construit din ce se vede în pagină.');
    ops.push({ op: 'jsonld', data: graph }); notes.push(...gnotes);
    if (sfailed.some((c) => c.id === 'ld:license')) needs.push({ key: 'license', label: 'Licența seturilor de date (URL)', value: inputs.license ?? '', placeholder: 'https://creativecommons.org/licenses/by/4.0/' });
    if (sfailed.some((c) => c.id === 'ld:ids')) notes.push('Referințe @id fără definiție: ' + a.checks.find((c) => c.id === 'ld:ids').detail + ' — nu pot inventa aceste noduri; adăugați-le sau eliminați referința.');
    notes.push('Organization conține doar ce se știe din pagină (nume, adresă). Adăugați manual logo, contact, profiluri.');
  }
  return { group: groupId, ops, needs, files: [...new Set(files)], notes, empty: ops.length === 0 };
}

// Următorul grup cu verificări picate, sărind peste cele respinse.
export function nextGroup(a, rejected = new Set(), done = new Set()) {
  for (const g of GROUPS) {
    if (rejected.has(g.id) || done.has(g.id)) continue;
    if (a.checks.some((c) => c.group === g.id && c.pass === false)) return g.id;
  }
  return null;
}
