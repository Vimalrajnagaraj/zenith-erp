#!/usr/bin/env node
'use strict';
// Guard against Moqui form controls whose NAME collides with a DOM property Vue reads during render
// (tagName / nodeName / nodeType). HTMLFormElement is [LegacyOverrideBuiltins], so a named control
// SHADOWS the form's inherited property: form.tagName then returns the <input> element instead of the
// "FORM" string, and Vue's virtual-DOM patch does form.tagName.indexOf(...) on it ->
// "TypeError: t.tagName.indexOf is not a function" -> the whole /qapps page renders BLANK.
// (Bit ZE-CONTACTS-018: PartyTag's PK field is tagName, auto-emitted as <input name="tagName"> by the
// Tags form-list.) Three sources of such a control:
//   (a) a <link parameter-map="[... tagName:x ...]">  -> emits <input name="tagName">
//   (b) a <field name="tagName"> input inside a form
//   (c) a <form-list> fed by an <entity-find> of an entity whose PK field is tagName + a per-row
//       link/submit -> the form-list auto-adds the row PK as <input name="tagName">
// Fix: rename the control (parameter-map key / field), or feed the form-list plain maps keyed with a
// safe name instead of the entity values.
//
// Usage: node docs/infra/lint-form-dom-collisions.js [component-dir]   (default: ./component)
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || 'component';
const DANGER = new Set(['tagName', 'nodeName', 'nodeType', 'namespaceURI', 'localName']);

if (!isDir(DIR)) { console.error(`FAIL: component dir not found: ${DIR}`); process.exit(1); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }

const xml = [];
(function walk(d) {
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const e of es) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name === '.git' || e.name === 'node_modules') continue; walk(p); }
    else if (p.endsWith('.xml')) xml.push(p);
  }
})(DIR);

const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const disp = (p) => p.replace(/\\/g, '/');
const lineOf = (text, idx) => { let n = 1; for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') n++; return n; };

// Map every entity's fully-qualified name -> set of PK field names that are DANGER names.
const entityDangerPk = new Map();   // "package.EntityName" -> [pk names in DANGER]
for (const f of xml) {
  const t = read(f);
  for (const m of t.matchAll(/<entity\s+entity-name="([A-Za-z0-9_]+)"\s+package="([A-Za-z0-9_.]+)"([\s\S]*?)<\/entity>/g)) {
    const full = m[2] + '.' + m[1];
    const bad = [];
    for (const fm of m[3].matchAll(/<field\s+name="([A-Za-z0-9_]+)"[^>]*\bis-pk="true"/g)) {
      if (DANGER.has(fm[1])) bad.push(fm[1]);
    }
    if (bad.length) entityDangerPk.set(full, bad);
  }
}

const findings = [];
for (const f of xml) {
  const t = read(f);

  // (a) parameter-map keys that are DANGER names
  for (const m of t.matchAll(/parameter-map="(\[[^"]*\])"/g)) {
    for (const km of m[1].matchAll(/([A-Za-z0-9_]+)\s*:/g)) {
      if (DANGER.has(km[1])) findings.push(`${disp(f)}:${lineOf(t, m.index)}  parameter-map key '${km[1]}' emits <input name="${km[1]}"> which shadows form.${km[1]} (Vue render crash)`);
    }
  }

  // (b) <field name="DANGER"> with an input-ish widget (text-line/hidden/drop-down/...) — a display is harmless
  for (const m of t.matchAll(/<field\s+name="([A-Za-z0-9_]+)"([\s\S]{0,400}?)<\/field>/g)) {
    if (!DANGER.has(m[1])) continue;
    if (/<(text-line|text-area|hidden|drop-down|radio|check|date-time|date-find|text-find|password|file)\b/.test(m[2])) {
      findings.push(`${disp(f)}:${lineOf(t, m.index)}  <field name="${m[1]}"> is a form input shadowing form.${m[1]} (Vue render crash)`);
    }
  }

  // (c) form-list fed by an entity-find of a DANGER-PK entity, with a per-row link/submit
  if (entityDangerPk.size) {
    // list-var -> entity from entity-finds in this file
    const listEntity = new Map();
    for (const ef of t.matchAll(/<entity-find\s+entity-name="([A-Za-z0-9_.]+)"[^>]*\blist="([A-Za-z0-9_]+)"/g)) listEntity.set(ef[2], ef[1]);
    for (const ef of t.matchAll(/<entity-find\s+[^>]*\blist="([A-Za-z0-9_]+)"[^>]*\bentity-name="([A-Za-z0-9_.]+)"/g)) listEntity.set(ef[1], ef[2]);
    for (const fl of t.matchAll(/<form-list\s+[^>]*\blist="([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/form-list>/g)) {
      const ent = listEntity.get(fl[1]);
      if (ent && entityDangerPk.has(ent) && /<link\b|<submit\b/.test(fl[2])) {
        findings.push(`${disp(f)}:${lineOf(t, fl.index)}  <form-list list="${fl[1]}"> over ${ent} (PK ${entityDangerPk.get(ent).join(',')}) with a per-row link/submit auto-emits <input name="${entityDangerPk.get(ent)[0]}"> (Vue render crash). Feed it plain maps keyed with a safe name instead.`);
      }
    }
  }
}

if (findings.length) {
  console.error('FAIL: form control name(s) collide with a DOM property Vue reads (tagName/nodeName/nodeType)');
  console.error('      -> the control shadows form.<name>, crashing the /qapps render (blank page). See ZE-CONTACTS-018.');
  for (const x of findings) console.error('  ' + x);
  process.exit(1);
}
console.log('lint-form-dom-collisions: OK — no form controls named after a Vue-render DOM property.');
