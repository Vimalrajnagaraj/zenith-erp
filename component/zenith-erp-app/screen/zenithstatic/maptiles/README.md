# Self-hosted map tiles (Contacts dashboard Contact Map)

The Contacts dashboard **Contact Map** (`../js/zenith-map.js` → `../js/india-style.js` → these tiles)
is a real interactive map with **zero external/runtime dependency** and **zero host-level dependency** —
MapLibre, the PMTiles protocol, the style, the glyphs, and the tiles are all served from this server, and
everything (code + the tile file) lives inside the **deploy artifact** (git + the container image). A
container redeploy OR a full host rebuild restores it with no manual steps. Tiles are OSM data via the
Protomaps v4 planet, extracted once for the India bbox.

## ACTIVE serving: single-file PMTiles, range-served IN-CONTAINER by Moqui

- **Tile file:** `india.pmtiles` (277 MB, full zoom **z0–11**) sits next to this README, **baked into the
  container image**. It is **git-ignored** (large binary, regenerable — see `.gitignore` + below) but IS
  in the image, so it travels with every deploy.
- **Serving:** the `maptiles` transition in `../../zenithstatic.xml` hand-rolls **HTTP byte-range (206)**
  via `RandomAccessFile` (pmtiles.js requires 206; Moqui's `sendResourceResponse` only does 200). Reached
  at `/zenithstatic/maptiles/india.pmtiles`; whitelisted to that one filename (no path traversal); public
  (`require-authentication="false"`, inherited). CloudFlare passes the range through fine.
- `india-style.js` source = `pmtiles://<origin>/zenithstatic/maptiles/india.pmtiles`; `zenith-map.js`
  registers the pmtiles protocol.

No nginx block, no `/opt/deploy/...` file. (An earlier iteration served it from the host via an nginx
`location ^~ /maptiles/` byte-range block — that was removed once the in-container transition landed.)

## FALLBACK / alternative: static z/x/y pyramid (no byte-range, no custom handler)

Serve a plain **z/x/y `.pbf` pyramid** through Moqui's ordinary static (`india/{z}/{x}/{y}.pbf`, raw MVT,
lower max zoom, ~779 files). No Range needed. To switch: regenerate the pyramid (below), set the
`india-style.js` source to `tiles: ["<origin>/zenithstatic/maptiles/india/{z}/{x}/{y}.pbf"]` (maxzoom 8),
and remove the pmtiles.js dependency from `zenith-map.js`. `build/gen-style2.js` toggles the source on
one line.

## Regenerate

Prereqs: the `pmtiles` CLI (github.com/protomaps/go-pmtiles) + Node with `npm i pmtiles @protomaps/basemaps`.

```sh
# 1. Extract just India from the public Protomaps planet (range-based — downloads ~India, NOT 137 GB).
#    z0-11 = the active single file (~278 MB); lower --maxzoom for the pyramid (z8 ≈ 31 MB).
pmtiles extract https://demo-bucket.protomaps.com/v4.pmtiles india.pmtiles --bbox=68,6,98,38 --maxzoom=11
#    -> place india.pmtiles next to this README, then deploy it INTO the container image, e.g.:
#       docker cp india.pmtiles deploy-moqui-1:/opt/moqui/runtime/component/zenith-erp-app/screen/zenithstatic/maptiles/india.pmtiles
#       (then docker commit deploy-moqui-1 zetaerp-moqui:latest)

# 2. (pyramid fallback only) dump india.pmtiles -> pyramid/india/{z}/{x}/{y}.pbf  (raw MVT):
node build/extract-pyramid.js

# 3. Regenerate ../js/india-style.js (Protomaps LIGHT flavor, labels -> name:en + one self-hosted Latin
#    font, sprite-icon layers stripped):
node build/gen-style2.js
```

Glyphs (`../fonts/NotoSans-Regular/{range}.pbf`) come from
`https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/{range}.pbf` (ranges 0-255,
256-511, 512-767 — Latin covers all major Indian cities via name:en).
