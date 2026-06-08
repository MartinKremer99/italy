#!/usr/bin/env node
/**
 * Fetch main hotel photos from Booking.com property pages (personal use).
 * Run: node scripts/fetch-booking-hotel-images.mjs
 */
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../showcase/images/hotels');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @type {{ file: string; url: string; label: string }[]} */
const HOTELS = [
  {
    file: 'hotel-innsbruck.jpg',
    label: 'Hotel Penz West',
    url: 'https://www.booking.com/hotel/at/sporthotelpenztirol.html',
  },
  {
    file: 'hotel-pesaro.jpg',
    label: 'Hotel Excelsior Pesaro',
    url: 'https://www.booking.com/hotel/it/excelsior-pesaro.html',
  },
  {
    file: 'hotel-matera.jpg',
    label: 'Aquatio Cave',
    url: 'https://www.booking.com/hotel/it/aquatio-cave-luxury-amp-spa.en-gb.html',
  },
  {
    file: 'hotel-rome.jpg',
    label: 'Colonna Inn',
    url: 'https://www.booking.com/hotel/it/colonna-inn-guest-house.html',
  },
  {
    file: 'hotel-siena.jpg',
    label: 'Hotel Palazzo di Valli',
    url: 'https://www.booking.com/hotel/it/hotelpalazzodivallisiena.html',
  },
  {
    file: 'hotel-bologna.jpg',
    label: 'Hotel Roma Bologna',
    url: 'https://www.booking.com/hotel/it/roma-bologna.html',
  },
  {
    file: 'hotel-stresa.jpg',
    label: 'Hotel Regina Palace',
    url: 'https://www.booking.com/hotel/it/regina-palace.html',
  },
];


function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { headers: { 'User-Agent': UA, Referer: 'https://www.booking.com/' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadBuffer(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function extractMainPhoto(page, networkUrls) {
  await page.waitForTimeout(2500);
  const fromNet = networkUrls.filter((u) => u.includes('xdata/images/hotel/max1024'));
  const urls = await page.evaluate(() => {
    const found = new Set();
    const add = (u) => {
      if (!u || typeof u !== 'string') return;
      if (u.includes('bstatic.com') || u.includes('booking.com')) {
        const clean = u.split('?')[0];
        if (/\.(jpg|jpeg|webp)/i.test(clean) || u.includes('/xdata/images/')) found.add(u);
      }
    };
    document.querySelectorAll('img[src], img[data-src], source[srcset]').forEach((el) => {
      add(el.getAttribute('src'));
      add(el.getAttribute('data-src'));
      const srcset = el.getAttribute('srcset');
      if (srcset) srcset.split(',').forEach((p) => add(p.trim().split(/\s+/)[0]));
    });
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent);
        const imgs = j.image || j.photo;
        if (typeof imgs === 'string') add(imgs);
        else if (Array.isArray(imgs)) imgs.forEach(add);
      } catch {
        /* ignore */
      }
    });
    return [...found];
  });

  const all = [...new Set([...fromNet, ...urls])];
  const scored = all
    .map((u) => {
      const m = u.match(/\/(\d+)x(\d+)\//) || u.match(/width=(\d+)/);
      const w = m ? Number(m[1]) : 800;
      const hotelish = /hotel|room|property|xdata/i.test(u) ? 2 : 1;
      return { u, score: w * hotelish };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.u ?? urls[0] ?? null;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'de-DE',
    extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' },
  });

  const results = [];

  for (const hotel of HOTELS) {
    const page = await context.newPage();
    const networkUrls = [];
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('bstatic.com/xdata/images/hotel')) networkUrls.push(u);
    });
    try {
      console.log(`\n→ ${hotel.label}`);
      await page.goto(hotel.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(6000);
      // Dismiss cookie banner if present
      for (const sel of [
        'button#onetrust-accept-btn-handler',
        '[data-testid="accept-btn"]',
        'button:has-text("Accept")',
        'button:has-text("Akzeptieren")',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) await btn.click();
        } catch {
          /* skip */
        }
      }
      let imgUrl = await extractMainPhoto(page, networkUrls);
      if (!imgUrl) throw new Error('No image URL found');
      if (imgUrl.includes('.webp')) imgUrl = imgUrl.replace(/\.webp.*/, '.jpg');
      console.log(`  image: ${imgUrl.slice(0, 90)}…`);
      const buf = await downloadBuffer(imgUrl);
      if (buf.length < 12000) throw new Error(`Image too small (${buf.length} bytes)`);
      const dest = path.join(OUT, hotel.file);
      fs.writeFileSync(dest, buf);
      console.log(`  saved ${hotel.file} (${(buf.length / 1024).toFixed(0)} KB)`);
      results.push({ ...hotel, ok: true });
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      results.push({ ...hotel, ok: false, error: e.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} images saved to ${OUT}`);
  if (ok < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
