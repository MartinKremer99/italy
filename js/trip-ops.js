/**
 * Trip operations: maps links, pins, day cockpit data, trip phase
 */
import { lazyGlobal } from './deps.js';

const TripOps = (function () {
  'use strict';

  const TRIP_DATA = lazyGlobal('TRIP_DATA');
  const U = lazyGlobal('TripUtils');
  const B = lazyGlobal('TripBookables');
  const TripState = lazyGlobal('TripState');

  function coordsForCity(city) {
    return TRIP_DATA.placeCoords?.[city] || null;
  }

  function mapsDestinationUrl(lat, lng, query) {
    if (lat != null && lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
    if (query) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`;
    }
    return null;
  }

  function mapsAppleUrl(lat, lng, query) {
    if (lat != null && lng != null) {
      return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    }
    if (query) {
      return `https://maps.apple.com/?daddr=${encodeURIComponent(query)}&dirflg=d`;
    }
    return null;
  }

  function mapsLegUrl(day) {
    const idx = TRIP_DATA.days.findIndex((d) => d.id === day.id);
    const prev = idx > 0 ? TRIP_DATA.days[idx - 1] : null;
    let from = null;
    if (prev?.hotelId) {
      const h = TRIP_DATA.hotels.find((x) => x.id === prev.hotelId);
      const c = coordsForCity(h?.city);
      from = { lat: c?.lat, lng: c?.lng, query: h?.mapsQuery || `${h.pick}, ${h.city}` };
    } else if (idx === 0) {
      from = { query: 'Luxemburg', lat: 49.6116, lng: 6.1319 };
    }

    let to = null;
    if (day.hotelId) {
      const h = TRIP_DATA.hotels.find((x) => x.id === day.hotelId);
      const c = coordsForCity(h?.city);
      to = {
        lat: c?.lat,
        lng: c?.lng,
        query: h?.mapsQuery || `${h.pick}, ${h.city}, ${h.country || 'Italien'}`,
      };
    } else if (day.km > 0) {
      const stop = TRIP_DATA.routeStops.find((s) => s.dayId === day.id);
      if (stop) to = { lat: stop.lat, lng: stop.lng, query: stop.label };
    }

    if (!to) return null;
    const dest = to.query || `${to.lat},${to.lng}`;
    let origin = '';
    if (from) {
      origin = from.query
        ? `&origin=${encodeURIComponent(from.query)}`
        : from.lat != null
          ? `&origin=${from.lat},${from.lng}`
          : '';
    }
    return {
      google: `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(dest)}&travelmode=driving`,
      apple: `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=d`,
    };
  }

  function getTripPhase() {
    const start = U.daysUntil(TRIP_DATA.meta.start);
    const end = U.daysUntil(TRIP_DATA.meta.end);
    if (start === null || end === null) return { phase: 'before', label: '' };
    if (start > 0) return { phase: 'before', daysUntilStart: start, label: `Abfahrt in ${start} Tagen` };
    if (end < 0) return { phase: 'after', label: 'Reise beendet' };
    const current = getCurrentDayId();
    const num = current ? dayNumber(current) : null;
    return {
      phase: 'during',
      label: num ? `Tag ${num} von ${TRIP_DATA.days.length}` : 'Unterwegs',
      currentDayId: current,
    };
  }

  function getCurrentDayId() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of TRIP_DATA.days) {
      const d = U.parseDate(day.date);
      if (!d) continue;
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) return day.id;
    }
    return null;
  }

  function dayNumber(dayId) {
    const m = dayId?.match(/day-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function hotelForDay(day) {
    if (!day.hotelId) return null;
    return TRIP_DATA.hotels.find((h) => h.id === day.hotelId) || null;
  }

  function ztlHint(day, hotel) {
    if (!day.ztlLevel && !hotel?.ztlHotel) return null;
    const level = day.ztlLevel;
    if (level === 'high') return 'ZTL Rom: Kennzeichen beim Hotel registrieren lassen.';
    if (level === 'medium') return 'ZTL beachten — Hotel/Parkplatz klären.';
    if (level === 'pedestrian') return 'Matera: Altstadt oft nur zu Fuß — Parkplatz am Hotel.';
    if (hotel?.ztlHotel) return 'ZTL: E-Mail ans Hotel senden (Unterwegs-Bereich).';
    return null;
  }

  function tollHint(day) {
    const idx = dayNumber(day.id);
    if (idx === 1) return 'Maut: Brenner, ggf. österreichische Vignette.';
    if (idx === 13) return 'Maut: Schweiz Vignette, Simplon — früh losfahren.';
    if (day.km >= 400) return 'Langer Tag — Tanken & Pause einplanen.';
    return null;
  }

  function getDayOps(day) {
    const hotel = hotelForDay(day);
    const hotelBookable = hotel ? B.getById(hotel.id) : null;
    const bs = hotelBookable ? TripState.getBookingState(hotelBookable.id) : null;
    const bookables = B.forDay(day.id);
    const maps = day.km > 0 ? mapsLegUrl(day) : null;
    const stop = TRIP_DATA.routeStops.find((s) => s.dayId === day.id);
    const coords = stop
      ? { lat: stop.lat, lng: stop.lng }
      : hotel
        ? coordsForCity(hotel.city)
        : null;

    return {
      day,
      hotel,
      hotelBookable,
      confirmation: bs?.confirmation || '',
      status: bs?.status || (hotel?.locked ? 'bestaetigt' : 'offen'),
      bookables,
      maps,
      coords,
      ztl: ztlHint(day, hotelBookable),
      toll: tollHint(day),
      overnightMaps: hotel
        ? {
            google: mapsDestinationUrl(
              coords?.lat,
              coords?.lng,
              hotel.mapsQuery || `${hotel.pick}, ${hotel.city}`
            ),
            apple: mapsAppleUrl(coords?.lat, coords?.lng, hotel.mapsQuery || `${hotel.pick}, ${hotel.city}`),
          }
        : null,
    };
  }

  function buildPlacePins() {
    const pins = [];

    TRIP_DATA.hotels.forEach((h) => {
      if (h.locked && !h.mapsQuery) return;
      const c = coordsForCity(h.city);
      if (!c) return;
      const bookable = B.getById(h.id);
      pins.push({
        id: h.id,
        type: 'hotel',
        label: h.pick,
        city: h.city,
        lat: c.lat,
        lng: c.lng,
        dayIds: bookable?.dayIds || TRIP_DATA.days.filter((d) => d.hotelId === h.id).map((d) => d.id),
        ztl: !!h.ztlHotel,
      });
    });

    TRIP_DATA.restaurants.forEach((r) => {
      if (r.optional) return;
      const c = coordsForCity(r.city);
      if (!c) return;
      const offset = r.id === 'rest-franceschetta' ? { lat: 0.02, lng: 0.01 } : { lat: 0, lng: 0 };
      let dayIds = [];
      if (r.date) {
        const d = TRIP_DATA.days.find((day) => day.date === r.date);
        if (d) dayIds = [d.id];
      }
      const bookable = B.getById(r.id);
      if (bookable?.dayIds?.length) dayIds = bookable.dayIds;
      pins.push({
        id: r.id,
        type: 'restaurant',
        label: r.name,
        city: r.city,
        lat: c.lat + offset.lat,
        lng: c.lng + offset.lng,
        dayIds,
        ztl: false,
      });
    });

    TRIP_DATA.sights.forEach((s) => {
      const c = coordsForCity(s.city);
      if (!c) return;
      const bookable = B.getById(s.id);
      let dayIds = bookable?.dayIds || [];
      if (s.date && !dayIds.length) {
        const d = TRIP_DATA.days.find((day) => day.date === s.date);
        if (d) dayIds = [d.id];
      }
      pins.push({
        id: s.id,
        type: 'sight',
        label: s.name,
        city: s.city,
        lat: c.lat - 0.008,
        lng: c.lng + 0.008,
        dayIds,
        ztl: false,
      });
    });

    return pins;
  }

  function filterDays(days, filter) {
    if (filter !== 'heute') return days;
    const current = getCurrentDayId();
    if (!current) return [];
    const idx = TRIP_DATA.days.findIndex((d) => d.id === current);
    if (idx < 0) return [];
    return TRIP_DATA.days.slice(Math.max(0, idx), Math.min(TRIP_DATA.days.length, idx + 2));
  }

  function dayNeedsZtl(day) {
    if (!day?.hotelId) return false;
    return TRIP_DATA.ztlEmailTemplates.some((t) => t.hotelId === day.hotelId);
  }

  function canUseHeuteFilter() {
    return getTripPhase().phase === 'during';
  }

  function shareUrl() {
    try {
      return window.location.href.split('#')[0];
    } catch {
      return '';
    }
  }

  return {
    coordsForCity,
    mapsDestinationUrl,
    mapsAppleUrl,
    mapsLegUrl,
    getTripPhase,
    getCurrentDayId,
    dayNumber,
    getDayOps,
    buildPlacePins,
    filterDays,
    dayNeedsZtl,
    canUseHeuteFilter,
    shareUrl,
  };
})();

if (typeof window !== 'undefined') {
  window.TripOps = TripOps;
}
