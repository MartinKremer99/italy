/**
 * Shared utilities
 */
const TripUtils = (function () {
  'use strict';

  const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const DONE_STATUSES = new Set(['gebucht', 'bestaetigt']);

  function parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateDE(iso) {
    const dt = parseDate(iso);
    if (!dt) return '—';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${dt.getFullYear()}`;
  }

  function formatDateRange(dates) {
    if (!dates || !dates.length) return '—';
    if (dates.length === 1) return formatDateDE(dates[0]);
    return `${formatDateDE(dates[0])} – ${formatDateDE(dates[dates.length - 1])}`;
  }

  function daysUntil(iso) {
    const target = parseDate(iso);
    if (!target) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }

  function deadlineBadge(bookBy) {
    if (!bookBy) return { class: 'deadline-badge--none', text: '—' };
    const days = daysUntil(bookBy);
    if (days < 0) return { class: 'deadline-badge--overdue', text: `${Math.abs(days)} T. überfällig` };
    if (days === 0) return { class: 'deadline-badge--soon', text: 'Heute' };
    if (days <= 14) return { class: 'deadline-badge--soon', text: `in ${days} T.` };
    return { class: 'deadline-badge--ok', text: `in ${days} T.` };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function priorityWeight(p) {
    const map = { now: 0, critical: 0, high: 1, june: 2, medium: 3, july: 4, low: 5, done: 99, aspirational: 100 };
    return map[p] ?? 50;
  }

  function isDoneStatus(status) {
    return DONE_STATUSES.has(status);
  }

  function typeLabel(type) {
    const map = { hotel: 'Hotel', restaurant: 'Restaurant', sight: 'Ticket' };
    return map[type] || type;
  }

  function typeIcon(type) {
    const map = { hotel: 'H', restaurant: 'R', sight: 'S' };
    return map[type] || '·';
  }

  return {
    MONTHS_DE,
    DONE_STATUSES,
    parseDate,
    formatDateDE,
    formatDateRange,
    daysUntil,
    deadlineBadge,
    escapeHtml,
    priorityWeight,
    isDoneStatus,
    typeLabel,
    typeIcon,
  };
})();

if (typeof window !== 'undefined') {
  window.TripUtils = TripUtils;
}
