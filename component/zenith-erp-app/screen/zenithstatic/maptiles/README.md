# Self-hosted map tiles (Contacts dashboard Contact Map)

`india/{z}/{x}/{y}.pbf` is a static z/x/y **vector tile pyramid** (Protomaps v4 schema, raw MVT,
z0–8, ~779 files / ~31 MB) covering India. It powers the Contacts dashboard **Contact Map**
(`zenith-map.js` → `india-style.js` → this pyramid), giving a real interactive map with **zero
external/runtime dependency** — MapLibre, the style, the glyphs, and these tiles are all served from
this server. Moqui's ordinary static serving is enough (no HTTP byte-range needed, unlike a `.pmtiles`).

The `.pbf` tiles themselves are **git-ignored** (build artifact, regenerable — see `.gitignore`); the
build scripts below are committed so the pyramid is reproducible.

## Regenerate the tiles

Prereqs: the `pmtiles` CLI (github.com/protomaps/go-pmtiles) and Node with
`npm i pmtiles @protomaps/basemaps`.

```sh
# 1. Extract just India from the public Protomaps planet PMTiles (range-based; downloads ~India only,
#    NOT the 137 GB planet). --maxzoom governs size: z8≈31MB(pyramid), z11≈278MB, z13≈1.4GB.
pmtiles extract https://demo-bucket.protomaps.com/v4.pmtiles india.pmtiles \
  --bbox=68,6,98,38 --maxzoom=8

# 2. Dump it to a raw-MVT z/x/y pyramid under ./pyramid/india/  (getZxy auto-gunzips the gzip tiles).
node build/extract-pyramid.js          # writes pyramid/india/{z}/{x}/{y}.pbf
#    then move/copy pyramid/india -> ./india

# 3. Regenerate the MapLibre style (../js/india-style.js): Protomaps LIGHT flavor with every label
#    collapsed to name:en + one self-hosted Latin font, sprite-icon layers stripped.
node build/gen-style2.js               # writes india-style.js (place it at ../js/india-style.js)
```

Glyphs (`../fonts/NotoSans-Regular/{range}.pbf`) come from
`https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/{range}.pbf`
(ranges 0-255, 256-511, 512-767 cover Latin / all major Indian cities via name:en).

## Optional upgrade: single-file `.pmtiles` + nginx byte-range

A full-zoom single file is more efficient than 779 static tiles, but pmtiles.js **requires HTTP 206
range**, which Moqui can't serve — only nginx can. Serve `india.pmtiles` from disk via an nginx
`location ^~ /maptiles/ { alias /opt/deploy/maptiles/; }` block, then point the `india-style.js`
source at `pmtiles://<origin>/maptiles/india.pmtiles` (and re-add `pmtiles.js` to `zenith-map.js`).
