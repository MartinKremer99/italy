/**
 * Normalize TRIP_DATA into unified bookables[]
 */
import { lazyGlobal } from './deps.js';

const TripBookables = (function () {
  'use strict';

  const TRIP_DATA = lazyGlobal('TRIP_DATA');
  const U = lazyGlobal('TripUtils');
  const TripState = lazyGlobal('TripState');

  function dayIdForDate(iso) {
    if (!iso) return [];
    const day = TRIP_DATA.days.find((d) => d.date === iso);
    return day ? [day.id] : [];
  }

  function dayIdsForHotel(hotel) {
    return TRIP_DATA.days.filter((d) => d.hotelId === hotel.id).map((d) => d.id);
  }

  function buildBookables() {
    const list = [];

    TRIP_DATA.hotels.forEach((h) => {
      list.push({
        id: h.id,
        type: 'hotel',
        title: h.pick,
        city: h.city,
        country: h.country,
        dates: h.dates,
        date: h.checkIn,
        bookBy: h.bookBy,
        bookByLabel: h.bookByLabel,
        priority: h.priority,
        pricePerNight: h.pricePerNight,
        total: h.total,
        priceEstimate: null,
        reviewScore: h.reviewScore,
        alternates: h.alternates,
        links: h.links || {},
        flags: h.flags || [],
        notes: h.notes,
        locked: !!h.locked,
        optional: false,
        liveSearchRequired: !!h.liveSearchRequired,
        ztlHotel: !!h.ztlHotel,
        upgrades: h.upgrades || [],
        nights: h.nights,
        meal: null,
        bookWindow: null,
        dayIds: h.dayIds || dayIdsForHotel(h),
        actionVerb: h.actionVerb,
        actionWhy: h.actionWhy,
      });
    });

    TRIP_DATA.restaurants.forEach((r) => {
      list.push({
        id: r.id,
        type: 'restaurant',
        title: r.name,
        city: r.city,
        country: 'Italien',
        dates: r.date ? [r.date] : [],
        date: r.date,
        bookBy: r.bookBy,
        bookByLabel: r.bookWindow,
        priority: r.priority,
        pricePerNight: null,
        total: null,
        priceEstimate: r.priceEstimate,
        reviewScore: null,
        alternates: [],
        links: r.links || {},
        flags: [],
        notes: r.notes,
        locked: false,
        optional: !!r.optional,
        liveSearchRequired: false,
        ztlHotel: false,
        upgrades: [],
        nights: null,
        meal: r.meal,
        bookWindow: r.bookWindow,
        dayIds: r.dayIds || dayIdForDate(r.date),
        actionVerb: r.actionVerb,
        actionWhy: r.actionWhy,
      });
    });

    TRIP_DATA.sights.forEach((s) => {
      list.push({
        id: s.id,
        type: 'sight',
        title: s.name,
        city: s.city,
        country: 'Italien',
        dates: s.date ? [s.date] : [],
        date: s.date,
        bookBy: s.bookBy,
        bookByLabel: s.bookWindow,
        priority: s.priority,
        pricePerNight: null,
        total: null,
        priceEstimate: null,
        reviewScore: null,
        alternates: [],
        links: s.link ? { website: s.link } : {},
        flags: [],
        notes: s.notes,
        locked: false,
        optional: false,
        liveSearchRequired: false,
        ztlHotel: false,
        upgrades: [],
        nights: null,
        meal: null,
        bookWindow: s.bookWindow,
        dayIds: s.dayIds || dayIdForDate(s.date),
        actionVerb: s.actionVerb,
        actionWhy: s.actionWhy,
      });
    });

    return list;
  }

  let cache = null;

  function all() {
    if (!cache) cache = buildBookables();
    return cache;
  }

  function invalidate() {
    cache = null;
  }

  function getById(id) {
    return all().find((b) => b.id === id);
  }

  function forDay(dayId) {
    return all().filter((b) => b.dayIds.includes(dayId) && !b.optional);
  }

  function forDayAll(dayId) {
    return all().filter((b) => b.dayIds.includes(dayId));
  }

  function isDone(item) {
    if (item.locked) return true;
    const s = TripState.getBookingState(item.id).status;
    return U.isDoneStatus(s);
  }

  function isOpen(item) {
    if (item.optional) return false;
    return !isDone(item);
  }

  function needsConfirmation(item) {
    const bs = TripState.getBookingState(item.id);
    return U.isDoneStatus(bs.status) && !bs.confirmation?.trim() && !item.locked;
  }

  function isOverdue(item) {
    if (!item.bookBy || isDone(item)) return false;
    const d = U.daysUntil(item.bookBy);
    return d !== null && d < 0;
  }

  function isUrgent(item) {
    if (isDone(item) || item.optional) return false;
    return item.priority === 'now' || item.priority === 'critical' || item.liveSearchRequired;
  }

  function sortByDeadline(items) {
    return [...items].sort((a, b) => {
      const pa = U.priorityWeight(a.priority);
      const pb = U.priorityWeight(b.priority);
      if (pa !== pb) return pa - pb;
      const da = a.bookBy || '9999-12-31';
      const db = b.bookBy || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return a.title.localeCompare(b.title, 'de');
    });
  }

  function dayStatus(dayId) {
    const items = forDay(dayId);
    if (!items.length) return 'none';
    const done = items.filter(isDone).length;
    if (done === 0) return 'open';
    if (done === items.length) return 'complete';
    return 'partial';
  }

  function getActualHotelTotal(item) {
    const bs = TripState.getBookingState(item.id);
    if (bs.actualPrice !== '' && bs.actualPrice != null) {
      const n = Number(bs.actualPrice);
      if (!Number.isNaN(n)) return n;
    }
    if (U.isDoneStatus(bs.status) || item.locked) return item.total || 0;
    return null;
  }

  return {
    all,
    invalidate,
    getById,
    forDay,
    forDayAll,
    isDone,
    isOpen,
    needsConfirmation,
    isOverdue,
    isUrgent,
    sortByDeadline,
    dayStatus,
    getActualHotelTotal,
  };
})();

if (typeof window !== 'undefined') {
  window.TripBookables = TripBookables;
}
