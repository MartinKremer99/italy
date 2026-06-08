/**
 * Deadline milestone strip (May–Aug 2026)
 */
import { lazyGlobal } from './deps.js';

const TripCalendar = (function () {
  'use strict';

  const U = lazyGlobal('TripUtils');
  const B = lazyGlobal('TripBookables');

  const RANGE_START = new Date(2026, 4, 1);
  const RANGE_END = new Date(2026, 7, 31);
  const HIGHLIGHT_DATES = new Set(['2026-06-06']);

  function daysInRange() {
    const days = [];
    const cur = new Date(RANGE_START);
    while (cur <= RANGE_END) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  function milestones() {
    return B.all()
      .filter((item) => item.bookBy && B.isOpen(item))
      .map((item) => ({
        date: item.bookBy,
        id: item.id,
        title: item.title,
        type: item.type,
        highlight: HIGHLIGHT_DATES.has(item.bookBy) || item.id === 'rest-franceschetta',
      }));
  }

  function render(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const ms = milestones();
    const byDate = {};
    ms.forEach((m) => {
      if (!byDate[m.date]) byDate[m.date] = [];
      byDate[m.date].push(m);
    });

    const months = [
      { key: '2026-05', label: 'Mai', start: 1, end: 31 },
      { key: '2026-06', label: 'Jun', start: 1, end: 30 },
      { key: '2026-07', label: 'Jul', start: 1, end: 31 },
      { key: '2026-08', label: 'Aug', start: 1, end: 15 },
    ];

    let html = '<div class="cal-strip"><div class="cal-strip__months">';

    months.forEach((mo) => {
      html += `<div class="cal-month"><span class="cal-month__label">${mo.label}</span><div class="cal-month__dots">`;
      for (let d = mo.start; d <= mo.end; d++) {
        const iso = `${mo.key.slice(0, 4)}-${mo.key.slice(5, 7)}-${String(d).padStart(2, '0')}`;
        const items = byDate[iso];
        const has = items && items.length;
        const highlight = HIGHLIGHT_DATES.has(iso);
        const overdue = has && U.daysUntil(iso) < 0;
        const cls = [
          'cal-dot',
          has ? 'cal-dot--has' : '',
          highlight ? 'cal-dot--highlight' : '',
          overdue ? 'cal-dot--overdue' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const title = has
          ? items.map((i) => i.title).join(', ')
          : highlight
            ? 'Franceschetta 58 — Buchungsfenster'
            : '';
        html += `<button type="button" class="${cls}" data-date="${iso}" title="${U.escapeHtml(title)}" ${has ? `data-scroll-id="${items[0].id}"` : ''} aria-label="${d}. ${mo.label}${has ? ': ' + title : ''}"></button>`;
      }
      html += '</div></div>';
    });

    html += '</div><ul class="cal-legend">';
    const upcoming = B.sortByDeadline(ms.map((m) => B.getById(m.id)).filter(Boolean)).slice(0, 5);
    upcoming.forEach((item) => {
      const dl = U.deadlineBadge(item.bookBy);
      html += `<li><button type="button" class="cal-legend__item" data-scroll-id="${item.id}">
        <span class="cal-legend__date">${U.formatDateDE(item.bookBy)}</span>
        <span class="cal-legend__title">${U.escapeHtml(item.title)}</span>
        <span class="deadline-badge ${dl.class}">${dl.text}</span>
      </button></li>`;
    });
    html += '</ul></div>';

    el.innerHTML = html;

    el.querySelectorAll('[data-scroll-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        TripApp.goToBookable(btn.dataset.scrollId);
      });
    });
  }

  return { render, milestones };
})();

if (typeof window !== 'undefined') {
  window.TripCalendar = TripCalendar;
}
