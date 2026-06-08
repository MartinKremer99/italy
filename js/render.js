/**
 * DOM renderers
 */
import { lazyGlobal } from './deps.js';

const TripRender = (function () {
  'use strict';

  const TRIP_DATA = lazyGlobal('TRIP_DATA');
  const U = lazyGlobal('TripUtils');
  const S = lazyGlobal('TripState');
  const B = lazyGlobal('TripBookables');
  const TripFlow = lazyGlobal('TripFlow');
  const TripOps = lazyGlobal('TripOps');
  const TripWeather = lazyGlobal('TripWeather');
  const TripApp = () => globalThis.TripApp;

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add('is-visible');
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { toast.hidden = true; }, 300);
    }, 2800);
  }

  async function copyZtl(hotelId, lang) {
    const tpl = TRIP_DATA.ztlEmailTemplates.find((t) => t.hotelId === hotelId);
    if (!tpl) return;
    const plate = S.getState().licensePlate || '[Kennzeichen]';
    let body = lang === 'it' ? tpl.bodyIt : tpl.bodyDe;
    body = body.replace('[Kennzeichen]', plate).replace('[targa]', plate).replace('[Name]', '');
    const full = `${tpl.subjectDe}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      showToast('ZTL-E-Mail kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  }

  function renderFlowIntro(planTab) {
    const progress = document.getElementById('flow-progress');
    if (!progress) return;
    const p = TripFlow.progressSummary();
    const days = U.daysUntil(TRIP_DATA.meta.start);
    let text = '';
    if (p.total === 0) {
      text = `${days > 0 ? days : 0} Tage bis Abfahrt`;
    } else if (p.done >= p.total) {
      text = `Alle ${p.total} Buchungsschritte erledigt · Abfahrt in ${days > 0 ? days : 0} Tagen`;
    } else {
      const overduePart = p.overdue ? ` · ${p.overdue} überfällig` : '';
      text = `${p.done} von ${p.total} Buchungen erledigt${overduePart}`;
    }
    progress.textContent = text;
    progress.hidden = planTab !== 'details';
  }

  function flowStepHtml(action, index, compact) {
    const item = action.bookableId ? B.getById(action.bookableId) : null;
    const bs = action.bookableId ? S.getBookingState(action.bookableId) : null;
    const status = bs?.status || 'offen';

    const ctas = action.ctas
      .filter((c) => c.primary || (!compact && c.action !== 'detail'))
      .slice(0, compact ? 2 : 4)
      .map((c) => {
        if (c.href) {
          return `<a class="btn ${c.primary ? 'btn--primary' : 'btn--ghost'} btn--small" href="${c.href}" target="_blank" rel="noopener">${U.escapeHtml(c.label)}</a>`;
        }
        return `<button type="button" class="btn btn--ghost btn--small" data-flow-cta="${c.action || ''}" data-bookable-id="${c.bookableId || ''}" data-hotel-id="${c.hotelId || ''}" data-cleanup-id="${c.cleanupId || ''}">${U.escapeHtml(c.label)}</button>`;
      })
      .join('');

    const statusBlock = action.bookableId
      ? `<div class="flow-step__track">
          <label class="flow-step__status-label">Status</label>
          ${statusSelect(action.bookableId, status, item?.locked)}
          <input type="text" class="flow-step__conf confirmation-input" placeholder="Bestätigungsnr." value="${U.escapeHtml(bs?.confirmation || '')}" ${item?.locked ? 'readonly' : ''}>
        </div>`
      : action.cleanupId
        ? `<label class="flow-step__check">
            <input type="checkbox" data-cleanup-toggle="${action.cleanupId}" ${action.done ? 'checked' : ''}>
            Erledigt
          </label>`
        : '';

    return `
    <article class="flow-step ${action.done ? 'flow-step--done' : ''} ${action.overdue ? 'flow-step--overdue' : ''}" id="flow-step-${action.id}" data-action-id="${action.id}">
      <div class="flow-step__num">${index}</div>
      <div class="flow-step__body">
        <p class="flow-step__kind">${U.escapeHtml(action.kindLabel)}</p>
        <h3 class="flow-step__verb">${U.escapeHtml(action.verb)}</h3>
        <p class="flow-step__why"><strong>Warum:</strong> ${U.escapeHtml(action.why)}</p>
        <p class="flow-step__when">${U.escapeHtml(action.whenLabel)}${action.priceHint ? ` · ${U.escapeHtml(action.priceHint)}` : ''}</p>
        <div class="flow-step__ctas">${ctas}</div>
        ${statusBlock}
      </div>
    </article>`;
  }

  function bindFlowStep(el) {
    el.querySelectorAll('[data-flow-cta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.flowCta;
        if (act === 'detail' && btn.dataset.bookableId) TripApp().goToStep(btn.dataset.bookableId);
        if (act === 'ztl-de' && btn.dataset.hotelId) copyZtl(btn.dataset.hotelId, 'de');
      });
    });
    el.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        S.setBookingState(sel.dataset.id, { status: sel.value });
        TripApp().refresh();
      });
    });
    el.querySelectorAll('.confirmation-input').forEach((input) => {
      const card = input.closest('.flow-step');
      const actionId = card?.dataset.actionId;
      const action = TripFlow.buildActions().find((a) => a.id === actionId);
      if (action?.bookableId) {
        input.addEventListener('input', () => S.setBookingState(action.bookableId, { confirmation: input.value }));
      }
    });
    el.querySelectorAll('[data-cleanup-toggle]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const st = S.getState();
        st.cleanup[cb.dataset.cleanupToggle] = cb.checked;
        S.setState({ cleanup: st.cleanup });
        TripApp().refresh();
      });
    });
  }

  function renderFlowPanel() {
    const heroEl = document.getElementById('flow-hero');
    const phasesEl = document.getElementById('flow-phases');
    if (!heroEl || !phasesEl) return;

    const hero = TripFlow.getHero();
    if (hero) {
      const primaryCta = hero.ctas.find((c) => c.primary) || hero.ctas[0];
      heroEl.innerHTML = `
        <article class="flow-hero">
          <p class="flow-hero__label">Dein nächster Schritt</p>
          <h2 class="flow-hero__title">${U.escapeHtml(hero.verb)}</h2>
          <p class="flow-hero__why">${U.escapeHtml(hero.why)}</p>
          <p class="flow-hero__meta">${U.escapeHtml(hero.whenLabel)}${hero.priceHint ? ` · ${U.escapeHtml(hero.priceHint)}` : ''}</p>
          <p class="flow-hero__tip">Starte hier — die Liste unten ist nach Dringlichkeit sortiert. Details &amp; Budget findest du unter <strong>Details</strong>.</p>
          <div class="flow-hero__ctas">
            ${primaryCta?.href ? `<a class="btn btn--primary" href="${primaryCta.href}" target="_blank" rel="noopener">${U.escapeHtml(primaryCta.label)}</a>` : ''}
            <button type="button" class="btn btn--ghost" data-hero-detail="${hero.bookableId || hero.cleanupId}">Schritt bearbeiten</button>
          </div>
        </article>`;
      heroEl.querySelector('[data-hero-detail]')?.addEventListener('click', () => {
        if (hero.bookableId) TripApp().goToStep(hero.bookableId);
        else document.getElementById(`flow-step-${hero.id}`)?.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      heroEl.innerHTML = `
        <article class="flow-hero flow-hero--done">
          <h2 class="flow-hero__title">Alles erledigt</h2>
          <p class="flow-hero__why">Buchungen und Vorbereitung sind durch — schau unter Reise, was euch Tag für Tag erwartet.</p>
          <button type="button" class="btn btn--primary" data-tab-jump="reise">Zur Karte &amp; Reise</button>
        </article>`;
      heroEl.querySelector('[data-tab-jump]')?.addEventListener('click', () => TripApp().switchMode('reise'));
    }

    const byPhase = TripFlow.getByPhase();
    const excludeHero = (actions) =>
      hero ? actions.filter((a) => a.id !== hero.id) : actions;
    const sections = [
      { key: 'now', actions: excludeHero(byPhase.now) },
      { key: 'soon', actions: excludeHero(byPhase.soon) },
      { key: 'before-june', actions: excludeHero(byPhase.beforeJune) },
      { key: 'prep', actions: excludeHero(byPhase.prep) },
      { key: 'done', actions: byPhase.done, collapsed: true },
    ];

    let index = 1;
    let html = '';

    sections.forEach((sec) => {
      if (!sec.actions.length) return;
      const label = TripFlow.PHASE_LABELS[sec.key] || sec.key;
      const steps = sec.actions
        .map((a) => {
          const n = sec.key === 'done' ? '✓' : index++;
          return flowStepHtml(a, n, false);
        })
        .join('');

      html += `
        <section class="flow-phase ${sec.collapsed ? 'flow-phase--collapsed' : ''}">
          <button type="button" class="flow-phase__head" data-phase-toggle="${sec.key}">
            <h2 class="flow-phase__title">${U.escapeHtml(label)}</h2>
            <span class="flow-phase__count">${sec.actions.length}</span>
          </button>
          <div class="flow-phase__steps" ${sec.collapsed ? 'hidden' : ''}>${steps}</div>
        </section>`;
    });

    phasesEl.innerHTML = html || '<p class="empty-state">Keine offenen Schritte.</p>';
    bindFlowStep(phasesEl);

    phasesEl.querySelectorAll('[data-phase-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.flow-phase');
        const steps = section?.querySelector('.flow-phase__steps');
        if (steps) {
          const hidden = steps.hidden;
          steps.hidden = !hidden;
          section?.classList.toggle('flow-phase--collapsed', !hidden);
        }
      });
    });
    TripApp()?.updateMobileFab?.();
  }

  function renderMilestones() {
    const el = document.getElementById('milestones-list');
    if (!el) return;
    const items = TripFlow.upcomingMilestones(5);
    if (!items.length) {
      el.innerHTML = '<li class="empty-state">Keine anstehenden Fristen.</li>';
      return;
    }
    el.innerHTML = items
      .map(
        (m) => `
      <li class="milestone-item ${m.highlight ? 'milestone-item--highlight' : ''}">
        <button type="button" class="milestone-item__btn" data-scroll-id="${m.id}">
          <span class="milestone-item__date">${U.formatDateDE(m.date)}</span>
          <span class="milestone-item__title">${U.escapeHtml(m.title)}</span>
          <span class="milestone-item__why">${U.escapeHtml(m.why)}</span>
        </button>
      </li>`
      )
      .join('');
    el.querySelectorAll('[data-scroll-id]').forEach((btn) => {
      btn.addEventListener('click', () => TripApp().goToStep(btn.dataset.scrollId));
    });
  }

  function getBudgetTotals() {
    const scenario = S.getState().budgetScenario || 'default';
    let hotelPlanned = TRIP_DATA.meta.hotelPicksTotal;
    if (scenario === 'borromees') hotelPlanned = 2206;
    if (scenario === 'sextantio') hotelPlanned = 2016;
    if (scenario === 'both') hotelPlanned = 2296;

    let hotelBooked = 0;
    let hasBooked = false;
    TRIP_DATA.hotels.forEach((h) => {
      if (h.locked) return;
      const item = B.getById(h.id);
      const actual = B.getActualHotelTotal(item);
      if (actual != null) {
        hotelBooked += actual;
        hasBooked = true;
      } else if (B.isDone(item)) {
        hotelBooked += h.total || 0;
        hasBooked = true;
      }
    });
    if (!hasBooked) hotelBooked = hotelPlanned;

    const restBudget = Number(S.getState().restaurantBudget) || 0;
    const tolls = (TRIP_DATA.meta.tollsEstimate.min + TRIP_DATA.meta.tollsEstimate.max) / 2;
    const fuel = (TRIP_DATA.meta.fuelEstimate.min + TRIP_DATA.meta.fuelEstimate.max) / 2;
    const total = hotelBooked + restBudget + tolls + fuel;

    return { hotelPlanned, hotelBooked, restBudget, tolls, fuel, total, scenario };
  }

  function renderBudget() {
    const panel = document.getElementById('budget-panel');
    if (!panel) return;
    const b = getBudgetTotals();
    const st = S.getState();

    panel.innerHTML = `
      <table class="budget-table">
        <tr><td>Hotels (Plan)</td><td>€${b.hotelPlanned.toLocaleString('de-DE')}</td></tr>
        <tr><td>Hotels (gebucht/Ist)</td><td>€${Math.round(b.hotelBooked).toLocaleString('de-DE')}</td></tr>
        <tr><td>Restaurants</td><td class="budget-table__input"><input type="number" id="restaurant-budget-input" value="${st.restaurantBudget || ''}" placeholder="${TRIP_DATA.meta.restaurantBudgetEstimate.min}–${TRIP_DATA.meta.restaurantBudgetEstimate.max}" min="0" step="10"></td></tr>
        <tr><td>Maut/Vignetten (Ø)</td><td>€${Math.round(b.tolls).toLocaleString('de-DE')}</td></tr>
        <tr><td>Tank (Ø)</td><td>€${Math.round(b.fuel).toLocaleString('de-DE')}</td></tr>
        <tr class="budget-table__total"><td><strong>Gesamt (geschätzt)</strong></td><td><strong>€${Math.round(b.total).toLocaleString('de-DE')}</strong></td></tr>
      </table>
      <div class="budget-scenarios-toggle">
        <label class="budget-scenario-label">Was-wäre-wenn:</label>
        <select id="budget-scenario-select">
          <option value="default" ${st.budgetScenario === 'default' ? 'selected' : ''}>Deine Picks (€1.926)</option>
          <option value="borromees" ${st.budgetScenario === 'borromees' ? 'selected' : ''}>+ Borromées</option>
          <option value="sextantio" ${st.budgetScenario === 'sextantio' ? 'selected' : ''}>+ Sextantio</option>
          <option value="both" ${st.budgetScenario === 'both' ? 'selected' : ''}>+ Beide</option>
        </select>
      </div>
    `;

    document.getElementById('restaurant-budget-input')?.addEventListener('input', (e) => {
      S.setState({ restaurantBudget: e.target.value });
      renderBudget();
      renderFlowIntro();
    });
    document.getElementById('budget-scenario-select')?.addEventListener('change', (e) => {
      S.setState({ budgetScenario: e.target.value });
      renderBudget();
    });
  }

  function statusSelect(id, current, disabled) {
    return `<select class="status-select" data-id="${id}" ${disabled ? 'disabled' : ''}>
      ${TRIP_DATA.statusOptions.booking.map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select>`;
  }

  function linkButtons(links, ztlHotelId) {
    const parts = [];
    if (links?.booking) parts.push(`<a class="btn btn--ghost btn--small" href="${links.booking}" target="_blank" rel="noopener">Booking</a>`);
    if (links?.ihg) parts.push(`<a class="btn btn--ghost btn--small" href="${links.ihg}" target="_blank" rel="noopener">IHG</a>`);
    if (links?.search) parts.push(`<a class="btn btn--ghost btn--small" href="${links.search}" target="_blank" rel="noopener">Suche</a>`);
    if (links?.direct) parts.push(`<a class="btn btn--ghost btn--small" href="${links.direct}" target="_blank" rel="noopener">Direkt</a>`);
    if (links?.website) parts.push(`<a class="btn btn--ghost btn--small" href="${links.website}" target="_blank" rel="noopener">Web</a>`);
    if (ztlHotelId && TRIP_DATA.ztlEmailTemplates.some((t) => t.hotelId === ztlHotelId)) {
      parts.push(`<button type="button" class="btn btn--ghost btn--small" data-ztl-de="${ztlHotelId}">ZTL DE</button>`);
      parts.push(`<button type="button" class="btn btn--ghost btn--small" data-ztl-it="${ztlHotelId}">ZTL IT</button>`);
    }
    return parts.length ? `<div class="link-row">${parts.join('')}</div>` : '';
  }

  function renderFlags(item) {
    const map = { ztl: 'ZTL', parking: 'Parkplatz', ac: 'AC', cancellation: 'Storno', cave: 'Sassi', spa: 'Spa', 'direct-booking': 'Direkt', motorway: 'A12', seafront: 'Meer' };
    let html = (item.flags || []).map((f) => `<span class="badge ${f === 'ztl' ? 'badge--ztl' : ''}">${map[f] || f}</span>`).join('');
    if (item.liveSearchRequired) html += '<span class="badge badge--live">Live-Suche</span>';
    if (item.priority === 'now' || item.priority === 'critical') html += '<span class="badge badge--urgent">Dringend</span>';
    return html;
  }

  function bookingCardHtml(item, mode) {
    const bs = S.getBookingState(item.id);
    const status = item.locked ? 'bestaetigt' : bs.status;
    const dl = U.deadlineBadge(item.bookBy);
    const statusLabel = TRIP_DATA.statusOptions.booking.find((o) => o.value === status)?.label || status;
    const collapsed = mode === 'compact' || (S.getState().collapsedConfirmed && status === 'bestaetigt' && mode !== 'expanded');

    if (mode === 'compact') {
      return `
      <article class="inbox-row ${B.isOverdue(item) ? 'inbox-row--overdue' : ''}" data-booking-id="${item.id}" id="bookable-${item.id}">
        <span class="inbox-row__type" title="${U.typeLabel(item.type)}">${U.typeIcon(item.type)}</span>
        <div class="inbox-row__main">
          <span class="inbox-row__title">${U.escapeHtml(item.title)}</span>
          <span class="inbox-row__meta">${U.escapeHtml(item.city)} · ${item.date ? U.formatDateDE(item.date) : U.formatDateRange(item.dates)}</span>
        </div>
        <span class="deadline-badge ${dl.class}">${dl.text}</span>
        ${statusSelect(item.id, status, item.locked)}
        <input type="text" class="inbox-row__conf confirmation-input" value="${U.escapeHtml(bs.confirmation)}" placeholder="Conf.#" ${item.locked ? 'readonly' : ''}>
        <button type="button" class="btn btn--ghost btn--small inbox-row__expand" data-expand="${item.id}">Details</button>
      </article>`;
    }

    const priceLine =
      item.type === 'hotel'
        ? `<p class="price-line">€${(item.total || 0).toLocaleString('de-DE')} · €${item.pricePerNight}/Nacht</p>`
        : item.priceEstimate
          ? `<p class="meta-line">${U.escapeHtml(item.priceEstimate)}</p>`
          : '';

    const actualPriceField =
      item.type === 'hotel' && !item.locked
        ? `<div class="field"><label>Ist-Preis (€)</label><input type="number" class="actual-price-input" data-id="${item.id}" value="${U.escapeHtml(bs.actualPrice)}" placeholder="${item.total}"></div>`
        : '';

    return `
    <article class="booking-card ${item.locked ? 'is-locked' : ''} ${collapsed ? 'is-collapsed' : ''}" data-booking-id="${item.id}" id="bookable-${item.id}">
      <header class="booking-card__header">
        <div>
          <span class="booking-card__type">${U.typeLabel(item.type)}</span>
          <h3 class="booking-card__title">${U.escapeHtml(item.title)}</h3>
          <p class="booking-card__city">${U.escapeHtml(item.city)}${item.meal ? ` · ${U.escapeHtml(item.meal)}` : ''}</p>
          <p class="booking-card__dates">${item.date ? U.formatDateDE(item.date) : U.formatDateRange(item.dates)}</p>
        </div>
        <div>
          <span class="status-badge status-badge--${status}">${statusLabel}</span>
          ${item.bookBy ? `<span class="deadline-badge ${dl.class}">${dl.text}</span>` : ''}
        </div>
      </header>
      <div class="booking-card__body booking-card__body--grid">
        <div>
          ${item.alternates?.length ? `<p class="meta-line">Alternativen: ${U.escapeHtml(item.alternates.join(', '))}</p>` : ''}
          ${priceLine}
          ${item.reviewScore ? `<p class="meta-line">Bewertung: ${U.escapeHtml(item.reviewScore)}</p>` : ''}
          ${item.bookWindow ? `<p class="meta-line">${U.escapeHtml(item.bookWindow)}</p>` : ''}
          <div class="badges">${renderFlags(item)}</div>
          ${linkButtons(item.links, item.ztlHotel ? item.id : null)}
          ${item.upgrades?.length ? `<details class="upgrades"><summary>Upgrades</summary><ul>${item.upgrades.map((u) => `<li>${U.escapeHtml(u.name)}: ${U.escapeHtml(u.note)}</li>`).join('')}</ul></details>` : ''}
        </div>
        <div>
          <div class="field"><label>Status</label>${statusSelect(item.id, status, item.locked)}</div>
          <div class="field"><label>Bestätigungsnr.</label><input type="text" class="confirmation-input" value="${U.escapeHtml(bs.confirmation)}" placeholder="Ref." ${item.locked ? 'readonly' : ''}></div>
          ${actualPriceField}
          <div class="field"><label>Notizen</label><textarea class="notes-input">${U.escapeHtml(bs.notes || item.notes || '')}</textarea></div>
        </div>
      </div>
    </article>`;
  }

  function bindBookingCard(card) {
    const id = card.dataset.bookingId;
    if (!id) return;
    card.querySelector('.status-select')?.addEventListener('change', (e) => {
      S.setBookingState(id, { status: e.target.value });
      TripApp().refresh();
    });
    card.querySelector('.confirmation-input')?.addEventListener('input', (e) => {
      S.setBookingState(id, { confirmation: e.target.value });
      renderFlowIntro();
    });
    card.querySelector('.notes-input')?.addEventListener('input', (e) => {
      S.setBookingState(id, { notes: e.target.value });
    });
    card.querySelector('.actual-price-input')?.addEventListener('input', (e) => {
      S.setBookingState(id, { actualPrice: e.target.value });
      renderBudget();
    });
    card.querySelectorAll('[data-ztl-de]').forEach((btn) => {
      btn.addEventListener('click', () => copyZtl(btn.dataset.ztlDe, 'de'));
    });
    card.querySelectorAll('[data-ztl-it]').forEach((btn) => {
      btn.addEventListener('click', () => copyZtl(btn.dataset.ztlIt, 'it'));
    });
  }

  function filterBookables(items, filter, search, typeFilter) {
    let list = items.filter((i) => !i.optional || filter === 'all');
    if (typeFilter && typeFilter !== 'all') list = list.filter((i) => i.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => {
        const hay = `${i.title} ${i.city} ${i.notes || ''} ${S.getBookingState(i.id).notes || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (filter === 'open') list = list.filter((i) => B.isOpen(i) && !i.locked);
    if (filter === 'urgent') list = list.filter((i) => B.isUrgent(i));
    if (filter === 'overdue') list = list.filter((i) => B.isOverdue(i));
    if (filter === 'noconf') list = list.filter((i) => B.needsConfirmation(i));
    return B.sortByDeadline(list);
  }

  function renderBookingsList(filter, search, typeFilter, viewMode) {
    const el = document.getElementById('bookings-list');
    if (!el) return;
    const items = filterBookables(B.all(), filter, search, typeFilter);
    if (!items.length) {
      el.innerHTML = '<p class="empty-state">Keine Einträge für diesen Filter.</p>';
      return;
    }
    const mode = viewMode === 'compact' ? 'compact' : 'full';
    if (mode === 'compact') {
      el.className = 'inbox-table';
      el.innerHTML = items.map((i) => bookingCardHtml(i, 'compact')).join('');
    } else {
      el.className = 'booking-grid';
      el.innerHTML = items.map((i) => bookingCardHtml(i, 'full')).join('');
    }
    el.querySelectorAll('[data-booking-id]').forEach(bindBookingCard);
    el.querySelectorAll('.inbox-row').forEach((row) => {
      const id = row.dataset.bookingId;
      row.querySelector('.status-select')?.addEventListener('change', (e) => {
        S.setBookingState(id, { status: e.target.value });
        TripApp().refresh();
      });
      row.querySelector('.confirmation-input')?.addEventListener('input', (e) => {
        S.setBookingState(id, { confirmation: e.target.value });
        renderFlowIntro();
      });
      row.querySelector('[data-expand]')?.addEventListener('click', () => {
        TripApp().setBookingsFilter('all');
        TripApp().setBookingsView('full');
        const card = document.getElementById(`bookable-${id}`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.classList.add('highlight-flash');
        setTimeout(() => card?.classList.remove('highlight-flash'), 2000);
      });
    });
  }

  function segmentBadge(type) {
    const map = {
      overnight: 'Transit',
      booked: 'Gebucht',
      wedding: 'Hochzeit',
      explore: 'Erkunden',
      chill: 'Entspannen',
      'drive-home': 'Heimfahrt',
    };
    return map[type] || type;
  }

  function statusDot(status) {
    return `<span class="day-status day-status--${status}" title="${status}"></span>`;
  }

  function narrativeWhatHappens(day) {
    if (day.type === 'wedding') return 'Hochzeit in Bari — kein Fahrstress, ihr seid vor Ort.';
    if (day.type === 'drive-home') return 'Langer Heimweg über den Simplon — früh losfahren (Gotthard meiden).';
    if (day.km > 0) return `Fahrt: ${day.route} (~${day.hours} h).`;
    if (day.activities?.length) return day.activities[0];
    return day.route !== '—' ? day.route : 'Tag vor Ort';
  }

  function mapsButtonsHtml(maps, primaryLabel) {
    if (!maps?.google) return '';
    const label = primaryLabel || 'In Maps öffnen';
    return `<div class="cockpit-maps">
      <a class="btn btn--primary btn--small" href="${maps.google}" target="_blank" rel="noopener">${U.escapeHtml(label)}</a>
      ${maps.apple ? `<a class="btn btn--ghost btn--small" href="${maps.apple}" target="_blank" rel="noopener">Apple Karten</a>` : ''}
    </div>`;
  }

  function dayStatusBadge(day, openBookables) {
    const overdue = openBookables.filter((b) => B.isOverdue(b)).length;
    const status = B.dayStatus(day.id);
    if (status === 'complete') {
      return '<span class="status-badge status-badge--done">Erledigt</span>';
    }
    if (overdue) {
      return `<span class="status-badge status-badge--overdue">${overdue} überfällig</span>`;
    }
    if (openBookables.length) {
      return `<span class="status-badge status-badge--open">${openBookables.length} offen</span>`;
    }
    return '<span class="status-badge status-badge--none">Keine Buchung</span>';
  }

  function renderReiseStatus() {
    const el = document.getElementById('reise-trip-status');
    if (!el || !window.TripOps) return;
    const phase = TripOps.getTripPhase();
    const meta = TRIP_DATA.meta;
    el.innerHTML = `
      <p class="reise-status__label">${U.escapeHtml(phase.label)}</p>
      <p class="reise-status__meta">${U.formatDateDE(meta.start)} – ${U.formatDateDE(meta.end)} · ${meta.totalDriveKm} km gesamt · Maut ca. €${meta.tollsEstimate.min}–${meta.tollsEstimate.max}</p>`;
    const metaHeader = document.getElementById('header-meta');
    if (metaHeader && phase.phase === 'during' && phase.currentDayId) {
      const day = TRIP_DATA.days.find((d) => d.id === phase.currentDayId);
      if (day) metaHeader.textContent = `Heute: ${day.label} · ${U.formatDateDE(day.date)}`;
    } else if (metaHeader && phase.phase === 'before') {
      metaHeader.textContent = `${U.formatDateDE(meta.start)} – ${U.formatDateDE(meta.end)} · Abfahrt in ${phase.daysUntilStart} Tagen`;
    }
  }

  function renderDayCockpit(dayId) {
    const el = document.getElementById('trip-day-cockpit');
    if (!el || !window.TripOps) return;
    const day = TRIP_DATA.days.find((d) => d.id === dayId);
    if (!day) {
      el.innerHTML = '<p class="cockpit-empty">Wähle einen Tag in der Liste.</p>';
      return;
    }
    const ops = TripOps.getDayOps(day);
    const drive =
      day.km > 0
        ? `<p class="cockpit-drive"><strong>Fahrt:</strong> ${U.escapeHtml(day.route)} · ${day.km} km · ~${day.hours} h</p>`
        : '';
    const hotel = ops.hotel
      ? `<div class="cockpit-block">
          <h3 class="cockpit-block__title">Übernachtung</h3>
          <p class="cockpit-hotel">${U.escapeHtml(ops.hotel.pick)} · ${U.escapeHtml(ops.hotel.city)}</p>
          ${ops.confirmation ? `<p class="cockpit-conf"><strong>Conf.#</strong> ${U.escapeHtml(ops.confirmation)}</p>` : ops.hotelBookable ? `<p class="cockpit-conf cockpit-conf--missing">Noch keine Bestätigungsnr. <button type="button" class="btn btn--ghost btn--small" data-cockpit-conf="${ops.hotelBookable.id}">Eintragen</button></p>` : '<p class="cockpit-conf cockpit-conf--missing">Bestätigungsnr. in Details eintragen</p>'}
          ${mapsButtonsHtml(ops.overnightMaps)}
        </div>`
      : day.type === 'drive-home'
        ? `<div class="cockpit-block"><h3 class="cockpit-block__title">Heimfahrt</h3><p>Kein Hotel — Ziel Luxemburg.</p>${mapsButtonsHtml(ops.maps)}</div>`
        : '';
    const legMaps = day.km > 0 && ops.maps ? mapsButtonsHtml(ops.maps) : '';
    const hints = [ops.ztl, ops.toll].filter(Boolean);
    const hintsHtml = hints.length
      ? `<ul class="cockpit-hints">${hints.map((h) => `<li>${U.escapeHtml(h)}</li>`).join('')}</ul>`
      : '';
    const stops = ops.bookables
      .filter((b) => b.type !== 'hotel' || b.id !== ops.hotel?.id)
      .map((b) => {
        const done = B.isDone(b);
        const bs = S.getBookingState(b.id);
        return `<li class="cockpit-stop ${done ? 'is-done' : ''}">
          <span class="cockpit-stop__type">${U.typeLabel(b.type)}</span>
          <span class="cockpit-stop__name">${U.escapeHtml(b.title)}</span>
          ${bs.confirmation ? `<span class="cockpit-stop__conf">${U.escapeHtml(bs.confirmation)}</span>` : ''}
          <button type="button" class="btn btn--ghost btn--small" data-cockpit-booking="${b.id}">Details</button>
        </li>`;
      })
      .join('');
    const activities =
      day.activities?.length
        ? `<ul class="cockpit-activities">${day.activities.map((a) => `<li>${U.escapeHtml(a)}</li>`).join('')}</ul>`
        : '';

    el.innerHTML = `
      <article class="cockpit" id="cockpit-${day.id}">
        <header class="cockpit__head">
          <h2 class="cockpit__title">${U.escapeHtml(day.label)} · ${U.escapeHtml(day.weekday)} ${U.formatDateDE(day.date)}</h2>
          <p class="cockpit__sleep">${U.escapeHtml(day.sleep)}</p>
        </header>
        ${drive}
        <div id="cockpit-weather" class="cockpit-weather-slot"></div>
        ${legMaps && day.km > 0 ? `<div class="cockpit-block"><h3 class="cockpit-block__title">Navigation (Fahrt)</h3>${mapsButtonsHtml(ops.maps, 'Route in Maps')}</div>` : ''}
        ${hotel}
        ${hintsHtml}
        ${activities ? `<div class="cockpit-block"><h3 class="cockpit-block__title">Aktivitäten</h3>${activities}</div>` : ''}
        ${stops ? `<div class="cockpit-block"><h3 class="cockpit-block__title">Reservierungen & Tickets</h3><ul class="cockpit-stops">${stops}</ul></div>` : ''}
      </article>`;

    el.querySelectorAll('[data-cockpit-booking]').forEach((btn) => {
      btn.addEventListener('click', () => TripApp().goToStep(btn.dataset.cockpitBooking));
    });
    el.querySelectorAll('[data-cockpit-conf]').forEach((btn) => {
      btn.addEventListener('click', () => TripApp().goToStep(btn.dataset.cockpitConf));
    });

    if (window.TripWeather) {
      TripWeather.renderInto('cockpit-weather', day);
    }
  }

  function narrativeYourPlan(day) {
    const items = B.forDay(day.id).filter((b) => !b.optional);
    if (!items.length) {
      if (day.type === 'booked' || day.type === 'wedding') return 'Unterkunft ist gebucht — genießen.';
      if (day.type === 'drive-home') return 'Keine Buchung nötig.';
      return 'Nichts Offenes für diesen Tag.';
    }
    return items
      .map((b) => {
        const done = B.isDone(b);
        const mark = done ? '✓ ' : '○ ';
        const short = b.title.length > 35 ? b.title.slice(0, 35) + '…' : b.title;
        return `${mark}${short}`;
      })
      .join(' · ');
  }

  function renderTripDays(reiseFilter) {
    const el = document.getElementById('trip-day-strip');
    if (!el) return;
    const st = S.getState();
    const filter = reiseFilter || 'all';
    const days = window.TripOps ? TripOps.filterDays(TRIP_DATA.days, filter) : TRIP_DATA.days;
    const currentDayId = window.TripOps?.getCurrentDayId();

    if (!days.length) {
      el.innerHTML =
        filter === 'heute'
          ? '<p class="empty-state">„Heute“ ist erst ab dem ersten Reisetag aktiv — bis dahin „Alle“ nutzen.</p>'
          : '<p class="empty-state">Keine Tage für diesen Filter.</p>';
      return;
    }

    el.innerHTML = days
      .map((day) => {
        const dt = U.parseDate(day.date);
        const dayStatus = B.dayStatus(day.id);
        const bookables = B.forDayAll(day.id);
        const openBookables = bookables.filter((b) => !b.optional && B.isOpen(b));
        const expanded = !!st.expandedDays[day.id];
        const isToday = day.id === currentDayId;
        const selected =
          day.id === (window.TripMap?.getSelectedDayId?.() || currentDayId);
        const needsZtl = window.TripOps?.dayNeedsZtl?.(day);

        const stats =
          day.km > 0 ? `${day.km} km · ~${day.hours} h` : '';

        const progressItems = B.forDay(day.id);
        const done = progressItems.filter(B.isDone).length;
        const prog = progressItems.length ? `${done} von ${progressItems.length} erledigt` : '';

        const what = narrativeWhatHappens(day);
        const plan = narrativeYourPlan(day);
        const badge = dayStatusBadge(day, openBookables);

        return `
        <article class="day-card day-card--${day.type} ${expanded ? 'is-expanded' : ''} ${isToday ? 'day-card--today' : ''} ${selected ? 'day-card--selected' : ''}" data-day-id="${day.id}" id="day-${day.id}">
          <button type="button" class="day-card__head" data-select-day="${day.id}" data-toggle-day="${day.id}">
            ${statusDot(dayStatus)}
            <div class="day-card__date">
              <span class="day-card__wd">${day.label || day.weekday}</span>
              <span class="day-card__num">${dt.getDate()}</span>
              <span class="day-card__mo">${U.MONTHS_DE[dt.getMonth()]}</span>
            </div>
            <div class="day-card__main">
              <div class="day-card__badges">${badge}${needsZtl ? '<span class="status-badge status-badge--ztl">ZTL</span>' : ''}${isToday ? '<span class="status-badge status-badge--today">Heute</span>' : ''}</div>
              <p class="day-card__story-label">Was passiert</p>
              <p class="day-card__story">${U.escapeHtml(what)}</p>
              <p class="day-card__story-label">Dein Plan</p>
              <p class="day-card__plan">${U.escapeHtml(plan)}</p>
              <p class="day-card__meta">${U.escapeHtml(day.sleep)}${stats ? ` · ${U.escapeHtml(stats)}` : ''} <span class="segment-badge">${segmentBadge(day.type)}</span></p>
            </div>
            ${prog ? `<span class="day-card__prog">${prog}</span>` : ''}
          </button>
          <div class="day-card__detail" ${expanded ? '' : 'hidden'}>
            ${(day.activities || []).length ? `<p class="day-card__detail-label">Aktivitäten</p><ul class="day-card__activities">${(day.activities || []).map((a) => `<li>${U.escapeHtml(a)}</li>`).join('')}</ul>` : ''}
            ${openBookables.length ? `<p class="day-card__detail-label">Noch offen</p><div class="day-card__mini-steps">${openBookables.map((b) => `<button type="button" class="day-mini-step" data-scroll-id="${b.id}">${U.escapeHtml(TripFlow.verbForBookable(b))}</button>`).join('')}</div>` : ''}
          </div>
        </article>`;
      })
      .join('');

    el.querySelectorAll('[data-select-day]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('[data-scroll-id]')) return;
        const id = btn.dataset.selectDay;
        window.TripMap?.selectDay(id);
        TripApp()?.updateReiseDayNav?.(id);
      });
    });

    el.querySelectorAll('[data-toggle-day]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('[data-scroll-id]')) return;
        const id = btn.dataset.toggleDay;
        const st = S.getState();
        st.expandedDays[id] = !st.expandedDays[id];
        S.setState({ expandedDays: st.expandedDays });
      });
    });

    el.querySelectorAll('[data-scroll-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        TripApp().goToStep(btn.dataset.scrollId);
      });
    });
  }

  function renderDriver() {
    const sections = document.getElementById('driver-sections');
    if (!sections) return;
    const st = S.getState();
    sections.innerHTML = TRIP_DATA.driverSections
      .map(
        (sec) => `
      <section class="driver-section">
        <h3 class="driver-section__title">${U.escapeHtml(sec.title)}</h3>
        <ul class="checklist">
          ${sec.items
            .map((text, i) => {
              const key = `${sec.id}-${i}`;
              const checked = !!st.driver[key];
              return `<li class="checklist__item ${checked ? 'is-done' : ''}">
                <input type="checkbox" id="driver-${key}" data-key="${key}" ${checked ? 'checked' : ''}>
                <label for="driver-${key}">${U.escapeHtml(text)}</label>
              </li>`;
            })
            .join('')}
        </ul>
      </section>`
      )
      .join('');
    sections.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        const st = S.getState();
        st.driver[input.dataset.key] = input.checked;
        S.setState({ driver: st.driver });
        input.closest('.checklist__item')?.classList.toggle('is-done', input.checked);
      });
    });
  }

  function renderZtlSidebar() {
    const el = document.getElementById('ztl-templates');
    if (!el) return;
    el.innerHTML = TRIP_DATA.ztlEmailTemplates
      .map(
        (tpl) => `
      <div class="ztl-block">
        <p class="ztl-block__title">${U.escapeHtml(tpl.hotelName)}</p>
        <p class="meta-line">${U.formatDateDE(tpl.arrivalDate)}</p>
        <div class="ztl-block__actions">
          <button type="button" class="btn btn--ghost btn--small" data-ztl-de="${tpl.hotelId}">DE</button>
          <button type="button" class="btn btn--ghost btn--small" data-ztl-it="${tpl.hotelId}">IT</button>
        </div>
      </div>`
      )
      .join('');
    el.querySelectorAll('[data-ztl-de]').forEach((btn) => btn.addEventListener('click', () => copyZtl(btn.dataset.ztlDe, 'de')));
    el.querySelectorAll('[data-ztl-it]').forEach((btn) => btn.addEventListener('click', () => copyZtl(btn.dataset.ztlIt, 'it')));
  }

  function renderSettings() {
    const el = document.getElementById('settings-panel');
    if (!el) return;
    el.innerHTML = `
      <div class="field">
        <label for="license-plate">Kennzeichen (für ZTL-Mails)</label>
        <input type="text" id="license-plate" value="${U.escapeHtml(S.getState().licensePlate)}" placeholder="z. B. L-AB 1234">
      </div>
      <div class="settings-data">
        <p class="settings-data__label">Backup &amp; Sync</p>
        <div class="settings-data__actions">
          <button type="button" class="btn btn--ghost btn--small" id="btn-export">JSON exportieren</button>
          <button type="button" class="btn btn--ghost btn--small" id="btn-import-trigger">JSON importieren</button>
        </div>
      </div>
    `;
    document.getElementById('license-plate')?.addEventListener('input', (e) => {
      S.setState({ licensePlate: e.target.value });
    });
    document.getElementById('btn-import-trigger')?.addEventListener('click', () => {
      document.getElementById('btn-import')?.click();
    });
  }

  function renderAll(ctx) {
    if (ctx?.mode !== 'reise') renderFlowIntro(ctx?.planTab || 'jetzt');
    renderFlowPanel();
    if (ctx?.mode === 'reise') {
      renderReiseStatus();
      renderTripDays(ctx.reiseFilter);
      const dayId =
        window.TripMap?.getSelectedDayId?.() ||
        TripOps?.getCurrentDayId?.() ||
        TRIP_DATA.days[0]?.id;
      if (dayId) renderDayCockpit(dayId);
    } else {
      renderTripDays('all');
    }
    renderMilestones();
    renderBudget();
    renderSettings();
    renderBookingsList(ctx.bookingsFilter, ctx.search, ctx.typeFilter, ctx.viewMode);
    renderDriver();
    renderZtlSidebar();
  }

  return {
    showToast,
    renderAll,
    renderFlowIntro,
    renderFlowPanel,
    renderBookingsList,
    renderDayCockpit,
    renderReiseStatus,
    renderTripDays,
    copyZtl,
    getBudgetTotals,
  };
})();

if (typeof window !== 'undefined') {
  window.TripRender = TripRender;
}
