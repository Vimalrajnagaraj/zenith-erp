const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const { PMTiles } = require('pmtiles');

class NodeSource {
  constructor(fp) { this.fd = fs.openSync(fp, 'r'); this._key = fp; }
  getKey() { return this._key; }
  async getBytes(offset, length) {
    const buf = Buffer.alloc(length);
    fs.readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  }
}
async function nodeDecompress(buf, compression) {
  const b = Buffer.from(buf);
  if (compression === 2) return zlib.gunzipSync(b).buffer;
  if (compression === 4) return zlib.brotliDecompressSync(b).buffer;
  return buf;
}
function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function lat2tile(lat, z) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)); }

const BBOX = [68, 6, 98, 38];       // India
const MAXZOOM = 8;
const OUT = 'pyramid/india';

(async () => {
  const p = new PMTiles(new NodeSource('india.pmtiles'), undefined, nodeDecompress);
  let files = 0, bytes = 0;
  for (let z = 0; z <= MAXZOOM; z++) {
    const x0 = lon2tile(BBOX[0], z), x1 = lon2tile(BBOX[2], z);
    const y0 = lat2tile(BBOX[3], z), y1 = lat2tile(BBOX[1], z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const t = await p.getZxy(z, x, y);
        if (!t) continue;
        const dir = path.join(OUT, String(z), String(x));
        fs.mkdirSync(dir, { recursive: true });
        const data = Buffer.from(t.data);
        fs.writeFileSync(path.join(dir, y + '.pbf'), data);
        files++; bytes += data.length;
      }
    }
    process.stdout.write('z' + z + ' done; ');
  }
  console.log('\nwrote ' + files + ' tiles, ' + (bytes / 1e6).toFixed(1) + ' MB raw MVT');
})();
