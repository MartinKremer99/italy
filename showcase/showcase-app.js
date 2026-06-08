/**
 * Showcase: route map + hotel choice cards + dining list
 */
(function () {
  const D = window.SHOWCASE_DATA;
  if (!D) return;

  const html = document.documentElement;
  const IMG = html.dataset.imgBase || 'showcase/images';
  const ROUTE_URL = html.dataset.routeUrl || 'showcase/route.geojson';

  const mapsSearch = (q) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  const roleLabel = {
    pick: 'Unsere Wahl',
    alternate: 'Alternative',
    upgrade: 'Upgrade',
    inspiration: 'Inspiration',
    search: 'Suche',
  };

  const statusLabel = {
    booked: { text: 'Gebucht', class: 'status--done' },
    choose: { text: 'Entscheiden', class: 'status--open' },
    search: { text: 'Auf Booking suchen', class: 'status--search' },
    urgent: { text: 'Bald buchen', class: 'status--urgent' },
  };

  function imgSrc(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : `${IMG}/${path}`;
  }

  function escape(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHotelStops() {
    const root = document.getElementById('hotel-choices');
    if (!root) return;

    root.innerHTML = D.hotelStops
      .map((stop) => {
        const st = statusLabel[stop.status] || statusLabel.choose;
        const cards = stop.options
          .map((opt) => {
            const isPick = opt.role === 'pick';
            const price =
              opt.total != null
                ? `€${opt.total} gesamt`
                : opt.priceNight != null
                  ? `ca. €${opt.priceNight}/Nacht`
                  : opt.priceNight
                    ? `ca. ${opt.priceNight}/Nacht`
                    : '';
            const links = [
              opt.booking
                ? `<a class="opt-link opt-link--primary" href="${escape(opt.booking)}" target="_blank" rel="noopener">Booking</a>`
                : '',
              opt.direct
                ? `<a class="opt-link" href="${escape(opt.direct)}" target="_blank" rel="noopener">Hotel direkt</a>`
                : '',
              opt.maps
                ? `<a class="opt-link" href="${mapsSearch(opt.maps)}" target="_blank" rel="noopener">Karte</a>`
                : '',
            ]
              .filter(Boolean)
              .join('');

            return `
          <article class="hotel-opt ${isPick ? 'hotel-opt--pick' : ''} hotel-opt--${opt.role}">
            ${opt.image ? `<div class="hotel-opt__img"><img src="${escape(imgSrc(opt.image))}" alt="${escape(opt.name)}" loading="lazy"></div>` : '<div class="hotel-opt__img hotel-opt__img--placeholder"><span>?</span></div>'}
            <div class="hotel-opt__body">
              <span class="hotel-opt__role">${escape(roleLabel[opt.role] || opt.role)}</span>
              <h4 class="hotel-opt__name">${escape(opt.name)}</h4>
              ${opt.score ? `<p class="hotel-opt__score">${escape(opt.score)}</p>` : ''}
              ${price ? `<p class="hotel-opt__price">${escape(price)}</p>` : ''}
              ${opt.note ? `<p class="hotel-opt__note">${escape(opt.note)}</p>` : ''}
              ${opt.tags?.length ? `<p class="hotel-opt__tags">${opt.tags.map((t) => `<span>${escape(t)}</span>`).join('')}</p>` : ''}
              ${links ? `<div class="hotel-opt__links">${links}</div>` : ''}
            </div>
          </article>`;
          })
          .join('');

        return `
        <section class="hotel-stop" id="hotel-${escape(stop.id)}">
          <header class="hotel-stop__head">
            <div>
              <h3 class="hotel-stop__city display">${escape(stop.city)}</h3>
              <p class="hotel-stop__meta">${escape(stop.dates)} · ${escape(stop.country)}</p>
            </div>
            <span class="hotel-stop__status ${st.class}">${escape(st.text)}</span>
          </header>
          ${stop.bookBy ? `<p class="hotel-stop__bookby"><strong>Buchen bis:</strong> ${escape(stop.bookBy)}</p>` : ''}
          ${stop.notes ? `<p class="hotel-stop__notes">${escape(stop.notes)}</p>` : ''}
          <div class="hotel-stop__options">${cards}</div>
        </section>`;
      })
      .join('');
  }

  function renderDining() {
    const root = document.getElementById('dining-choices');
    if (!root) return;
    root.innerHTML = D.dining
      .map(
        (r) => `
      <article class="dining-card ${r.priority === 'critical' ? 'dining-card--critical' : ''}">
        <p class="dining-card__meta">${escape(r.date)} · ${escape(r.city)} · ${escape(r.meal)}</p>
        <h4 class="dining-card__pick">${escape(r.pick)}</h4>
        ${r.alt ? `<p class="dining-card__alt">oder: ${escape(r.alt)}</p>` : ''}
        <p class="dining-card__book">Reservieren bis: ${escape(r.bookBy)}</p>
        ${r.website ? `<a class="dining-card__link" href="${escape(r.website)}" target="_blank" rel="noopener">Website</a>` : ''}
      </article>`
      )
      .join('');
  }

  function renderBudget() {
    const el = document.getElementById('budget-strip');
    if (!el || !D.meta) return;
    const m = D.meta;
    el.innerHTML = `
      <span><strong>Hotels</strong> ~€${m.hotelPlanned} <small>(Ziel €${m.hotelBudget})</small></span>
      <span><strong>Restaurants</strong> €${m.restaurants.min}–${m.restaurants.max}</span>
      <span><strong>Maut + Tank</strong> €${m.tolls.min + m.fuel.min}–${m.tolls.max + m.fuel.max}</span>
      <span><strong>Fahrt</strong> ~${m.totalKm.toLocaleString('de-DE')} km</span>
    `;
  }

  async function initMap() {
    const el = document.getElementById('showcase-map');
    if (!el || typeof L === 'undefined') return;

    const map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    const segColors = D.segmentColors;
    let geojson = null;
    try {
      const res = await fetch(ROUTE_URL);
      if (res.ok) geojson = await res.json();
    } catch {
      /* fallback polyline */
    }

    if (geojson) {
      L.geoJSON(geojson, {
        style: (f) => ({
          color: segColors[f.properties?.segment] || '#4a6741',
          weight: 4,
          opacity: 0.85,
        }),
      }).addTo(map);
    } else {
      const latlngs = D.routeStops.filter((s) => s.lat).map((s) => [s.lat, s.lng]);
      L.polyline(latlngs, { color: '#4a6741', weight: 3 }).addTo(map);
    }

    const dayLabels = {
      'day-1': '27.7.',
      'day-2': '28.7.',
      'day-3': '29.7.',
      'day-5': '31.7.',
      'day-6': '1.8.',
      'day-8': '3.8.',
      'day-10': '5.8.',
      'day-11': '6.8.',
    };

    D.routeStops.forEach((stop, i) => {
      if (stop.lat == null) return;
      const color = segColors[stop.segment] || '#c45c3a';
      const num = stop.dayId ? dayLabels[stop.dayId] || '' : i === 0 ? 'Start' : 'Ziel';
      const icon = L.divIcon({
        className: 'showcase-marker-wrap',
        html: `<span class="showcase-marker" style="--c:${color}">${escape(num || stop.label.slice(0, 1))}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map);
      marker.bindPopup(
        `<strong>${escape(stop.label)}</strong>${stop.dayId ? `<br><a href="#route">→ Tag in der Route</a>` : ''}`
      );
    });

    const bounds = L.latLngBounds(D.routeStops.filter((s) => s.lat).map((s) => [s.lat, s.lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 6 });

    setTimeout(() => map.invalidateSize(), 200);

    document.querySelectorAll('.route-stop[data-stop]').forEach((node) => {
      node.addEventListener('click', () => {
        const id = node.dataset.stop;
        const stop = D.routeStops.find((s) => s.id === id);
        if (stop?.lat) map.flyTo([stop.lat, stop.lng], 8, { duration: 0.8 });
      });
    });
  }

  function wireRouteStrip() {
    const stops = [
      'lux',
      'innsbruck',
      'pesaro',
      'bari',
      'matera',
      'rome',
      'siena',
      'bologna',
      'stresa',
      'lux-end',
    ];
    document.querySelectorAll('.route-stop').forEach((el, i) => {
      if (stops[i]) el.dataset.stop = stops[i];
      el.style.cursor = 'pointer';
      el.title = 'Auf der Karte zeigen';
    });
  }

  function wireNav() {
    const nav = document.querySelector('.showcase-nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('showcase-nav--solid', window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  renderBudget();
  renderHotelStops();
  renderDining();
  wireRouteStrip();
  wireNav();
  initMap();
})();
