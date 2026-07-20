#!/usr/bin/env node
'use strict';
// ZE-GATE-004 guard (Node port of lint-cross-module-transitions.sh, 2026-07-20).
// Same invariant, ~100x faster: the shell version spawned ~3000 subprocesses (per-file sed/grep,
// per-hit greps, a whole-tree `grep -rl` per js) which on Windows Git Bash (~30ms/fork) took ~2min
// and hit the pre-commit timeout. This does it all in one process.
//
// Keeps the cross-module transition registry honest: a <transition> in module B targeted by a URL
// from module A must be registered in the _sharedTx map (// SHARED-TX) in SecurityServices.xml, or
// the plan gate (which infers the module from the URL) blocks it for any tenant whose plan lacks B
// even though it grants A. Cross-module URLs pointing at a SCREEN are fine (gated at render). Also
// flags a registry entry naming a transition that no longer exists (rot).
//
// Usage: node docs/infra/lint-cross-module-transitions.js [component-dir]   (default: ./component)
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || 'component';
const REG = path.join(DIR, 'zenith-erp-base/service/zenith/base/SecurityServices.xml');

if (!isDir(DIR)) { console.error(`FAIL: component dir not found: ${DIR}`); process.exit(1); }
if (!isFile(REG)) { console.error(`FAIL: _sharedTx registry not found: ${REG}`); process.exit(1); }

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
function isFile(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }

const _cache = new Map();
function read(f) { let t = _cache.get(f); if (t === undefined) { try { t = fs.readFileSync(f, 'utf8'); } catch (e) { t = ''; } _cache.set(f, t); } return t; }

// The module owning a screen/js file = the first path segment under .../screen/zenith/ .
// Handles .../screen/zenith/<mod>/Sub/File.xml and a module root .../screen/zenith/<mod>.xml .
// Empty for shared static assets (.../screen/zenithstatic/...), which own no module.
function modof(p) {
  p = p.replace(/\\/g, '/');
  let m = p.match(/\/screen\/zenith\/([^/]+)\//);
  if (m) return m[1].toLowerCase();
  m = p.match(/\/screen\/zenith\/([^/]+)\.xml$/);
  if (m) return m[1].toLowerCase();
  return '';
}

const xmlFiles = [], jsFiles = [];
(function walk(dir) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === '.git' || e.name === 'node_modules') continue; walk(p); }
    else if (e.isFile()) { if (p.endsWith('.xml')) xmlFiles.push(p); else if (p.endsWith('.js')) jsFiles.push(p); }
  }
})(DIR);

// (1) Every transition that exists, as "<module>:<transitionName>".
const tx = new Set();
for (const f of xmlFiles) {
  const m = modof(f); if (!m) continue;
  for (const mm of read(f).matchAll(/<transition name="([A-Za-z0-9_]+)"/g)) tx.add(m + ':' + mm[1]);
}

// (2) Every transition REGISTERED as legitimately cross-module (the "// SHARED-TX" map entries).
const reg = new Set();
for (const line of read(REG).split('\n')) {
  if (/'[a-z0-9]+:[A-Za-z0-9_]+'\s*:.*\/\/ SHARED-TX/.test(line)) {
    const q = line.match(/'([^']+)'/);
    if (q) reg.add(q[1]);
  }
}

// A shared static js has no module in its path — it belongs to whichever screen(s) LOAD it.
function ownersOfJs(f) {
  const b = path.basename(f);
  const s = new Set();
  for (const x of xmlFiles) if (read(x).includes(b)) { const m = modof(x); if (m) s.add(m); }
  return [...s].sort();
}

// (3) HARD FAIL: a URL that targets another module's TRANSITION without being registered.
const URLRE = /\/(?:apps|qapps)\/zenith\/[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)+/g;
const bad = [];
let rc = 0;
for (const f of xmlFiles.concat(jsFiles)) {
  const lines = read(f).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const um of lines[i].matchAll(URLRE)) {
      const url = um[0];
      const tgt = url.replace(/^\/(?:apps|qapps)\/zenith\/([^/]+)\/.*$/, '$1').toLowerCase();
      const last = url.slice(url.lastIndexOf('/') + 1);
      // Not a transition of that module -> it's a screen link (case-sensitive so screen "CreateOrder"
      // is never confused with transition "createOrder").
      if (!tx.has(tgt + ':' + last)) continue;
      let owners = modof(f); owners = owners ? [owners] : ownersOfJs(f);
      if (owners.includes(tgt)) continue;                 // same module -> fine
      if (reg.has(tgt + ':' + last)) continue;            // registered -> fine
      bad.push(`${f.replace(/\\/g, '/')}:${i + 1}  ->  ${tgt}:${last}   (called from module: ${owners.length ? owners.join(' ') : 'UNKNOWN'})`);
    }
  }
}

if (bad.length) {
  console.error('FAIL: cross-module transition call(s) not registered in _sharedTx (plan gate will block them');
  console.error('      for any tenant whose plan lacks the TARGET module, even though it grants the CALLING one):');
  for (const b of bad) console.error('  ' + b);
  console.error(`  -> register each in the _sharedTx map in ${REG.replace(/\\/g, '/')}, e.g.`);
  console.error("     'barcode:renderLabels': ['pos'] as Set   // SHARED-TX");
  console.error("     then prove it with: check#ModulePlanAccess {moduleId:'<tgt>', transitionName:'<tx>', planModules:['<caller>']}");
  rc = 1;
}

// (4) HARD FAIL the other way: a registry entry naming a transition that no longer exists = rot.
for (const e of [...reg].sort()) {
  if (!tx.has(e)) { console.error(`FAIL: _sharedTx registers '${e}' but no such transition exists — stale entry.`); rc = 1; }
}

if (rc === 0) console.log(`lint-cross-module-transitions: OK — ${reg.size} registered shared transition(s), no unregistered cross-module calls.`);
process.exit(rc);
