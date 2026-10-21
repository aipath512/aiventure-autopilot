#!/usr/bin/env python3
"""Genereaza imaginea Open Graph 1200x630 in stilul retelei AiVenture (navy + auriu).
Utilizare: og_image.py "AI-LENS" "Web-AI Business Observation" "Ce vad ChatGPT, Claude, Gemini si Perplexity despre firma dumneavoastra" ai-lens.eu out.jpg"""
import sys
from PIL import Image, ImageDraw, ImageFont
name, tag, sub, domain, out = sys.argv[1:6]
W, H = 1200, 630
F = '/usr/share/fonts/opentype/inter/'
def font(f, s): return ImageFont.truetype(F + f, s)
img = Image.new('RGB', (W, H), (1, 14, 25))
px = img.load()
for y in range(H):  # gradient navy
    for x in range(W):
        t = (x / W * .6 + y / H * .4)
        px[x, y] = (int(1 + 8 * t), int(14 + 28 * t), int(25 + 55 * t))
d = ImageDraw.Draw(img)
gold = (240, 180, 41); white = (245, 248, 252); mut = (160, 178, 200)
# retea de puncte (motivul retelei)
import random; random.seed(7)
pts = [(random.randint(640, 1160), random.randint(40, 470)) for _ in range(26)]
for i, a in enumerate(pts):
    for b in pts[i + 1:]:
        if (a[0]-b[0])**2 + (a[1]-b[1])**2 < 150**2: d.line([a, b], fill=(40, 90, 150), width=1)
for p in pts: d.ellipse([p[0]-4, p[1]-4, p[0]+4, p[1]+4], fill=(90, 160, 235))
for p in pts[:4]: d.ellipse([p[0]-7, p[1]-7, p[0]+7, p[1]+7], fill=gold)
# lupa
cx, cy, r = 105, 105, 38
d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=white, width=9); d.line([cx+27, cy+27, cx+60, cy+60], fill=white, width=11)
d.text((175, 62), name, font=font('InterDisplay-Bold.otf', 78), fill=white)
d.text((178, 150), tag.upper(), font=font('Inter-SemiBold.otf', 24), fill=gold)
def wrap(text, f, w):
    out, line = [], ''
    for wd in text.split():
        if d.textlength((line + ' ' + wd).strip(), font=f) > w: out.append(line); line = wd
        else: line = (line + ' ' + wd).strip()
    return out + [line]
y = 250
for ln in wrap(sub, font('InterDisplay-Bold.otf', 50), 640):
    d.text((60, y), ln, font=font('InterDisplay-Bold.otf', 50), fill=white); y += 64
d.rectangle([0, 548, W, H], fill=(14, 28, 46)); d.rectangle([0, 548, 330, H], fill=gold)
d.text((28, 570), domain, font=font('Inter-Bold.otf', 34), fill=(1, 14, 25))
d.text((360, 574), 'AiVenture S.R.L.  ·  Web  ·  AI  ·  A2A', font=font('Inter-Regular.otf', 26), fill=mut)
img.save(out, 'JPEG', quality=88, optimize=True)
