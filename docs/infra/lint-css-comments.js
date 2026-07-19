#!/usr/bin/env node
'use strict';
// CSS comment guard. A '*/' is only ever legal as the terminator of a '/* … */' comment,
// so a '*/' encountered OUTSIDE comment state means an earlier comment contained an inner
// '*/' that closed it early — silently dropping the CSS rule that follows (the recurring
// footgun that bit the /apps light-mode theme fix and ZE-CONTACTS-028). Also flags an
// unterminated '/*'. Scans authored .css files AND CSS inside XML <style>…</style> blocks
// (the per-screen <style> injection pattern from ~/CLAUDE.md). Exit 1 on any violation.
const fs = require('fs');
const path = require('path');

// Walk `text` as CSS, tracking comment/string state. `startLine` = 1-based line of text[0]
// in the source file (so XML <style> blocks report real file line numbers). Returns issues.
function scanCss(text, startLine) {
  const errs = [];
  let state = 'code'; // code | comment | sq | dq
  let line = startLine || 1;
  let col = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '\n') {
      if (state === 'sq' || state === 'dq') state = 'code'; // CSS strings can't span raw newlines
      line++; col = 1;
      continue;
    }
    if (state === 'code') {
      if (c === '/' && n === '*') { state = 'comment'; i++; col += 2; continue; }
      if (c === '*' && n === '/') {
        errs.push({ line, col, msg: "stray '*/' outside any comment — an earlier '/* … */' comment almost certainly contains an inner '*/' that closed it early, silently dropping the rule that follows" });
        i++; col += 2; continue;
      }
      if (c === "'") { state = 'sq'; col++; continue; }
      if (c === '"') { state = 'dq'; col++; continue; }
      col++;
      continue;
    }
    if (state === 'comment') {
      if (c === '*' && n === '/') { state = 'code'; i++; col += 2; continue; }
      col++;
      continue;
    }
    // string states: honor backslash escapes so content:"a\"b" and content:"a */ b" don't confuse us
    if (c === '\\') { i++; col += 2; continue; }
    if (state === 'sq' && c === "'") { state = 'code'; col++; continue; }
    if (state === 'dq' && c === '"') { state = 'code'; col++; continue; }
    col++;
  }
  if (state === 'comment') {
    errs.push({ line, col, msg: "unterminated '/*' comment (no closing '*/' before end of block)" });
  }
  return errs;
}

function styleBlocks(text) {
  const blocks = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const content = m[1];
    const openLen = m[0].match(/^<style\b[^>]*>/i)[0].length;
    const contentStart = m.index + openLen;
    let line = 1;
    for (let i = 0; i < contentStart; i++) if (text[i] === '\n') line++;
    blocks.push({ content, startLine: line });
  }
  return blocks;
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (e.isFile() && (p.endsWith('.css') || p.endsWith('.xml'))) {
      out.push(p);
    }
  }
}

const baseDir = process.argv[2] || 'component';
const files = [];
walk(baseDir, files);
let total = 0;
for (const f of files) {
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  let errs = [];
  if (f.endsWith('.css')) {
    errs = scanCss(text, 1);
  } else {
    for (const b of styleBlocks(text)) errs = errs.concat(scanCss(b.content, b.startLine));
  }
  for (const e of errs) { console.error(`${f}:${e.line}:${e.col}: ${e.msg}`); total++; }
}
if (total > 0) {
  console.error(`\nlint-css-comments: FAIL — ${total} CSS comment issue(s). A '*/' inside a '/* … */' comment closes it early; reword the comment to remove the inner '*/'.`);
  process.exit(1);
}
console.log('lint-css-comments: OK — no stray/unbalanced CSS comment terminators in .css files or XML <style> blocks.');
