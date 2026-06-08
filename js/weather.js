/**
 * Open-Meteo weather (free, no API key) for day cockpit
 */
import { lazyGlobal } from './deps.js';

const TripWeather = (function () {
  'use strict';

  const U = lazyGlobal('TripUtils');
  const TripOps = lazyGlobal('TripOps');
  const CACHE_KEY = 'italy-trip-weather-v1';
  const CACHE_TTL_MS = 60 * 60 * 1000;

  const WMO_LABELS = {
    0: 'Klar',
    1: 'Überwiegend klar',
    2: 'Teilweise bewölkt',
    3: 'Bewölkt',
    45: 'Nebel',
    48: 'Nebel',
    51: 'Nieselregen',
    53: 'Nieselregen',
    55: 'Starker Nieselregen',
    61: 'Regen',
    63: 'Regen',
    65: 'Starkregen',
    71: 'Schnee',
    80: 'Schauer',
    81: 'Schauer',
    82: 'Starke Schauer',
    95: 'Gewitter',
  };

  function labelForCode(code) {
    return WMO_LABELS[code] ?? 'Wechselhaft';
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at > CACHE_TTL_MS) return {};
      return data || {};
    } catch {
      return {};
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (_) {}
  }

  function cacheKey(lat, lng, date) {
    return `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
  }

  async function fetchForecast(lat, lng, date) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lng);
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('timezone', 'Europe/Berlin');
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    const res = await fetch(url);
    if (!res.ok) throw new Error('forecast failed');
    return res.json();
  }

  async function fetchArchive(lat, lng, date) {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lng);
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('timezone', 'Europe/Berlin');
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    const res = await fetch(url);
    if (!res.ok) throw new Error('archive failed');
    return res.json();
  }

  function parseDaily(json) {
    const d = json?.daily;
    if (!d?.time?.length) return null;
    const i = 0;
    return {
      code: d.weather_code?.[i],
      max: d.temperature_2m_max?.[i],
      min: d.temperature_2m_min?.[i],
      precip: d.precipitation_sum?.[i],
    };
  }

  function formatResult(parsed, source, note) {
    if (!parsed || parsed.max == null) return null;
    const label = labelForCode(parsed.code);
    const precip =
      parsed.precip != null && parsed.precip > 0
        ? ` · ${Math.round(parsed.precip)} mm Regen`
        : '';
    return {
      summary: `${label} · ${Math.round(parsed.max)}° / ${Math.round(parsed.min)}°${precip}`,
      source,
      note,
    };
  }

  async function getForDay(day) {
    if (!day || !window.TripOps) return null;
    const ops = TripOps.getDayOps(day);
    const lat = ops.coords?.lat;
    const lng = ops.coords?.lng;
    if (lat == null || lng == null) return null;

    const key = cacheKey(lat, lng, day.date);
    const cache = readCache();
    if (cache[key]) return cache[key];

    const daysOut = U.daysUntil(day.date);
    let parsed = null;
    let source = '';
    let note = '';

    try {
      if (daysOut !== null && daysOut >= 0 && daysOut <= 16) {
        const json = await fetchForecast(lat, lng, day.date);
        parsed = parseDaily(json);
        source = 'Prognose';
        note = 'Open-Meteo · aktualisiert stündlich';
      } else {
        const year = parseInt(day.date.slice(0, 4), 10) - 1;
        const histDate = `${year}${day.date.slice(4)}`;
        const json = await fetchArchive(lat, lng, histDate);
        parsed = parseDaily(json);
        source = `Klima ${year}`;
        note =
          daysOut > 16
            ? 'Durchschnitt vom Vorjahr — Orientierung bis kurz vor Abfahrt'
            : 'Historische Werte';
      }
    } catch {
      return {
        summary: 'Wetter nicht verfügbar',
        source: '',
        note: 'Bitte später erneut versuchen',
      };
    }

    const result = formatResult(parsed, source, note);
    if (result) {
      cache[key] = result;
      writeCache(cache);
    }
    return result;
  }

  function weatherHtml(result) {
    if (!result) return '';
    const hint = result.note
      ? `<button type="button" class="cockpit-weather__hint" title="${U.escapeHtml(result.note)}" aria-label="Hinweis zur Datenquelle">ⓘ</button>`
      : '';
    return `<div class="cockpit-block cockpit-weather">
      <h3 class="cockpit-block__title">Wetter am Ziel ${hint}</h3>
      <p class="cockpit-weather__summary">${U.escapeHtml(result.summary)}</p>
      ${result.source ? `<p class="cockpit-weather__meta">${U.escapeHtml(result.source)}</p>` : ''}
    </div>`;
  }

  async function renderInto(containerId, day) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p class="cockpit-weather__loading">Wetter wird geladen…</p>';
    const w = await getForDay(day);
    if (!document.getElementById(containerId)) return;
    el.innerHTML = w
      ? weatherHtml(w)
      : '<p class="cockpit-weather__meta">Keine Koordinaten für diesen Tag.</p>';
  }

  return {
    getForDay,
    renderInto,
    weatherHtml,
  };
})();

if (typeof window !== 'undefined') {
  window.TripWeather = TripWeather;
}
