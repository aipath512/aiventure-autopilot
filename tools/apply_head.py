#!/usr/bin/env python3
"""Aplica pe homepage setul complet de meta + schema.org (etalon FirmsFinder, 100/100).
Utilizare: apply_head.py config.json index.html radacina_site
Copiaza setul de iconuri din tools/brand/ si scrie manifestul. Nu suprascrie un head deja completat."""
import sys, json, os, re, shutil, html as H
cfg = json.load(open(sys.argv[1], encoding='utf8')); page = sys.argv[2]; root = sys.argv[3]
here = os.path.dirname(os.path.abspath(__file__))
U = 'https://' + cfg['domain'] + '/'
h = open(page, encoding='utf8').read(); head_end = h.find('</head>')
assert '<link rel="canonical"' not in h[:head_end], 'head deja completat'
title = re.search(r'<title>(.*?)</title>', h, re.S).group(1).strip()
m = re.search(r'<meta name="description" content="([^"]*)"', h[:head_end])
desc = H.unescape(m.group(1)) if m else cfg['description']
e = lambda s: H.escape(s, quote=True)
lang = cfg['lang']; loc = cfg['locale']; img = U + 'assets/og-image.jpg'
org = json.load(open(os.path.join(here, 'org_aiventure.json'), encoding='utf8'))
org['brand'] = {'@id': U + '#brand'}
P = {'@id': 'https://aiventure.ro/#organization'}
graph = [org,
 {'@type': 'Brand', '@id': U + '#brand', 'name': cfg['brand'], 'url': U, **({'slogan': cfg['slogan']} if cfg.get('slogan') else {})},
 {'@type': 'WebSite', '@id': U + '#website', 'url': U, 'name': cfg['brand'], 'inLanguage': lang, 'publisher': P},
 {'@type': 'WebPage', '@id': U + '#webpage', 'url': U, 'name': title, 'description': desc, 'inLanguage': lang,
  'isPartOf': {'@id': U + '#website'}, 'dateModified': cfg['date'], 'copyrightYear': int(cfg['date'][:4]),
  'publisher': P, 'author': P, 'creator': P, 'copyrightHolder': P}]
if cfg.get('extra_graph'):
    graph += json.load(open(cfg['extra_graph'], encoding='utf8'))
if cfg.get('main_id'):
    graph[3]['mainEntity'] = {'@id': U + cfg['main_id']}; graph[3]['about'] = [{'@id': U + cfg['main_id']}]
if cfg.get('app'):
    a = cfg['app']; graph[3]['about'] = [{'@id': U + '#app'}]; graph[3]['mainEntity'] = {'@id': U + '#app'}
    graph.append({'@type': 'WebApplication', '@id': U + '#app', 'name': cfg['brand'], 'url': U, 'applicationCategory': 'BusinessApplication',
                  'operatingSystem': 'Web', 'inLanguage': lang, 'description': a['description'], 'provider': P, 'featureList': a['features']})
if cfg.get('howto'):
    ht = cfg['howto']
    graph.append({'@type': 'HowTo', '@id': U + '#howto', 'name': ht['name'], 'description': ht['description'], 'inLanguage': lang,
                  'step': [{'@type': 'HowToStep', 'position': i + 1, 'name': n, 'text': t, 'url': U + ht.get('anchor', '')} for i, (n, t) in enumerate(ht['steps'])]})
ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=2)
lines = ['<link rel="icon" href="/favicon.ico" sizes="any">', '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
 '<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png">', '<link rel="icon" type="image/png" sizes="16x16" href="/assets/brand/favicon-16x16.png">',
 '<link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/apple-touch-icon.png">', '<link rel="manifest" href="/assets/brand/site.webmanifest">',
 '<meta name="msapplication-config" content="/assets/brand/browserconfig.xml">', '<meta name="msapplication-TileColor" content="#010e19">', '<meta name="theme-color" content="#010e19">',
 f'<link rel="canonical" href="{U}">']
if not m: lines.append(f'<meta name="description" content="{e(desc)}">')
lines += ['<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">',
 '<meta property="og:type" content="website">', f'<meta property="og:title" content="{e(title)}">', f'<meta property="og:description" content="{e(desc)}">',
 f'<meta property="og:url" content="{U}">', f'<meta property="og:site_name" content="{e(cfg["brand"])}">', f'<meta property="og:locale" content="{loc}">',
 f'<meta property="og:image" content="{img}">', '<meta property="og:image:type" content="image/jpeg">', f'<meta property="og:image:alt" content="{e(cfg["og_alt"])}">',
 '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">',
 f'<meta name="twitter:title" content="{e(title)}">', f'<meta name="twitter:description" content="{e(desc)}">', f'<meta name="twitter:image" content="{img}">',
 f'<meta name="twitter:image:alt" content="{e(cfg["og_alt"])}">', '<meta name="twitter:site" content="@aipath512">', '<meta name="author" content="AiVenture S.R.L.">',
 '<meta name="referrer" content="strict-origin-when-cross-origin">', '<script type="application/ld+json">', ld, '</script>']
t_end = h.find('</title>') + len('</title>')
# descrierea existenta ramane unde e; blocul nou vine dupa titlu
open(page, 'w', encoding='utf8').write(h[:t_end] + '\n' + '\n'.join(lines) + h[t_end:])
# iconuri + manifest + imagine OG
os.makedirs(os.path.join(root, 'assets', 'brand'), exist_ok=True)
for f in ('favicon.ico', 'favicon.svg'): shutil.copy(os.path.join(here, 'brand', f), os.path.join(root, f))
for f in os.listdir(os.path.join(here, 'brand', 'assets')): shutil.copy(os.path.join(here, 'brand', 'assets', f), os.path.join(root, 'assets', 'brand', f))
man = {'name': cfg['brand'], 'short_name': cfg.get('short', cfg['brand']), 'description': desc, 'lang': lang, 'start_url': '/', 'scope': '/',
 'icons': [{'src': '/assets/brand/android-chrome-192x192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/assets/brand/android-chrome-512x512.png', 'sizes': '512x512', 'type': 'image/png'},
           {'src': '/assets/brand/maskable-512x512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}], 'theme_color': '#010e19', 'background_color': '#010e19', 'display': 'browser'}
open(os.path.join(root, 'assets', 'brand', 'site.webmanifest'), 'w', encoding='utf8').write(json.dumps(man, indent=2, ensure_ascii=False) + '\n')
os.system(f'python3 {here}/og_image.py "{cfg["og_name"]}" "{cfg["og_tag"]}" "{cfg["og_sub"]}" {cfg["domain"]} {root}/assets/og-image.jpg')
print('ok', len(desc))
