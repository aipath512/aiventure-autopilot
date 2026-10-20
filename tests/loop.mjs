// Simulează pilotul automat: aprobă toate propunerile, marchează fișierele ca încărcate. Rulare: node tests/loop.mjs
import fs from 'node:fs';
import { audit, parsePage, propose, applyOps, nextGroup } from '../public/scorer.js';
function run(name, html, url, sitemap = null) {
  const assume = new Set(); const rejected = new Set(); const done = new Set();
  let page = parsePage(html, url); let a = audit(page, { assume, sitemapUrls: sitemap });
  console.log(`\n== ${name}\n  start: ${a.score}`);
  for (let i = 1; i < 30; i++) {
    const g = nextGroup(a, rejected, done); if (!g) break;
    const p = propose(g, page, a, {});
    if (p.empty) { p.files.forEach((f) => assume.add(f)); done.add(g); }
    else { html = applyOps(html, p.ops); p.files.forEach((f) => assume.add(f)); done.add(g); }
    page = parsePage(html, url); const b = audit(page, { assume, sitemapUrls: sitemap });
    console.log(`  it${i} ${g.padEnd(7)} ${a.score} -> ${b.score}${p.empty ? ' (manual/fișiere)' : ''}${p.notes.length ? '  nota: ' + p.notes[0].slice(0, 70) : ''}`);
    a = b;
  }
  const left = a.checks.filter((c) => c.pass === false).map((c) => c.id + (c.detail ? ' [' + c.detail.slice(0, 50) + ']' : ''));
  console.log(`  final: ${a.score}  rămase: ${left.join(', ') || '—'}`);
  return html;
}
const bare = `<!doctype html><html><head><title>Hi</title></head><body><h1>Cabinet contabil Popescu</h1><p>Oferim servicii de contabilitate pentru firme mici și mijlocii din București, cu raportare lunară și consultanță fiscală.</p></body></html>`;
const out = run('pagină goală (fără meta)', bare, 'https://exemplu.ro/servicii/contabilitate', new Set(['https://exemplu.ro/servicii/contabilitate/']));
fs.writeFileSync(process.env.TMPOUT || '/tmp/bare_out.html', out);
run('FirmsFinder înainte de PR, homepage', fs.readFileSync('/home/claude/aipath512/firmsfinder/index.html', 'utf8'), 'https://firmsfinder.eu/', new Set(['https://firmsfinder.eu/']));
run('FirmsFinder înainte de PR, /aeo/', fs.readFileSync('/home/claude/aipath512/firmsfinder/aeo/index.html', 'utf8'), 'https://firmsfinder.eu/aeo/', new Set(['https://firmsfinder.eu/aeo/']));
