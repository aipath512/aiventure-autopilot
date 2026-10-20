# AiVenture Autopilot v1.0 (2026-10-20)

Pagină web pe care introduceți un URL; sistemul măsoară schema.org și meta tags (38 de verificări, aceleași ca la FirmsFinder.eu: 28 meta + 10 schema.org), propune o corecție pe iterație, o aplică doar după aprobarea dumneavoastră și repetă până la scorul țintă. Apoi trece la pagina următoare.

- `public/` — pagina (index.html), interfața (app.js), motorul de scor și propuneri (scorer.js)
- `functions/api/fetch.js` — descarcă pagina și sitemap-ul (protejat împotriva adreselor interne)
- `functions/api/probe.js` — verifică dacă imaginile/iconurile există și ce dimensiune au
- `tests/` — teste locale (nu se publică)

Cloudflare Pages: Build command gol, Build output directory = `public`. Folderul `functions/` se detectează singur.

Limite: nu scrie pe site-ul auditat (primiți fișierul corectat); fără AI, textele noi sunt deduse din pagină și se pot edita înainte de aprobare; paginile generate doar de JavaScript sunt văzute ca de un crawler fără JavaScript.
