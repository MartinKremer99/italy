/**
 * Fetch driving routes from OSRM and write data/route.geojson
 * Run: npm run build:route
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SEGMENTS = [
  {
    id: 'outbound',
    label: 'Hinweg',
    stopIds: ['lux', 'innsbruck', 'pesaro', 'bari'],
  },
  {
    id: 'italy',
    label: 'Italien',
    stopIds: ['bari', 'matera', 'rome', 'siena', 'bologna', 'stresa'],
  },
  {
    id: 'return',
    label: 'Rückweg',
    stopIds: ['stresa', 'lux-end'],
  },
];

const STOPS = {
  lux: [6.1319, 49.6116],
  innsbruck: [11.4041, 47.2692],
  pesaro: [12.9133, 43.9097],
  bari: [16.8719, 41.1171],
  matera: [16.6043, 40.6664],
  rome: [12.4964, 41.9028],
  siena: [11.3308, 43.3188],
  bologna: [11.3426, 44.4949],
  stresa: [8.5298, 45.8842],
  'lux-end': [6.1319, 49.6116],
};

async function fetchSegment(segment) {
  const coords = segment.stopIds.map((id) => STOPS[id].join(',')).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${segment.id}: ${res.status}`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]?.geometry) {
    throw new Error(`OSRM ${segment.id}: no route`);
  }
  return {
    type: 'Feature',
    properties: { segment: segment.id, label: segment.label },
    geometry: json.routes[0].geometry,
  };
}

async function main() {
  const features = [];
  for (const seg of SEGMENTS) {
    console.log(`Routing ${seg.label}…`);
    features.push(await fetchSegment(seg));
    await new Promise((r) => setTimeout(r, 1200));
  }

  const geojson = { type: 'FeatureCollection', features };
  const outDir = join(root, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'route.geojson');
  writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`Wrote ${outPath} (${features.length} segments)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
