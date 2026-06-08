/**
 * User-oriented action flow — what to do, why, when
 */
import { lazyGlobal } from './deps.js';

const TripFlow = (function () {
  'use strict';

  const TRIP_DATA = lazyGlobal('TRIP_DATA');
  const U = lazyGlobal('TripUtils');
  const B = lazyGlobal('TripBookables');
  const S = lazyGlobal('TripState');

  const CLEANUP_WHY = {
    'cleanup-pesaro':
      'Die klassischen Strandhotels am Lungomare fehlten in der ersten Suche — 2 Minuten live auf Booking.com reichen.',
    'cleanup-ihg':
      'Mit IHG-Punkten kannst du Innsbruck, Rom oder Bologna günstiger bekommen als mit Cash.',
    'cleanup-bologna-ztl':
      'Ohne schriftliche ZTL-Bestätigung riskierst du Bußgelder — kurze E-Mail ans Hotel Roma vor der Buchung.',
    'cleanup-matera-cancel':
      'August in Matera ist oft streng stornierbar — einmal schriftlich klären, bevor du zahlst.',
    'cleanup-stresa-direct':
      'Grand Hotels am See sind per Telefon oft €15–30/Nacht günstiger oder mit Frühstück.',
    'cleanup-rome-ac':
      'Rom im August ohne funktionierende Klimaanlage ist hart — kurz die neuesten Bewertungen filtern.',
  };

  const CLEANUP_VERB = {
    'cleanup-pesaro': 'Finde dein Pesaro-Hotel am Meer',
    'cleanup-ihg': 'Prüfe IHG-Punkte für Innsbruck, Rom, Bologna',
    'cleanup-bologna-ztl': 'Lass ZTL für Hotel Roma Bologna bestätigen',
    'cleanup-matera-cancel': 'Kläre die Storno-Regeln bei Aquatio',
    'cleanup-stresa-direct': 'Rufe Regina Palace oder Borromées an',
    'cleanup-rome-ac': 'Prüfe Klimaanlage-Bewertungen für Colonna Inn',
  };

  function kindLabel(item) {
    if (item.type === 'hotel') return 'Hotel';
    if (item.type === 'restaurant') return 'Tisch reservieren';
    return 'Ticket / Aktivität';
  }

  function verbForBookable(item) {
    if (item.actionVerb) return item.actionVerb;
    if (item.locked) return `${item.title} — bereits erledigt`;
    if (item.liveSearchRequired) return `Finde dein Hotel in ${item.city}`;
    if (item.type === 'hotel') return `Buche ${item.title} in ${item.city}`;
    if (item.type === 'restaurant') return `Reserviere ${item.title} in ${item.city}`;
    return `Buche ${item.title}`;
  }

  function whyForBookable(item) {
    if (item.actionWhy) return item.actionWhy;
    if (item.notes) {
      const first = item.notes.split(/[.—]/)[0].trim();
      if (first.length > 15 && first.length < 120) return first;
      return item.notes.length <= 140 ? item.notes : item.notes.slice(0, 137) + '…';
    }
    if (item.liveSearchRequired) {
      return 'Die beste Lungomare-Unterkunft musst du kurz live suchen — die Empfehlung aus der ersten Recherche war unvollständig.';
    }
    if (item.priority === 'now') return 'Hochsaison — Zimmer und Tische gehen schnell weg.';
    if (item.priority === 'critical') return 'Begrenztes Buchungsfenster — Termin im Kalender notieren.';
    if (item.ztlHotel) return 'Du kommst mit dem Auto: Hotel muss dein Kennzeichen für die ZTL registrieren.';
    if (item.bookWindow) return item.bookWindow;
    if (item.bookByLabel) return `Empfohlen: ${item.bookByLabel}`;
    return 'Teil deines Gesamtplans für die Reise.';
  }

  function phaseForBookable(item) {
    if (B.isDone(item) || item.locked) return 'done';
    if (B.isOverdue(item)) return 'now';
    if (item.priority === 'now' || item.priority === 'critical') return 'now';
    if (item.bookBy) {
      const d = U.daysUntil(item.bookBy);
      if (d !== null && d <= 21) return 'soon';
      if (item.bookBy <= '2026-06-30') return 'before-june';
    }
    if (item.priority === 'june') return 'before-june';
    return 'soon';
  }

  function ctasForBookable(item) {
    const ctas = [];
    const links = item.links || {};
    if (links.booking) ctas.push({ label: 'Auf Booking.com', href: links.booking, primary: true });
    if (links.website) ctas.push({ label: 'Website', href: links.website });
    if (links.ihg) ctas.push({ label: 'IHG prüfen', href: links.ihg });
    if (links.search) ctas.push({ label: 'Hotels suchen', href: links.search, primary: true });
    if (links.direct) ctas.push({ label: 'Hotel direkt', href: links.direct });
    if (item.ztlHotel && TRIP_DATA.ztlEmailTemplates.some((t) => t.hotelId === item.id)) {
      ctas.push({ label: 'ZTL-Mail kopieren', action: 'ztl-de', hotelId: item.id });
    }
    ctas.push({ label: 'Details anzeigen', action: 'detail', bookableId: item.id });
    return ctas;
  }

  function actionFromBookable(item) {
    return {
      id: `action-${item.id}`,
      bookableId: item.id,
      kind: 'bookable',
      kindLabel: kindLabel(item),
      verb: verbForBookable(item),
      why: whyForBookable(item),
      whenLabel: item.bookBy ? `Bis ${U.formatDateDE(item.bookBy)}` : item.bookByLabel || '—',
      phase: phaseForBookable(item),
      priceHint:
        item.total != null && item.total > 0
          ? `ca. €${item.total.toLocaleString('de-DE')}`
          : item.priceEstimate || '',
      done: B.isDone(item) || item.locked,
      overdue: B.isOverdue(item),
      ctas: ctasForBookable(item),
      sortKey: item.bookBy || '9999-12-31',
      priority: item.priority,
    };
  }

  function actionFromCleanup(task) {
    const done = !!S.getState().cleanup[task.id];
    return {
      id: `action-${task.id}`,
      cleanupId: task.id,
      kind: 'cleanup',
      kindLabel: 'Vorbereitung',
      verb: task.actionVerb || CLEANUP_VERB[task.id] || task.text.split('—')[0].trim().slice(0, 60),
      why: task.why || CLEANUP_WHY[task.id] || 'Einmal erledigen, bevor du endgültig buchst.',
      whenLabel: 'Vor der finalen Buchung',
      phase: done ? 'done' : 'prep',
      priceHint: '',
      done,
      overdue: false,
      ctas: [{ label: 'In Checkliste abhaken', action: 'cleanup', cleanupId: task.id }],
      sortKey: '0000-01-01',
      priority: 'medium',
    };
  }

  function buildActions() {
    const bookableActions = B.all()
      .filter((i) => !i.optional)
      .map(actionFromBookable);
    const cleanupActions = TRIP_DATA.cleanupTasks.map(actionFromCleanup);
    return [...bookableActions, ...cleanupActions];
  }

  function sortActions(actions) {
    return [...actions].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const phaseOrder = { now: 0, soon: 1, 'before-june': 2, prep: 3, done: 4 };
      const pa = phaseOrder[a.phase] ?? 5;
      const pb = phaseOrder[b.phase] ?? 5;
      if (pa !== pb) return pa - pb;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (a.sortKey || '').localeCompare(b.sortKey || '');
    });
  }

  function getOpenActions() {
    return sortActions(buildActions().filter((a) => !a.done));
  }

  function getHero() {
    const open = getOpenActions();
    return open[0] || null;
  }

  function getByPhase() {
    const actions = buildActions();
    const open = actions.filter((a) => !a.done);
    const done = actions.filter((a) => a.done);
    return {
      now: open.filter((a) => a.phase === 'now'),
      soon: open.filter((a) => a.phase === 'soon'),
      beforeJune: open.filter((a) => a.phase === 'before-june'),
      prep: open.filter((a) => a.phase === 'prep'),
      done,
    };
  }

  function progressSummary() {
    const all = buildActions().filter((a) => a.kind === 'bookable');
    const done = all.filter((a) => a.done).length;
    const total = all.length;
    const overdue = all.filter((a) => !a.done && a.overdue).length;
    const hero = getHero();
    const nextLabel = hero ? hero.verb.replace(/^Buche |^Reserviere |^Finde /, '').slice(0, 40) : 'alles erledigt';
    return { done, total, overdue, nextLabel, hero };
  }

  function introSentence() {
    const open = getOpenActions();
    const overdue = open.filter((a) => a.overdue);
    const urgent = open.filter((a) => a.phase === 'now' && !a.overdue);
    if (!open.length) {
      return 'Super — alle geplanten Buchungen und Vorbereitungen sind erledigt. Unter Reise siehst du den Ablauf Tag für Tag.';
    }
    if (overdue.length) {
      return `${overdue.length} ${overdue.length === 1 ? 'Schritt ist' : 'Schritte sind'} überfällig. Starte mit dem ersten Punkt unten — danach wird es leichter.`;
    }
    if (urgent.length) {
      return `${urgent.length} ${urgent.length === 1 ? 'Ding solltest du diese Woche erledigen' : 'Dinge solltest du diese Woche erledigen'} — Matera und Stresa füllen sich schnell.`;
    }
    return 'Arbeite die Liste von oben nach unten ab. Jeder Schritt erklärt, warum er gerade dran ist.';
  }

  const PHASE_LABELS = {
    now: 'Heute & diese Woche',
    soon: 'Bald — Termin notieren',
    'before-june': 'Im Juni erledigen',
    prep: 'Vor dem endgültigen Buchen',
    done: 'Erledigt',
  };

  function upcomingMilestones(limit = 5) {
    return B.sortByDeadline(
      B.all().filter((i) => i.bookBy && B.isOpen(i) && !i.optional)
    )
      .slice(0, limit)
      .map((item) => ({
        date: item.bookBy,
        title: item.title,
        why: whyForBookable(item).slice(0, 80),
        id: item.id,
        highlight: item.id === 'rest-franceschetta',
      }));
  }

  return {
    buildActions,
    getOpenActions,
    getHero,
    getByPhase,
    progressSummary,
    introSentence,
    PHASE_LABELS,
    upcomingMilestones,
    whyForBookable,
    verbForBookable,
  };
})();

if (typeof window !== 'undefined') {
  window.TripFlow = TripFlow;
}
