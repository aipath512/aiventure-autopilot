#!/usr/bin/env python3
"""Genereaza setul de iconuri al unui site (monograma aurie pe navy, stilul retelei AiVenture).
Utilizare: icon_set.py "3W" radacina_site   -> scrie favicon.ico, favicon.svg, assets/brand/*.png, browserconfig.xml"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
mono, root = sys.argv[1], sys.argv[2]
NAVY = (1, 14, 25); GOLD = (240, 180, 41)
B = os.path.join(root, 'assets', 'brand'); os.makedirs(B, exist_ok=True)
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
def icon(size, maskable=False, round_=True):
    S = 1024; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pad = 0 if maskable else 0
    if maskable or not round_: d.rectangle([0, 0, S, S], fill=NAVY)
    else: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22), fill=NAVY)
    inner = .62 if maskable else .86  # zona sigura pentru maskable
    if not maskable:
        d.rounded_rectangle([S*.06, S*.06, S*.94, S*.94], radius=int(S*.17), outline=GOLD, width=int(S*.025))
    fs = int(S * (.46 if len(mono) <= 2 else .34) * (inner / .86))
    f = ImageFont.truetype(FONT, fs); w = d.textlength(mono, font=f)
    bb = d.textbbox((0, 0), mono, font=f); h = bb[3] - bb[1]
    d.text(((S - w) / 2 - bb[0] * 0, (S - h) / 2 - bb[1]), mono, font=f, fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)
icon(16).save(f'{B}/favicon-16x16.png'); icon(32).save(f'{B}/favicon-32x32.png')
icon(180, round_=False).convert('RGB').save(f'{B}/apple-touch-icon.png')
icon(192).save(f'{B}/android-chrome-192x192.png'); icon(512).save(f'{B}/android-chrome-512x512.png')
icon(512, maskable=True).convert('RGB').save(f'{B}/maskable-512x512.png'); icon(150, round_=False).convert('RGB').save(f'{B}/mstile-150x150.png')
icon(256).save(os.path.join(root, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
fs = 52 if len(mono) <= 2 else 38
open(os.path.join(root, 'favicon.svg'), 'w', encoding='utf8').write(
 f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#010e19"/>'
 f'<rect x="6" y="6" width="88" height="88" rx="17" fill="none" stroke="#f0b429" stroke-width="2.5"/>'
 f'<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Inter,Arial,Helvetica,sans-serif" font-weight="700" font-size="{fs}" fill="#f0b429">{mono}</text></svg>\n')
open(f'{B}/browserconfig.xml', 'w', encoding='utf8').write('<?xml version="1.0" encoding="utf-8"?>\n<browserconfig><msapplication><tile><square150x150logo src="/assets/brand/mstile-150x150.png"/><TileColor>#010e19</TileColor></tile></msapplication></browserconfig>\n')
print('ok', mono)
