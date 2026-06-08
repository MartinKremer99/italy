#!/usr/bin/env node
/**
 * Sync showcase assets into public/ before build (Vercel / dist).
 * Source of truth: reise-showcase.html (root) + showcase/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const showcaseDir = path.join(root, 'showcase');

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === '.DS_Store') continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// HTML: relative showcase paths → absolute (Vercel root)
const htmlSrc = path.join(root, 'reise-showcase.html');
let html = fs.readFileSync(htmlSrc, 'utf8');
html = html.replace(
  /<html lang="de"[^>]*>/,
  '<html lang="de" data-img-base="/showcase/images" data-route-url="/showcase/route.geojson">'
);
html = html
  .replace(/src="showcase\//g, 'src="/showcase/')
  .replace(/href="showcase\//g, 'href="/showcase/');
fs.writeFileSync(path.join(publicDir, 'reise-showcase.html'), html);

// Assets: showcase/ → public/showcase/ (images only; keep synced HTML above)
const pubShowcase = path.join(publicDir, 'showcase');
rmrf(path.join(pubShowcase, 'showcase'));
rmrf(path.join(pubShowcase, 'images', 'images'));
for (const name of ['images', 'route.geojson', 'showcase-app.js', 'showcase-data.js', 'ATTRIBUTION.md']) {
  const s = path.join(showcaseDir, name);
  if (!fs.existsSync(s)) continue;
  const d = path.join(pubShowcase, name);
  if (fs.statSync(s).isDirectory()) copyDir(s, d);
  else cp(s, d);
}

console.log('Synced showcase → public/');
