/**
 * localStorage state (schema v2)
 */
const TripState = (function () {
  'use strict';

  const STORAGE_KEY = 'italy-roadtrip-2026-state';

  function defaultState() {
    return {
      schemaVersion: 2,
      bookings: {},
      cleanup: {},
      driver: {},
      restaurantBudget: '',
      licensePlate: '',
      budgetScenario: 'default',
      expandedDays: {},
      collapsedConfirmed: true,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, schemaVersion: 2 };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const el = document.getElementById('last-saved');
    if (el) {
      el.textContent = `Zuletzt gespeichert: ${new Date().toLocaleString('de-LU')}`;
    }
  }

  function getState() {
    return state;
  }

  function setState(partial) {
    state = { ...state, ...partial };
    saveState();
  }

  function getBookingState(id) {
    return state.bookings[id] || { status: 'offen', confirmation: '', notes: '', actualPrice: '' };
  }

  function setBookingState(id, patch) {
    state.bookings[id] = { ...getBookingState(id), ...patch };
    saveState();
  }

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(json) {
    const imported = typeof json === 'string' ? JSON.parse(json) : json;
    if (imported.bookings) state.bookings = { ...state.bookings, ...imported.bookings };
    if (imported.cleanup) state.cleanup = { ...state.cleanup, ...imported.cleanup };
    if (imported.driver) state.driver = { ...state.driver, ...imported.driver };
    if (imported.restaurantBudget != null) state.restaurantBudget = imported.restaurantBudget;
    if (imported.licensePlate != null) state.licensePlate = imported.licensePlate;
    saveState();
  }

  return {
    getState,
    setState,
    getBookingState,
    setBookingState,
    saveState,
    exportState,
    importState,
    reload: () => {
      state = loadState();
    },
  };
})();

if (typeof window !== 'undefined') {
  window.TripState = TripState;
}
