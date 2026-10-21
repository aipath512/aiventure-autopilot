#!/usr/bin/env python3
"""Descoperă de unde se publică un domeniu (pas 1 al toolului de aliniere la etalon).
Utilizare: discover_source.py domeniu [repo1 repo2 ...]   (repo = owner/nume, citite prin gh api)
Semnale: antete HTTP, titlul live, proiecte *.pages.dev cu același titlu, depozite GitHub cu același titlu în index.html.
Rezultatul spune ce s-a găsit și ce lipsește; nu ghicește."""
import sys, re, subprocess, urllib.request
dom = sys.argv[1]; repos = sys.argv[2:]
def get(u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'aiventure-discover/1.0'}), timeout=12)
        return r.status, dict(r.headers), r.read().decode('utf8', 'replace')
    except Exception as e:
        return None, {}, ''
title = lambda h: (re.search(r'<title>(.*?)</title>', h, re.S) or [None, ''])[1].strip().replace('&amp;', '&')
st, hd, html = get('https://' + dom + '/'); t = title(html)
print(f'live: {dom} status={st} title={t!r}')
print('antete:', {k: v for k, v in hd.items() if k.lower().startswith('x-adi') or k.lower() in ('server', 'link')})
base = dom.split('.')[0]; names = {base, dom.replace('.', '-'), base.replace('-', '')} | {n + s for n in [base] for s in ('-eu', '-site', '-flat', '2')}
pd = []
for n in sorted(names):
    s, _, h = get(f'https://{n}.pages.dev/')
    if s == 200: pd.append((n, title(h) == t)); print(f'pages.dev: {n}.pages.dev titlu_identic={title(h) == t}')
for r in repos:
    p = subprocess.run(['gh', 'api', f'repos/{r}/contents/index.html', '-H', 'Accept: application/vnd.github.raw'], capture_output=True, text=True)
    print(f'repo: {r} titlu_identic={title(p.stdout) == t and bool(t)}')
if not any(m for _, m in pd): print('REZULTAT: niciun proiect pages.dev nu are titlul live -> sursă necunoscută (Worker pe rută sau alt proiect)')
else: print('REZULTAT: proiect Pages găsit; lipsește legătura proiect->depozit (se vede doar în Cloudflare: Settings > Source)')
