/**
 * Interactive roadtrip map (Leaflet + precomputed route GeoJSON)
 */
import L from 'leaflet';
import { lazyGlobal } from './deps.js';

const SEGMENT_COLORS = {
  start: '#6b7c5c',
  outbound: '#b85c38',
  wedding: '#c9a227',
  italy: '#4a6741',
  return: '#7a6f5a',
};

const TripMap = (function () {
  const TRIP_DATA = lazyGlobal('TRIP_DATA');
  const TripUtils = lazyGlobal('TripUtils');
  const TripOps = lazyGlobal('TripOps');
  const TripState = lazyGlobal('TripState');
  const TripRender = lazyGlobal('TripRender');

  let map = null;
  let routeLayers = null;
  let markersLayer = null;
  let placePinsLayer = null;
  let markerByDayId = {};
  let markerByStopId = {};
  let initialized = false;
  let selectedDayId = null;

  const PIN_COLORS = { hotel: '#b85c38', restaurant: '#c4923a', sight: '#4a6741' };

  function dayNumber(dayId) {
    if (!dayId) return '';
    const m = dayId.match(/day-(\d+)/);
    return m ? m[1] : '';
  }

  function dayForStop(stop) {
    if (!stop.dayId) return null;
    return TRIP_DATA.days.find((d) => d.id === stop.dayId);
  }

  function stopForDay(dayId) {
    return TRIP_DATA.routeStops.find((s) => s.dayId === dayId);
  }

  function createMarkerIcon(stop, index) {
    const num = dayNumber(stop.dayId) || (index === 0 ? '★' : index);
    const seg = stop.segment || 'italy';
    const color = SEGMENT_COLORS[seg] || SEGMENT_COLORS.italy;
    return L.divIcon({
      className: 'map-marker-wrap',
      html: `<span class="map-marker map-marker--${seg}" style="--marker-color:${color}">${num}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  function popupHtml(stop) {
    const day = dayForStop(stop);
    const dateStr = day ? TripUtils.formatDateDE(day.date) : '';
    const openDay = stop.dayId
      ? `<button type="button" class="btn btn--ghost btn--small map-popup-btn" data-day-id="${stop.dayId}">Tag anzeigen</button>`
      : '';
    return `
      <div class="map-popup">
        <strong>${TripUtils.escapeHtml(stop.label)}</strong>
        ${dateStr ? `<p class="map-popup__date">${dateStr}</p>` : ''}
        ${openDay}
      </div>`;
  }

  async function loadRouteGeoJSON() {
    const base = import.meta.env.BASE_URL || './';
    const res = await fetch(`${base}data/route.geojson`);
    if (!res.ok) throw new Error('route.geojson not found');
    return res.json();
  }

  function styleForFeature(feature) {
    const seg = feature.properties?.segment || 'italy';
    const color = SEGMENT_COLORS[seg] || SEGMENT_COLORS.italy;
    return {
      color,
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    };
  }

  function addMarkers() {
    markersLayer = L.layerGroup().addTo(map);
    markerByDayId = {};
    markerByStopId = {};

    TRIP_DATA.routeStops.forEach((stop, index) => {
      if (stop.lat == null || stop.lng == null) return;
      const icon = createMarkerIcon(stop, index);
      const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(markersLayer);
      marker.bindPopup(popupHtml(stop));
      markerByStopId[stop.id] = marker;
      if (stop.dayId) markerByDayId[stop.dayId] = marker;

      marker.on('click', () => {
        if (stop.dayId) selectDay(stop.dayId, { fromMap: true });
      });
    });

    map.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('[data-day-id]');
      btn?.addEventListener('click', () => {
        selectDay(btn.dataset.dayId, { fromMap: true });
        map.closePopup();
      });
    });
  }

  function createPlaceIcon(pin) {
    const sym = pin.type === 'hotel' ? 'H' : pin.type === 'restaurant' ? 'R' : 'T';
    const color = PIN_COLORS[pin.type] || PIN_COLORS.hotel;
    return L.divIcon({
      className: 'map-marker-wrap',
      html: `<span class="map-pin map-pin--${pin.type}" style="--marker-color:${color}">${sym}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function placePopupHtml(pin) {
    const dayId = pin.dayIds?.[0];
    const dayBtn = dayId
      ? `<button type="button" class="btn btn--ghost btn--small map-popup-btn" data-day-id="${dayId}">Tag anzeigen</button>`
      : '';
    const maps = TripOps.mapsDestinationUrl(pin.lat, pin.lng, `${pin.label}, ${pin.city}`);
    const mapsBtn = maps
      ? `<a class="btn btn--ghost btn--small" href="${maps}" target="_blank" rel="noopener">Navigation</a>`
      : '';
    return `<div class="map-popup"><strong>${TripUtils.escapeHtml(pin.label)}</strong><p class="map-popup__date">${TripUtils.escapeHtml(pin.city)} · ${TripUtils.typeLabel(pin.type)}</p><div class="map-popup__actions">${mapsBtn}${dayBtn}</div></div>`;
  }

  function addPlacePins() {
    if (!window.TripOps) return;
    placePinsLayer = L.layerGroup().addTo(map);
    TripOps.buildPlacePins().forEach((pin) => {
      const marker = L.marker([pin.lat, pin.lng], { icon: createPlaceIcon(pin) }).addTo(placePinsLayer);
      marker.bindPopup(placePopupHtml(pin));
      marker.on('click', () => {
        if (pin.dayIds?.[0]) selectDay(pin.dayIds[0], { fromMap: true });
      });
    });
    map.on('popupopen', (e) => {
      const el = e.popup.getElement();
      el?.querySelector('[data-day-id]')?.addEventListener('click', (ev) => {
        const id = ev.target.dataset.dayId;
        if (id) selectDay(id, { fromMap: true });
        map.closePopup();
      });
    });
  }

  function fitRouteBounds(geojson) {
    const layer = L.geoJSON(geojson);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
  }

  async function init() {
    if (initialized) {
      invalidate();
      return;
    }
    const el = document.getElementById('trip-map');
    if (!el || !TRIP_DATA?.routeStops) return;

    map = L.map(el, {
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    try {
      const geojson = await loadRouteGeoJSON();
      routeLayers = L.geoJSON(geojson, {
        style: styleForFeature,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties?.label || '', {
            permanent: false,
            direction: 'center',
            className: 'route-tooltip',
          });
        },
      }).addTo(map);
      fitRouteBounds(geojson);
    } catch (err) {
      console.warn('Route GeoJSON:', err);
      const latlngs = TRIP_DATA.routeStops.filter((s) => s.lat != null).map((s) => [s.lat, s.lng]);
      if (latlngs.length) {
        L.polyline(latlngs, { color: SEGMENT_COLORS.italy, weight: 3 }).addTo(map);
        map.fitBounds(latlngs, { padding: [40, 40] });
      }
    }

    addMarkers();
    addPlacePins();
    initialized = true;
    setTimeout(() => map.invalidateSize(), 100);
  }

  function highlightMarker(dayId) {
    Object.values(markerByDayId).forEach((m) => {
      const el = m.getElement();
      el?.querySelector('.map-marker')?.classList.remove('map-marker--active');
    });
    const marker = markerByDayId[dayId];
    if (marker) {
      marker.getElement()?.querySelector('.map-marker')?.classList.add('map-marker--active');
      marker.openPopup();
    }
  }

  function selectDay(dayId, opts = {}) {
    if (!dayId) return;
    selectedDayId = dayId;

    const st = TripState.getState();
    st.expandedDays[dayId] = true;
    TripState.setState({ expandedDays: st.expandedDays });

    document.querySelectorAll('.day-card').forEach((card) => {
      card.classList.toggle('day-card--selected', card.dataset.dayId === dayId);
    });

    const card = document.getElementById(`day-${dayId}`);
    if (card && !opts.fromMap) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    if (initialized && map) {
      const stop = stopForDay(dayId);
      if (stop?.lat != null) {
        map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
        highlightMarker(dayId);
      }
    }

    if (opts.fromMap && card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    if (window.TripRender?.renderDayCockpit) {
      TripRender.renderDayCockpit(dayId);
    }
    globalThis.TripApp?.updateReiseDayNav?.(dayId);
  }

  function getSelectedDayId() {
    return selectedDayId;
  }

  function invalidate() {
    if (map) map.invalidateSize();
  }

  function destroy() {
    if (map) {
      map.remove();
      map = null;
      initialized = false;
    }
  }

  return {
    init,
    selectDay,
    getSelectedDayId,
    invalidate,
    destroy,
    isInitialized: () => initialized,
  };
})();

window.TripMap = TripMap;

export default TripMap;
