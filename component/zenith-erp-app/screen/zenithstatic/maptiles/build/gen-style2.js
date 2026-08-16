const fs = require('fs');
const { layers, namedFlavor } = require('@protomaps/basemaps');
const flavor = namedFlavor('light');
let L = layers('protomaps', flavor, { lang: 'en' });

let simplified = 0, iconsStripped = 0;
L.forEach(l => {
  if (l.layout) {
    // Collapse every label to a single Latin font + English-preferred name.
    if (l.layout['text-field'] !== undefined) {
      l.layout['text-field'] = ["coalesce", ["get","name:en"], ["get","name"]];
      l.layout['text-font'] = ["NotoSans-Regular"];
      simplified++;
    }
    // Drop sprite-icon dependencies (no sprite is self-hosted). Keep any text.
    if (l.layout['icon-image'] !== undefined) {
      Object.keys(l.layout).forEach(k => { if (k.indexOf('icon-') === 0) delete l.layout[k]; });
      iconsStripped++;
    }
  }
  if (l.paint) Object.keys(l.paint).forEach(k => { if (k.indexOf('icon-') === 0) delete l.paint[k]; });
});
// Remove now-empty symbol layers that had ONLY an icon (no text-field left).
const before = L.length;
L = L.filter(l => !(l.type === 'symbol' && l.layout && l.layout['text-field'] === undefined));
console.log('simplified labels:', simplified, '| icon layers stripped:', iconsStripped, '| empty-symbol layers removed:', before - L.length, '| final layers:', L.length);

const LAYERS_JSON = JSON.stringify(L);
const out =
'/* ZE-CONTACT-MAP self-hosted style: Protomaps basemap v5.7.2 LIGHT flavor, labels collapsed to a single\n' +
'   self-hosted Latin font (NotoSans-Regular via name:en), sprite-icon layers dropped. Builder takes the\n' +
'   page origin so tiles/glyphs resolve to THIS server (zero external dependency). Generated, do not hand-edit. */\n' +
'window.zBuildPmStyle = function (o) {\n' +
'  return {\n' +
'    version: 8,\n' +
'    glyphs: o + "/zenithstatic/fonts/{fontstack}/{range}.pbf",\n' +
'    sources: { protomaps: { type: "vector", tiles: [o + "/zenithstatic/maptiles/india/{z}/{x}/{y}.pbf"], minzoom: 0, maxzoom: 8,\n' +
'      attribution: "\u00A9 <a href=\\"https://openstreetmap.org/copyright\\">OpenStreetMap</a> \u00B7 <a href=\\"https://protomaps.com\\">Protomaps</a>" } },\n' +
'    layers: ' + LAYERS_JSON + '\n' +
'  };\n' +
'};\n';
fs.writeFileSync('india-style.js', out);
console.log('india-style.js:', fs.statSync('india-style.js').size, 'bytes');
