#!/usr/bin/env node
/**
 * Download showcase images from Wikimedia (places + hotels).
 */
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../showcase/images');
const HOTELS = path.join(OUT, 'hotels');
const UA = 'ItalyRoadtrip2026/1.0 (personal showcase; local use)';
const DELAY_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {Record<string, { wiki?: string; search?: string; knownFile?: string }>} */
const PLACES = {
  hero: { wiki: 'Polignano a Mare' },
  story: { search: 'Italy landscape coast road' },
  innsbruck: { wiki: 'Innsbruck', search: 'Goldenes Dachl Innsbruck' },
  pesaro: { wiki: 'Pesaro', search: 'Pesaro Adriatic beach Italy' },
  bari: { wiki: 'Bari', search: 'Bari Vecchia Italy' },
  wedding: { search: 'Trulli Alberobello Apulia' },
  matera: { wiki: 'Matera', search: 'Sassi di Matera', knownFile: 'Sassi von Matera (3).jpg' },
  rome: { wiki: 'Colosseum', search: 'Colosseum Rome' },
  siena: { wiki: 'Siena', search: 'Piazza del Campo Siena' },
  tuscany: { wiki: "Val d'Orcia", search: 'Val d Orcia Tuscany' },
  bologna: { wiki: 'Bologna', search: 'Two Towers Bologna' },
  stresa: { wiki: 'Stresa', search: 'Stresa Lake Maggiore' },
  drive: { wiki: 'Simplon Pass', search: 'Simplon Pass road Alps' },
};

/** @type {Record<string, { search: string; wiki?: string }>} */
const HOTEL_IMAGES = {
  'hotel-innsbruck.jpg': { search: 'Innsbruck hotel building Austria', wiki: 'Innsbruck' },
  'hotel-pesaro.jpg': { search: 'Pesaro lungomare hotel beach' },
  'hotel-matera.jpg': { search: 'Matera cave hotel Sassi accommodation', wiki: 'Matera' },
  'hotel-rome.jpg': { search: 'Rome hotel building Prati', wiki: 'Rome' },
  'hotel-siena.jpg': { search: 'Siena Tuscany hotel palazzo', wiki: 'Siena' },
  'hotel-bologna.jpg': { search: 'Bologna portico hotel Piazza Maggiore', wiki: 'Bologna' },
  'hotel-stresa.jpg': { search: 'Stresa Lake Maggiore hotel facade', wiki: 'Stresa' },
};

function fetchUrl(url, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        return resolve(fetchUrl(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${url} → HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

function fetchJson(url) {
  return fetchUrl(url).then((buf) => JSON.parse(buf.toString('utf8')));
}

async function wikiPageThumb(title) {
  const q = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'pageimages',
    pithumbsize: '1400',
    format: 'json',
  });
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${q}`);
  const page = Object.values(data.query.pages)[0];
  if (page.missing) return null;
  return page.thumbnail?.source ?? null;
}

async function commonsSearchThumb(search) {
  const q = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gssearch: search,
    gsnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '1400',
    format: 'json',
  });
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${q}`);
  const pages = data.query?.pages ?? {};
  let best = null;
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/jpe?g$/i.test(ii.mime ?? '') || (ii.size ?? 0) < 50000) continue;
    const url = ii.thumburl || ii.url;
    if (!best || ii.size > best.size) best = { url, title: p.title, size: ii.size };
  }
  return best?.url ?? null;
}

async function knownFileUrl(fileName) {
  const encoded = encodeURIComponent(fileName.replace(/ /g, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=1400`;
}

async function resolveUrl(spec) {
  if (spec.knownFile) {
    try {
      const buf = await fetchUrl(await knownFileUrl(spec.knownFile));
      if (buf.length > 20000) return { url: 'knownFile', buf };
    } catch {
      /* fall through */
    }
  }
  if (spec.wiki) {
    const t = await wikiPageThumb(spec.wiki);
    if (t) return { url: t };
  }
  if (spec.search) {
    const t = await commonsSearchThumb(spec.search);
    if (t) return { url: t };
  }
  return null;
}

async function fetchWithRetry(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchUrl(url);
    } catch (e) {
      if (String(e).includes('429') && i < attempts - 1) {
        await sleep(8000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

async function downloadNamed(filename, spec) {
  const resolved = await resolveUrl(spec);
  if (!resolved) throw new Error(`No image found for ${filename}`);
  const buf = resolved.buf ?? (await fetchWithRetry(resolved.url));
  if (buf.length < 15000) throw new Error(`${filename}: only ${buf.length} bytes`);
  const dest = filename.startsWith('hotel-') ? path.join(HOTELS, filename) : path.join(OUT, filename);
  fs.writeFileSync(dest, buf);
  const src = resolved.url === 'knownFile' ? spec.knownFile : resolved.url;
  console.log(`✓ ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
  await sleep(DELAY_MS);
}

async function main() {
  fs.mkdirSync(HOTELS, { recursive: true });
  for (const [name, spec] of Object.entries(PLACES)) {
    await downloadNamed(`${name}.jpg`, spec);
  }
  for (const [name, spec] of Object.entries(HOTEL_IMAGES)) {
    await downloadNamed(name, spec);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
