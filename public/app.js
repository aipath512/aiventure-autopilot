import { audit, parsePage, propose, applyOps, nextGroup, normalizeCanonical, GROUPS, VERSION } from '/scorer.js';
const $ = (id) => document.getElementById(id);
const S = { target: 100, queue: [], idx: -1, sitemap: null, probe: {}, assume: new Set(), results: [], cur: null };
const today = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const log = (t) => { const li = document.createElement('li'); li.textContent = new Date().toLocaleTimeString('ro-RO') + ' · ' + t; $('log').prepend(li); };
const say = (t, cls = '') => { $('status').textContent = t; $('status').className = 'sub ' + cls; };
const api = async (path) => { const r = await fetch(path); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Eroare ' + r.status); return j; };
const slug = (u) => (new URL(u).hostname + new URL(u).pathname).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

/* ── ceas și progres ── */
const tick = () => { const d = new Date(); $('clk').textContent = d.toLocaleTimeString('ro-RO', { hour12: false }); $('clkd').textContent = d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
tick(); setInterval(tick, 1000);
const setBar = (v) => { $('pgi').style.width = v.toFixed(1) + '%'; $('pg').setAttribute('aria-valuenow', Math.round(v)); };
function idle(txt) { $('pg').classList.add('idle'); $('dot').className = 'dot'; $('actTxt').textContent = txt || (S.cur && S.cur.prop ? 'Așteaptă validarea dumneavoastră' : 'Inactiv'); $('elapsed').textContent = ''; }
async function task(label, from, to, fn) {
  const pre = S.queue.length > 1 ? 'Pagina ' + (S.idx + 1) + '/' + S.queue.length + ' · ' : '';
  const t0 = Date.now(); let v = from;
  $('pg').classList.remove('idle'); $('dot').className = 'dot run'; $('actTxt').innerHTML = '<b>' + esc(pre + label) + '</b>'; setBar(v);
  const tm = setInterval(() => { v += (to - v) * 0.07; setBar(v); $('elapsed').textContent = '· ' + Math.floor((Date.now() - t0) / 1000) + ' s'; }, 250);
  try { return await fn(); }
  finally { clearInterval(tm); setBar(to); if (to >= 100) setTimeout(() => idle(), 700); }
}

/* ── încărcare ── */
async function loadSitemap(origin) {
  try {
    const first = await api('/api/fetch?kind=sitemap&url=' + encodeURIComponent(origin + '/sitemap.xml'));
    let locs = [...first.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    if (locs.some((l) => /\.xml(\?|$)/i.test(l))) {
      const kids = locs.filter((l) => /\.xml(\?|$)/i.test(l)).slice(0, 3); locs = locs.filter((l) => !/\.xml(\?|$)/i.test(l));
      for (const k of kids) { try { const j = await api('/api/fetch?kind=sitemap&url=' + encodeURIComponent(k)); locs.push(...[...j.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])); } catch {} }
    }
    return locs.filter((l) => { try { return new URL(l).origin === origin; } catch { return false; } });
  } catch (e) { log('Sitemap indisponibil: ' + e.message); return null; }
}
async function probeNeeded(page) {
  const urls = new Set();
  const add = (u) => { try { urls.add(new URL(u, page.url).href); } catch {} };
  if (page.meta('og:image')) add(page.meta('og:image'));
  page.links.filter((l) => /icon|manifest/i.test(l.a.rel || '')).forEach((l) => l.a.href && add(l.a.href));
  const todo = [...urls].filter((u) => !(u in S.probe));
  for (let i = 0; i < todo.length; i += 12) {
    try { Object.assign(S.probe, await api('/api/probe?urls=' + encodeURIComponent(todo.slice(i, i + 12).join('|')))); }
    catch (e) { todo.slice(i, i + 12).forEach((u) => (S.probe[u] = { ok: false, error: e.message })); }
  }
}
const ctx = () => ({ sitemapUrls: S.sitemap, probe: S.probe, assume: S.assume });
async function fetchPage(url) { const j = await api('/api/fetch?url=' + encodeURIComponent(url)); return { html: j.text, url: j.finalUrl }; }
async function reaudit() { const c = S.cur; c.page = parsePage(c.html, c.url); await task('Recalculez scorul', 10, 100, () => probeNeeded(c.page)); c.audit = audit(c.page, ctx()); render(); }

/* ── pagină ── */
async function openPage(url) {
  say('Încarc ' + url + ' …');
  let got; try { got = await task('Descarc pagina', 5, 40, () => fetchPage(url)); } catch (e) { say('Nu pot încărca pagina: ' + e.message, 'err'); log('Eroare la ' + url + ': ' + e.message); return markFail(url, e.message); }
  const page0 = parsePage(got.html, got.url);
  S.cur = { url: got.url, orig: got.html, html: got.html, page: page0, audit: null, done: new Set(), rejected: new Set(), inputs: {}, iter: 0, startScore: null, liveScore: null, prop: null };
  await task('Verific iconurile și imaginile', 40, 90, () => probeNeeded(page0)); S.cur.audit = audit(page0, ctx());
  S.cur.startScore = S.cur.liveScore = S.cur.audit.score;
  const body = got.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (body.length < 400) log('Atenție: pagina are puțin text în HTML-ul brut; dacă e generată de JavaScript, auditul vede doar ce vede un crawler fără JS.');
  say(''); $('work').hidden = false; log('Pagină încărcată: ' + got.url + ' · scor ' + S.cur.audit.score);
  setBar(100); step(); idle();
}
function markFail(url, why) { S.results.push({ url, start: null, est: null, live: null, state: 'eroare: ' + why }); saveProgress(); renderResults(); if (S.idx + 1 < S.queue.length) { S.idx++; return openPage(S.queue[S.idx]); } }

function step() {
  const c = S.cur; const g = nextGroup(c.audit, c.rejected, c.done);
  if (!g || c.audit.score >= S.target) return finishPage();
  c.group = g; c.iter++; c.prop = propose(g, c.page, c.audit, c.inputs); render();
}
function finishPage() { S.cur.group = null; S.cur.prop = null; render(); }

/* ── randare ── */
function renderOps(ops) {
  let h = applyOps('<html>\n<head>\n</head>\n</html>', ops);
  return h.replace(/^<html>\n<head>\n/, '').replace(/<\/head>\n<\/html>$/, '').trim() || '(nicio modificare în HTML)';
}
function render() {
  const c = S.cur; if (!c) return;
  const a = c.audit; $('pageTitle').textContent = c.url;
  $('sEst').textContent = a.score.toFixed(1); $('bEst').style.width = a.score + '%';
  $('sLive').textContent = c.liveScore == null ? '–' : c.liveScore.toFixed(1); $('bLive').style.width = (c.liveScore || 0) + '%';
  $('chips').innerHTML = GROUPS.map((g) => { const f = a.checks.filter((x) => x.group === g.id); const bad = f.filter((x) => x.pass === false).length; const cls = bad ? 'bad' : f.every((x) => x.pass === null) ? 'skip' : 'ok'; return `<button type="button" class="chip ${cls}${c.open === g.id ? ' sel' : ''}" data-g="${g.id}" aria-expanded="${c.open === g.id}">${esc(g.label)}${bad ? ' · ' + bad + ' de rezolvat' : ' ✓'} ${c.open === g.id ? '▴' : '▾'}</button>`; }).join('');
  $('chips').querySelectorAll('.chip').forEach((b) => (b.onclick = () => { c.open = c.open === b.dataset.g ? null : b.dataset.g; render(); }));
  const cd = $('chipDetail'); cd.hidden = !c.open;
  if (c.open) {
    const g = GROUPS.find((x) => x.id === c.open); const f = a.checks.filter((x) => x.group === c.open); const bad = f.filter((x) => x.pass === false).length;
    cd.innerHTML = `<b>${esc(g.label)}</b><ul>` + f.map((x) => `<li>${x.pass === false ? '<span class="err">✗</span>' : x.pass === null ? '<span class="sub">–</span>' : '<span class="ok">✓</span>'} ${esc(x.label)}${x.detail ? `<span class="sub">${esc(x.detail)}</span>` : ''}</li>`).join('') + '</ul>' + (bad ? `<button type="button" class="primary" id="fixGroup">Corectează acum acest grup (${bad})</button>` : '<p class="ok">Toate verificările din acest grup trec.</p>');
    const fb = $('fixGroup'); if (fb) fb.onclick = () => { c.rejected.delete(c.open); c.done.delete(c.open); c.group = c.open; c.iter++; c.prop = propose(c.group, c.page, c.audit, c.inputs); c.open = null; render(); $('iter').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  }
  const p = c.prop; $('iter').hidden = !p; $('done').hidden = !!p;
  if (p) {
    const gl = GROUPS.find((g) => g.id === p.group).label;
    $('iterTitle').textContent = `Iterația ${c.iter} · ${gl}`;
    const fails = a.checks.filter((x) => x.group === p.group && x.pass === false);
    $('iterWhy').textContent = 'De ce: ' + fails.map((x) => x.label + (x.detail ? ' (' + x.detail + ')' : '')).join('; ') + '.';
    $('needs').innerHTML = p.needs.map((n) => `<div style="margin:8px 0"><label for="in_${n.key}">${esc(n.label)}</label><input type="text" id="in_${n.key}" data-key="${n.key}" value="${esc(n.value || '')}" placeholder="${esc(n.placeholder || '')}"></div>`).join('');
    $('needs').querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { c.inputs[i.dataset.key] = i.value; c.prop = propose(c.group, c.page, c.audit, c.inputs); render(); }));
    $('snippet').textContent = renderOps(p.ops);
    $('notes').innerHTML = p.notes.map((n) => `<p class="note">• ${esc(n)}</p>`).join('');
    $('files').hidden = !p.files.length; $('fileList').innerHTML = p.files.map((f) => `<li><code>${esc(f)}</code> ${S.probe[f] && S.probe[f].ok ? '<span class="ok">există</span>' : S.assume.has(f) ? '<span class="ok">socotit ca încărcat</span>' : '<span class="err">nu există încă</span>'}</li>`).join('');
    $('approve').disabled = p.empty && !p.files.length; $('approve').textContent = p.empty ? 'Am luat act (nu există modificare de HTML)' : 'Aprob și aplic';
  } else {
    const left = a.checks.filter((x) => x.pass === false);
    $('doneTitle').textContent = left.length ? `Pagină încheiată la ${a.score.toFixed(1)} (ținta ${S.target})` : `Pagină la ${a.score.toFixed(1)} · țintă atinsă`;
    $('remain').innerHTML = left.length ? '<p><b>Rămase de făcut manual:</b></p><ul>' + left.map((x) => `<li>${esc(x.label)} ${x.detail ? '<span class="sub">(' + esc(x.detail) + ')</span>' : ''}</li>`).join('') + '</ul>' : '<p class="ok">Toate verificările trec în varianta estimată. Încărcați fișierul corectat și apăsați „Verifică pagina publicată”.</p>';
    $('nextPage').textContent = S.idx + 1 < S.queue.length ? 'Pagina următoare' : 'Încheie';
  }
  renderResults();
}
function renderResults() {
  const rows = S.results.map((r) => `<tr><td>${esc(r.url)}</td><td>${r.start ?? '–'}</td><td>${r.est ?? '–'}</td><td>${r.live ?? '–'}</td><td>${esc(r.state)}</td></tr>`);
  const c = S.cur; if (c && S.results.every((r) => r.url !== c.url)) rows.push(`<tr><td>${esc(c.url)}</td><td>${c.startScore}</td><td>${c.audit.score}</td><td>${c.liveScore ?? '–'}</td><td>în lucru</td></tr>`);
  $('results').innerHTML = rows.join('');
}
function saveProgress() { try { localStorage.setItem('autopilot_v1', JSON.stringify({ results: S.results, t: Date.now() })); } catch {} }

/* ── acțiuni ── */
async function applyAndNext(kind) {
  const c = S.cur; const p = c.prop; const before = c.audit.score;
  if (kind === 'approve') {
    if (!p.empty) c.html = applyOps(c.html, p.ops);
    c.done.add(p.group);
    await reaudit();
    log(`Iterația ${c.iter} · ${GROUPS.find((g) => g.id === p.group).label}: aprobat · ${before} → ${c.audit.score}`);
  } else if (kind === 'reject') { c.rejected.add(p.group); log(`Iterația ${c.iter} · ${GROUPS.find((g) => g.id === p.group).label}: respins`); }
  else { c.done.add(p.group); log(`Iterația ${c.iter} · ${GROUPS.find((g) => g.id === p.group).label}: lăsat pe manual`); }
  step();
}
$('approve').onclick = () => applyAndNext('approve');
$('reject').onclick = () => applyAndNext('reject');
$('skip').onclick = () => applyAndNext('skip');
$('probeBtn').onclick = async () => { const c = S.cur; c.prop.files.forEach((f) => delete S.probe[f]); try { await task('Verific fișierele', 5, 100, async () => Object.assign(S.probe, await api('/api/probe?urls=' + encodeURIComponent(c.prop.files.join('|'))))); } catch (e) { log('Verificare fișiere: ' + e.message); } await reaudit(); c.prop = propose(c.group, c.page, c.audit, c.inputs); render(); };
$('assumeBtn').onclick = async () => { S.cur.prop.files.forEach((f) => S.assume.add(f)); await reaudit(); log('Fișiere socotite ca încărcate (estimat).'); S.cur.prop = propose(S.cur.group, S.cur.page, S.cur.audit, S.cur.inputs); render(); };
$('dlHtml').onclick = () => download(slug(S.cur.url) + '_v' + VERSION + '_' + today + '.html', S.cur.html, 'text/html');
$('dlHead').onclick = () => { const h = S.cur.html; const i = h.search(/<\/head>/i); download(slug(S.cur.url) + '_head_v' + VERSION + '_' + today + '.html', h.slice(0, i >= 0 ? i + 7 : 0), 'text/html'); };
$('live').onclick = async () => {
  const c = S.cur; say('Verific pagina publicată …');
  try { const g = await task('Descarc pagina publicată', 5, 55, () => fetchPage(c.url)); const pg = parsePage(g.html, g.url); S.probe = {}; await task('Verific iconurile și imaginile', 55, 100, () => probeNeeded(pg)); const au = audit(pg, { sitemapUrls: S.sitemap, probe: S.probe, assume: new Set() }); c.liveScore = au.score; log('Verificat live: ' + au.score); say('Scor verificat pe pagina publicată: ' + au.score, au.score >= S.target ? 'ok' : ''); }
  catch (e) { say('Nu pot verifica: ' + e.message, 'err'); }
  render();
};
$('nextPage').onclick = async () => {
  const c = S.cur; S.results.push({ url: c.url, start: c.startScore, est: c.audit.score, live: c.liveScore, state: c.audit.score >= S.target ? 'țintă atinsă' : 'manual rămas' }); saveProgress();
  if (S.idx + 1 < S.queue.length) { S.idx++; return openPage(S.queue[S.idx]); }
  S.cur = null; say('Toate paginile au fost parcurse.', 'ok'); $('iter').hidden = true; $('done').hidden = true; renderResults();
};
$('dlReport').onclick = () => {
  const L = ['# Raport pilot automat v' + VERSION + ' · ' + today, '', '| Pagina | Început | Estimat | Verificat | Stare |', '|---|---|---|---|---|', ...S.results.map((r) => `| ${r.url} | ${r.start ?? '–'} | ${r.est ?? '–'} | ${r.live ?? '–'} | ${r.state} |`), '', '## Jurnal', ...[...$('log').children].reverse().map((li) => '- ' + li.textContent)];
  download('raport_autopilot_v' + VERSION + '_' + today + '.md', L.join('\n'), 'text/markdown');
};
$('go').onclick = async () => {
  let u = $('url').value.trim(); if (!u) return say('Introduceți un URL.', 'err'); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  let origin; try { origin = new URL(u).origin; } catch { return say('URL invalid.', 'err'); }
  S.target = Math.max(50, Math.min(100, Number($('target').value) || 100)); S.results = []; S.probe = {}; S.assume = new Set(); $('log').innerHTML = '';
  $('go').disabled = true; say('Caut sitemap-ul …');
  S.queue = []; S.idx = 0; const locs = await task('Caut sitemap-ul', 3, 100, () => loadSitemap(origin)); S.sitemap = locs ? new Set(locs.map((l) => l)) : null;
  S.queue = $('scope').value === 'sitemap' && locs && locs.length ? locs.slice(0, 40) : [normalizeCanonical(u)];
  if ($('scope').value === 'sitemap' && !locs) log('Fără sitemap: auditez doar pagina introdusă.');
  S.idx = 0; $('go').disabled = false; await openPage(S.queue[0]);
};
