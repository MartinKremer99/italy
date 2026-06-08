/**
 * Italien-Roadtrip 2026 — App init
 */
const TripApp = (function () {
  'use strict';

  /** Read at call time — app.js must load after render/state modules */
  const trip = () => ({
    data: globalThis.TRIP_DATA,
    render: globalThis.TripRender,
    state: globalThis.TripState,
    bookables: globalThis.TripBookables,
    ops: globalThis.TripOps,
  });

  const ctx = {
    mode: 'planen',
    planTab: 'jetzt',
    reiseFilter: 'all',
    bookingsFilter: 'open',
    search: '',
    typeFilter: 'all',
    viewMode: 'full',
  };

  let searchTimer = null;

  function syncBodyClasses() {
    document.body.classList.toggle('mode-reise', ctx.mode === 'reise');
    document.body.classList.toggle('mode-planen', ctx.mode === 'planen');
    document.body.classList.toggle('planen-jetzt', ctx.mode === 'planen' && ctx.planTab === 'jetzt');
    document.body.classList.toggle('planen-details', ctx.mode === 'planen' && ctx.planTab === 'details');
  }

  function renderModeHeader() {
    const eyebrow = document.getElementById('header-eyebrow');
    const progress = document.getElementById('flow-progress');
    const meta = document.getElementById('header-meta');
    const planenNav = document.getElementById('planen-subnav');
    const dayNav = document.getElementById('reise-day-nav');
    const fab = document.getElementById('mobile-next-fab');

    syncBodyClasses();

    if (ctx.mode === 'reise') {
      if (eyebrow) eyebrow.textContent = 'Deine Route';
      if (progress) progress.hidden = true;
      if (meta) meta.hidden = false;
      if (planenNav) planenNav.hidden = true;
      if (dayNav) dayNav.hidden = false;
      if (fab) fab.hidden = true;
      trip().render?.renderReiseStatus();
      syncHeuteFilter();
    } else {
      if (meta)
        meta.textContent = '27.07. – 08.08.2026 · Luxemburg · 2 Erwachsene';
      if (eyebrow) eyebrow.textContent = 'Dein Buchungsplan';
      if (progress) progress.hidden = ctx.planTab !== 'details';
      if (meta) meta.hidden = false;
      if (planenNav) planenNav.hidden = false;
      if (dayNav) dayNav.hidden = true;
      updateMobileFab();
      trip().render?.renderFlowIntro(ctx.planTab);
    }
  }

  function syncHeuteFilter() {
    const btn = document.getElementById('btn-reise-heute');
    const ops = trip().ops;
    if (!btn || !ops) return;
    const can = ops.canUseHeuteFilter?.();
    btn.disabled = !can;
    const start = trip().data?.meta?.start;
    const startLabel = start && globalThis.TripUtils ? globalThis.TripUtils.formatDateDE(start) : 'Reisebeginn';
    btn.title = can ? 'Nur heutigen und morgigen Tag' : `Aktiv ab ${startLabel}`;
    if (!can && ctx.reiseFilter === 'heute') {
      setReiseFilter('all');
    }
  }

  function updateReiseDayNav(dayId) {
    const { data, ops } = trip();
    const nav = document.getElementById('reise-day-nav');
    const label = document.getElementById('reise-day-nav-label');
    const meta = document.getElementById('reise-day-nav-meta');
    const prev = document.getElementById('btn-day-prev');
    const next = document.getElementById('btn-day-next');
    if (!nav || !data?.days?.length) return;

    const id =
      dayId ||
      window.TripMap?.getSelectedDayId?.() ||
      ops?.getCurrentDayId?.() ||
      data.days[0].id;
    const idx = data.days.findIndex((d) => d.id === id);
    const day = data.days[idx];
    if (!day) return;

    if (label) label.textContent = day.label;
    if (meta && globalThis.TripUtils) {
      meta.textContent = `${day.weekday} · ${globalThis.TripUtils.formatDateDE(day.date)} · ${day.sleep}`;
    } else if (meta) {
      meta.textContent = `${day.weekday} · ${day.sleep}`;
    }
    if (prev) {
      prev.disabled = idx <= 0;
      prev.dataset.dayId = idx > 0 ? data.days[idx - 1].id : '';
    }
    if (next) {
      next.disabled = idx >= data.days.length - 1;
      next.dataset.dayId = idx < data.days.length - 1 ? data.days[idx + 1].id : '';
    }
  }

  function updateMobileFab() {
    const fab = document.getElementById('mobile-next-fab');
    const flow = globalThis.TripFlow;
    if (!fab) return;
    if (ctx.mode !== 'planen' || ctx.planTab !== 'jetzt' || !flow) {
      fab.hidden = true;
      return;
    }
    const hero = flow.getHero();
    fab.hidden = !hero;
    if (hero?.bookableId) {
      fab.href = '#flow-step-action-' + hero.bookableId;
    } else if (hero) {
      fab.href = '#flow-step-' + hero.id;
    }
  }

  function switchPlanTab(tab) {
    ctx.planTab = tab;
    document.querySelectorAll('[data-plan-tab]').forEach((btn) => {
      const active = btn.dataset.planTab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('#mode-planen .panel').forEach((p) => {
      const match = p.id === `panel-${tab}`;
      p.classList.toggle('is-active', match);
      p.hidden = !match;
    });
    if (tab === 'details') {
      ctx.viewMode = 'full';
      document.getElementById('view-toggle-full')?.classList.add('is-active');
      document.getElementById('view-toggle-compact')?.classList.remove('is-active');
      const sel = document.getElementById('bookings-filter-select');
      if (sel) sel.value = ctx.bookingsFilter;
      trip().render?.renderAll({ ...ctx, mode: 'planen', planTab: tab });
    }
    renderModeHeader();
    try {
      sessionStorage.setItem('italy-trip-plan-tab', tab);
    } catch (_) {}
  }

  function switchMode(mode) {
    ctx.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const planenEl = document.getElementById('mode-planen');
    const reiseEl = document.getElementById('mode-reise');
    if (planenEl) {
      planenEl.classList.toggle('is-active', mode === 'planen');
      planenEl.hidden = mode !== 'planen';
    }
    if (reiseEl) {
      reiseEl.classList.toggle('is-active', mode === 'reise');
      reiseEl.hidden = mode !== 'reise';
    }

    renderModeHeader();

    if (mode === 'reise') {
      const { render, ops, data } = trip();
      render?.renderReiseStatus();
      render?.renderTripDays(ctx.reiseFilter);
      window.TripMap?.init().then(() => {
        window.TripMap?.invalidate();
        const dayId =
          ops?.getCurrentDayId?.() ||
          window.TripMap?.getSelectedDayId?.() ||
          data?.days[0]?.id;
        if (dayId) {
          window.TripMap?.selectDay(dayId);
          updateReiseDayNav(dayId);
        }
      });
    } else {
      updateMobileFab();
    }

    try {
      sessionStorage.setItem('italy-trip-mode', mode);
    } catch (_) {}
  }

  /** @deprecated use switchPlanTab */
  function switchTab(tab) {
    if (tab === 'trip' || tab === 'ontheroad' || tab === 'reise') {
      switchMode('reise');
      return;
    }
    switchMode('planen');
    const planTab = tab === 'details' || tab === 'bookings' ? 'details' : 'jetzt';
    switchPlanTab(planTab);
  }

  function setBookingsFilter(filter) {
    ctx.bookingsFilter = filter;
    const sel = document.getElementById('bookings-filter-select');
    if (sel) sel.value = filter;
    trip().render?.renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
  }

  function setBookingsView(mode) {
    ctx.viewMode = mode;
    trip().render?.renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
  }

  function goToStep(id) {
    switchMode('planen');
    switchPlanTab('details');
    ctx.bookingsFilter = 'all';
    ctx.viewMode = 'full';
    setTimeout(() => {
      const sel = document.getElementById('bookings-filter-select');
      if (sel) sel.value = 'all';
      trip().render?.renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
      const el = document.getElementById(`bookable-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('highlight-flash');
      setTimeout(() => el?.classList.remove('highlight-flash'), 2000);
    }, 80);
  }

  function goToBookable(id) {
    goToStep(id);
  }

  function goToDay(dayId) {
    switchMode('reise');
    const { state, render } = trip();
    const st = state.getState();
    st.expandedDays[dayId] = true;
    state.setState({ expandedDays: st.expandedDays });
    render?.renderTripDays();
    setTimeout(() => {
      window.TripMap?.init().then(() => {
        window.TripMap?.selectDay(dayId);
        window.TripMap?.invalidate();
      });
    }, 120);
  }

  function refresh() {
    const { bookables, render } = trip();
    bookables?.invalidate();
    render?.renderAll(ctx);
    if (ctx.mode === 'reise') window.TripMap?.invalidate();
  }

  function setReiseFilter(filter) {
    ctx.reiseFilter = filter;
    document.querySelectorAll('[data-reise-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.reiseFilter === filter);
    });
    trip().render?.renderTripDays(filter);
    try {
      sessionStorage.setItem('italy-trip-reise-filter', filter);
    } catch (_) {}
  }

  function initReiseToolbar() {
    document.getElementById('reise-day-filter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-reise-filter]');
      if (!btn || btn.disabled) return;
      setReiseFilter(btn.dataset.reiseFilter);
    });

    document.getElementById('btn-day-prev')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.dayId;
      if (id) window.TripMap?.selectDay(id);
    });
    document.getElementById('btn-day-next')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.dayId;
      if (id) window.TripMap?.selectDay(id);
    });

    document.getElementById('btn-share-trip')?.addEventListener('click', async () => {
      const { ops, render } = trip();
      const url = ops?.shareUrl?.() || window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        render?.showToast('Link kopiert');
      } catch {
        render?.showToast(url);
      }
    });

    document.getElementById('btn-print-trip')?.addEventListener('click', () => {
      document.body.classList.add('print-reise');
      window.print();
      setTimeout(() => document.body.classList.remove('print-reise'), 500);
    });
  }

  function initModeNav() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    document.querySelectorAll('[data-plan-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchPlanTab(btn.dataset.planTab));
    });

    try {
      const savedMode = sessionStorage.getItem('italy-trip-mode');
      const savedTab = sessionStorage.getItem('italy-trip-tab');
      const savedPlanTab = sessionStorage.getItem('italy-trip-plan-tab');

      let mode = savedMode || 'planen';
      if (!savedMode && savedTab) {
        if (savedTab === 'trip' || savedTab === 'ontheroad' || savedTab === 'reise') mode = 'reise';
      }

      let planTab = savedPlanTab || 'jetzt';
      if (!savedPlanTab && savedTab) {
        if (savedTab === 'details' || savedTab === 'bookings') planTab = 'details';
        else if (savedTab === 'jetzt' || savedTab === 'start') planTab = 'jetzt';
      }

      try {
        const rf = sessionStorage.getItem('italy-trip-reise-filter');
        if (rf) ctx.reiseFilter = rf;
      } catch (_) {}

      switchMode(mode);
      if (mode === 'planen') switchPlanTab(planTab);
    } catch (_) {
      switchMode('planen');
      switchPlanTab('jetzt');
    }
  }

  function initFilters() {
    document.getElementById('bookings-filter-select')?.addEventListener('change', (e) => {
      setBookingsFilter(e.target.value);
    });

    document.getElementById('bookings-type-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      ctx.typeFilter = btn.dataset.type;
      document.querySelectorAll('#bookings-type-filters .filter-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      trip().render?.renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
    });

    document.getElementById('bookings-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        ctx.search = e.target.value.trim();
        trip().render?.renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
      }, 200);
    });

    document.getElementById('view-toggle-compact')?.addEventListener('click', () => {
      document.getElementById('view-toggle-compact')?.classList.add('is-active');
      document.getElementById('view-toggle-full')?.classList.remove('is-active');
      setBookingsView('compact');
    });
    document.getElementById('view-toggle-full')?.addEventListener('click', () => {
      document.getElementById('view-toggle-full')?.classList.add('is-active');
      document.getElementById('view-toggle-compact')?.classList.remove('is-active');
      setBookingsView('full');
    });
  }

  function initExportImport() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-export')) return;
      const { state, render } = trip();
      const blob = new Blob([state.exportState()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `italy-roadtrip-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      render?.showToast('Backup exportiert');
    });

    document.getElementById('btn-import')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const { state, render } = trip();
        try {
          state.importState(reader.result);
          refresh();
          render?.showToast('Backup importiert');
        } catch {
          render?.showToast('Ungültige JSON-Datei');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-ics')?.addEventListener('click', () => {
      const { bookables, render } = trip();
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Italy Roadtrip 2026//DE'];
      bookables
        .all()
        .filter((i) => i.bookBy && bookables.isOpen(i))
        .forEach((item) => {
          const d = item.bookBy.replace(/-/g, '');
          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${item.id}@italy-roadtrip.local`);
          lines.push(`DTSTART;VALUE=DATE:${d}`);
          lines.push(`SUMMARY:Buchen: ${item.title}`);
          lines.push(`DESCRIPTION:${item.city} - ${item.bookWindow || ''}`);
          lines.push('END:VEVENT');
        });
      lines.push('END:VCALENDAR');
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'italy-roadtrip-fristen.ics';
      a.click();
      URL.revokeObjectURL(url);
      render?.showToast('Kalender exportiert');
    });
  }

  function initHash() {
    const hash = location.hash.slice(1);
    if (!hash) return;
    if (hash.startsWith('day-')) goToDay(hash);
    else goToStep(hash.replace('bookable-', '').replace('action-', ''));
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function initOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const sync = () => {
      banner.hidden = navigator.onLine;
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initModeNav();
    initReiseToolbar();
    initFilters();
    initExportImport();
    initOfflineBanner();
    refresh();
    trip().state?.saveState();
    initHash();
    registerServiceWorker();

    if (!document.getElementById('highlight-style')) {
      const style = document.createElement('style');
      style.id = 'highlight-style';
      style.textContent = '.highlight-flash { outline: 2px solid var(--terracotta); outline-offset: 4px; }';
      document.head.appendChild(style);
    }
  });

  return {
    switchMode,
    switchPlanTab,
    switchTab,
    setBookingsFilter,
    setBookingsView,
    goToStep,
    goToBookable,
    goToDay,
    refresh,
    updateReiseDayNav,
    updateMobileFab,
    getCtx: () => ctx,
  };
})();

if (typeof window !== 'undefined') {
  window.TripApp = TripApp;
}
