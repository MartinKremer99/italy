# Italien-Roadtrip 2026

Persönlicher Buchungsplan und interaktive Reiseroute (Luxemburg → Bari → Italien → Luxemburg, 27.07.–08.08.2026).

## Zwei Modi

- **Planen** — Geführte Buchungsschritte (Jetzt) und Nachschlagen (Details, Budget, Liste)
- **Reise** — Interaktive Karte (Route + Hotel/Restaurant/Ticket-Pins), **Tages-Cockpit** (Fahrt, Conf.#, Google/Apple Maps), Tagesliste mit „Heute“-Filter, Drucken & Link teilen; Unterwegs-Checklisten & ZTL

## Entwicklung

```bash
npm install
npm run dev
```

Öffnet [http://localhost:5173](http://localhost:5173) mit Hot Reload. Die App läuft als **ein Vite-Bundle** (`main.js`); die Karte nutzt Leaflet (CARTO Voyager-Tiles, kostenlos, kein API-Key).

**Wetter** im Reise-Cockpit: [Open-Meteo](https://open-meteo.com/) (kostenlos) — Prognose bis 16 Tage vor dem Datum, davor Klima-Werte vom Vorjahr als Orientierung.

## Produktion bauen

```bash
npm run build
npm run preview
```

Vor jedem Build wird `npm run sync:showcase` ausgeführt (`reise-showcase.html` + `showcase/` → `public/`).

**Live-URLs nach Deploy:**

| Seite | Pfad |
|--------|------|
| Buchungs-App (PWA) | `/` |
| Reise-Showcase (Karte, Hotels, Fotos) | `/reise-showcase.html` |

## GitHub + Vercel

1. **Repo anlegen** (im Projektordner):

   ```bash
   cd italy-roadtrip-2026
   git init
   git add .
   git commit -m "Initial commit: roadtrip app + showcase"
   gh repo create italy-roadtrip-2026 --private --source=. --push
   ```

   (Oder auf github.com ein leeres Repo erstellen und `git remote add origin …` + `git push -u origin main`.)

2. **Vercel:** [vercel.com](https://vercel.com) → **Add New Project** → GitHub-Repo importieren.

   Vercel erkennt Vite automatisch (`vercel.json` ist bereits gesetzt):

   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Deploy** — jeder Push auf `main` baut neu.

4. **Showcase-Bilder:** unter `showcase/images/` ablegen, dann lokal `npm run sync:showcase` oder einfach neu deployen (`prebuild` synct mit).

PWA: `manifest.json` + `sw.js` liegen in `public/` und landen in `dist/`.

## Route neu berechnen

Wenn sich Stationen in `data.js` (`routeStops`) ändern:

```bash
npm run build:route
```

Schreibt `data/route.geojson` über die öffentliche OSRM-API (Hinweg / Italien / Rückweg).

## Optional: Mapbox

Für Premium-Karten später `.env` anlegen:

```
VITE_MAP_PROVIDER=mapbox
VITE_MAPBOX_TOKEN=pk....
```

(v1 nutzt standardmäßig OSM/CARTO.)

## Daten & Speicher

- Fakten in `data.js` (Hotels, Restaurants, Tage, Links)
- Fortschritt in `localStorage` (`italy-roadtrip-2026-state`)
- Export/Import über Header-Buttons

## Struktur

| Pfad | Rolle |
|------|--------|
| `main.js` | Vite-Einstieg (Leaflet + Karte) |
| `js/flow.js` | Buchungs-Aktionsliste |
| `js/map-itinerary.js` | Interaktive Karte |
| `js/weather.js` | Open-Meteo Wetter im Tages-Cockpit |
| `main.js` | Vite-Einstieg (gesamte App) |
| `js/render.js` | DOM-Rendering |
| `data/route.geojson` | Vorberechnete Fahrstrecke |
| `scripts/build-route.mjs` | OSRM-Build-Skript |
