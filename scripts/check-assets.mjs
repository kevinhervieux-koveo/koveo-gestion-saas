#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist', 'public');

const SCAN_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.cjs', '.json']);
const ASSET_EXT_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|pdf)$/i;

const IMG_SRC_RE = /<img\b[^>]*?\bsrc=(?:"([^"]+)"|'([^']+)')/gi;
const HTML_HREF_RE = /<(?:link|a|use|image)\b[^>]*?\b(?:href|xlink:href)=(?:"([^"]+)"|'([^']+)')/gi;
const SCRIPT_SRC_RE = /<script\b[^>]*?\bsrc=(?:"([^"]+)"|'([^']+)')/gi;
const SRCSET_RE = /\bsrcset=(?:"([^"]+)"|'([^']+)')/gi;
const CSS_URL_RE = /url\(\s*(?:"([^")]+)"|'([^')]+)'|([^)'"\s]+))\s*\)/gi;
const JS_STRING_ASSET_RE = /["'`](\/[A-Za-z0-9_./@-]*?\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|pdf))["'`]/gi;

if (!existsSync(DIST)) {
  console.error(`[check-assets] FAIL: build directory not found at ${DIST}`);
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function isExternal(url) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:');
}

function stripFragmentAndQuery(url) {
  return url.split('#')[0].split('?')[0];
}

function resolveDistPath(url, sourceFile) {
  const cleaned = stripFragmentAndQuery(url);
  if (!cleaned) return null;
  if (cleaned.startsWith('/')) {
    return join(DIST, cleaned);
  }
  const sourceDir = sourceFile ? join(sourceFile, '..') : DIST;
  return resolve(sourceDir, cleaned);
}

function pushMatches(refs, regex, content, file, label) {
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(content)) !== null) {
    const url = m[1] || m[2] || m[3];
    if (!url) continue;
    refs.push({ url, file, label });
  }
}

function expandSrcset(value) {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function collectReferences(file) {
  const ext = posix.extname(file).toLowerCase();
  if (!SCAN_EXTENSIONS.has(ext)) return [];
  const content = await readFile(file, 'utf8');
  const refs = [];

  if (ext === '.html') {
    pushMatches(refs, IMG_SRC_RE, content, file, '<img src>');
    pushMatches(refs, HTML_HREF_RE, content, file, '<link/a href>');
    pushMatches(refs, SCRIPT_SRC_RE, content, file, '<script src>');
    let m;
    SRCSET_RE.lastIndex = 0;
    while ((m = SRCSET_RE.exec(content)) !== null) {
      const value = m[1] || m[2] || '';
      for (const url of expandSrcset(value)) {
        refs.push({ url, file, label: 'srcset' });
      }
    }
    pushMatches(refs, CSS_URL_RE, content, file, 'inline url()');
  } else if (ext === '.css') {
    pushMatches(refs, CSS_URL_RE, content, file, 'css url()');
  } else {
    pushMatches(refs, JS_STRING_ASSET_RE, content, file, 'js string asset');
  }

  return refs;
}

const allRefs = [];
for await (const file of walk(DIST)) {
  const refs = await collectReferences(file);
  allRefs.push(...refs);
}

const missing = [];
const seen = new Set();
let checked = 0;

for (const ref of allRefs) {
  if (isExternal(ref.url)) continue;
  const cleaned = stripFragmentAndQuery(ref.url);
  if (!cleaned || cleaned.startsWith('#')) continue;
  if (!cleaned.startsWith('/') && !ASSET_EXT_PATTERN.test(cleaned)) continue;
  const resolvedPath = resolveDistPath(ref.url, ref.file);
  if (!resolvedPath) continue;
  const dedupeKey = `${resolvedPath}|${ref.file}`;
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);
  checked++;
  if (!existsSync(resolvedPath)) {
    missing.push({ ...ref, resolvedPath });
  }
}

if (missing.length > 0) {
  console.error(`\n[check-assets] FAIL: ${missing.length} missing asset reference(s) in ${DIST}:`);
  for (const m of missing) {
    const rel = m.file.startsWith(ROOT) ? m.file.slice(ROOT.length + 1) : m.file;
    console.error(`  - [${m.label}] ${m.url}`);
    console.error(`      referenced by: ${rel}`);
    console.error(`      expected at:   ${m.resolvedPath}`);
  }
  process.exit(1);
}

console.log(`[check-assets] OK: verified ${checked} static asset reference(s) in ${DIST}.`);
