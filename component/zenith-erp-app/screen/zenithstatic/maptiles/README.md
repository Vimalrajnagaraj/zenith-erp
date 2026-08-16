# Self-hosted map tiles (Contacts dashboard Contact Map)

The Contacts dashboard **Contact Map** (`../js/zenith-map.js` → `../js/india-style.js` → these tiles)
is a real interactive map with **zero external/runtime dependency** — MapLibre, the PMTiles protocol,
the style, the glyphs, and the tiles are all served from this server. Tiles are OSM data via the
Protomaps v4 planet, extracted once for the India bbox.

## ACTIVE serving: single-file PMTiles + nginx byte-range

`india-style.js` points at `pmtiles://<origin>/maptiles/india.pmtiles` (full zoom **z0–11**).
pmtiles.js reads the single file via **HTTP byte-range (206)**, which **only nginx can serve** (Moqui
static returns 200). Two things live **on the host** (NOT in git or the container image — restore them
on a host rebuild):

- **The tile file:** `/opt/deploy/maptiles/india.pmtiles` (277 MB, z0–11). Regenerate:
  ```sh
  pmtiles extract https://demo-bucket.protomaps.com/v4.pmtiles india.pmtiles --bbox=68,6,98,38 --maxzoom=11
  # (range-based: downloads ~India only, not the 137 GB planet)
  ```
- **The nginx block** (`sites-enabled/erp.zetaclantech.com`, before the `location /`):
  ```nginx
  location ^~ /maptiles/ { alias /opt/deploy/maptiles/; default_type application/octet-stream;
      add_header Access-Control-Allow-Origin "*" always;
      add_header Cache-Control "public, max-age=2592000" always;
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; access_log off; }
  ```
  Then `nginx -t && systemctl reload nginx`. Verify: `curl -r 0-99 .../maptiles/india.pmtiles` → `206`.

## FALLBACK / alternative: static z/x/y pyramid (no byte-range, no nginx)

If byte-range serving isn't available, serve a plain **z/x/y `.pbf` pyramid** through Moqui's ordinary
static (`india/{z}/{x}/{y}.pbf`, raw MVT). Fully self-contained in the container image (survives a host
rebuild), at the cost of ~779 files and lower max zoom. To switch back: regenerate the pyramid (below),
set the `india-style.js` source to `tiles: ["<origin>/zenithstatic/maptiles/india/{z}/{x}/{y}.pbf"]`
(maxzoom 8), and drop pmtiles.js from `zenith-map.js`.

## Regenerate (either form)

Prereqs: the `pmtiles` CLI (github.com/protomaps/go-pmtiles) + Node with `npm i pmtiles @protomaps/basemaps`.

```sh
pmtiles extract https://demo-bucket.protomaps.com/v4.pmtiles india.pmtiles --bbox=68,6,98,38 --maxzoom=11
node build/extract-pyramid.js     # OPTIONAL: dump india.pmtiles -> pyramid/india/{z}/{x}/{y}.pbf (raw MVT)
node build/gen-style2.js          # regenerate ../js/india-style.js (Protomaps LIGHT flavor, labels ->
                                  #   name:en + one self-hosted Latin font, sprite-icon layers stripped)
```
Glyphs (`../fonts/NotoSans-Regular/{range}.pbf`) come from
`https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/{range}.pbf` (ranges 0-255,
256-511, 512-767 — Latin covers all major Indian cities via name:en). `build/gen-style2.js` toggles the
source between the `pmtiles://` single file (active) and the `tiles:[...]` pyramid on one line.

The `india/` pyramid `.pbf` output is **git-ignored** (see `.gitignore`); the build scripts are committed.
