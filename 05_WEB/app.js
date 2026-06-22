'use strict';

// ===== BASEMAPS =====
const BASEMAPS = {
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri World Imagery', maxZoom: 19 }
  ),
  topo: L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: 'Â© OpenTopoMap', maxZoom: 17 }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: 'Â© OpenStreetMap contributors', maxZoom: 19 }
  ),
  grey: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri Light Gray', maxZoom: 16 }
  ),
};

// ===== MAP INIT =====
const map = L.map('map', {
  center: [54.4, 9.7],
  zoom: 10,
  layers: [BASEMAPS.satellite],
  zoomControl: false,
});

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

map.createPane('catastroPane');
map.getPane('catastroPane').style.zIndex = 430;
map.createPane('statusGenehmigungPane');
map.getPane('statusGenehmigungPane').style.zIndex = 470;
map.createPane('rescuePane');
map.getPane('rescuePane').style.zIndex = 650;
map.createPane('warehousePane');
map.getPane('warehousePane').style.zIndex = 640;
map.createPane('toitoiPane');
map.getPane('toitoiPane').style.zIndex = 645;
map.createPane('spanPane');
map.getPane('spanPane').style.zIndex = 520;
map.createPane('vogelschutzPane');
map.getPane('vogelschutzPane').style.zIndex = 630;
map.createPane('erdungPane');
map.getPane('erdungPane').style.zIndex = 670;

let userLocationMarker = null;
let userAccuracyCircle = null;

function showUserLocation(lat, lng, accuracy) {
  const latlng = [lat, lng];

  if (userLocationMarker) {
    userLocationMarker.setLatLng(latlng);
  } else {
    userLocationMarker = L.circleMarker(latlng, {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1e88ff',
      fillOpacity: 1,
    }).addTo(map);
  }

  if (userAccuracyCircle) {
    userAccuracyCircle.setLatLng(latlng);
    userAccuracyCircle.setRadius(accuracy || 0);
  } else {
    userAccuracyCircle = L.circle(latlng, {
      radius: accuracy || 0,
      color: '#1e88ff',
      weight: 1,
      fillColor: '#1e88ff',
      fillOpacity: 0.18,
    }).addTo(map);
  }

  userLocationMarker.bindPopup('Tu ubicacion actual').openPopup();
  map.flyTo(latlng, Math.max(map.getZoom(), 15), { duration: 0.75 });
}

function locateUser() {
  if (!navigator.geolocation) {
    window.alert('Este navegador no permite geolocalizacion.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      showUserLocation(latitude, longitude, accuracy);
    },
    err => {
      const msg = err.code === err.PERMISSION_DENIED
        ? 'Permiso de ubicacion denegado.'
        : 'No se pudo obtener la ubicacion del dispositivo.';
      window.alert(msg);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

const LocateControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const button = L.DomUtil.create('button', 'leaflet-bar locate-btn');
    button.type = 'button';
    button.title = 'Mostrar mi ubicacion';
    button.setAttribute('aria-label', 'Mostrar mi ubicacion');
    button.innerHTML = '&#9673;';

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, 'click', () => locateUser());

    return button;
  },
});

map.addControl(new LocateControl());

// ===== MEASURE TOOL =====
let measureActive = false;
let measurePts    = [];
let measureLayers = [];
let measureRubber = null;

function clearMeasure() {
  measureLayers.forEach(l => { try { map.removeLayer(l); } catch (_) {} });
  measureLayers = [];
  measurePts    = [];
  if (measureRubber) { map.removeLayer(measureRubber); measureRubber = null; }
  const el = document.getElementById('measure-result');
  if (el) el.classList.add('hidden');
}

const MeasureControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'leaflet-bar measure-btn');
    btn.type  = 'button';
    btn.title = 'Medir distancia entre dos puntos';
    btn.setAttribute('aria-label', 'Medir distancia');
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<line x1="2" y1="12" x2="22" y2="12"/>' +
      '<line x1="2" y1="8" x2="2" y2="16"/>' +
      '<line x1="22" y1="8" x2="22" y2="16"/>' +
      '<line x1="7" y1="10" x2="7" y2="14"/>' +
      '<line x1="12" y1="9" x2="12" y2="15"/>' +
      '<line x1="17" y1="10" x2="17" y2="14"/>' +
      '</svg>';

    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.on(btn, 'click', () => {
      measureActive = !measureActive;
      btn.classList.toggle('active', measureActive);
      map.getContainer().style.cursor = measureActive ? 'crosshair' : '';
      if (!measureActive) clearMeasure();
    });
    return btn;
  },
});

map.addControl(new MeasureControl());

function wgs84ToUtm32(lat, lng) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lon0 = 9 * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const lonRad = lng * Math.PI / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const aa = cosLat * (lonRad - lon0);
  const m = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad)
  );

  const easting = k0 * n * (
    aa
    + (1 - t + c) * aa ** 3 / 6
    + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5 / 120
  ) + 500000;
  const northing = k0 * (
    m
    + n * tanLat * (
      aa ** 2 / 2
      + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24
      + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6 / 720
    )
  );

  return { easting, northing };
}

map.on('mousemove', e => {
  // LÃ­nea elÃ¡stica mientras se elige el segundo punto
  if (measureActive && measurePts.length === 1) {
    if (!measureRubber) {
      measureRubber = L.polyline([measurePts[0], e.latlng], {
        color: '#ff7700', weight: 2, dashArray: '6 4', opacity: 0.8,
      }).addTo(map);
    } else {
      measureRubber.setLatLngs([measurePts[0], e.latlng]);
    }
  }
  const utm = wgs84ToUtm32(e.latlng.lat, e.latlng.lng);
  document.getElementById('coords-bar').textContent =
    `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}  |  UTM32N EPSG:25832 E: ${utm.easting.toFixed(1)}  N: ${utm.northing.toFixed(1)}`;
});

map.on('click', e => {
  if (!measureActive) return;

  // Tercer clic: reiniciar mediciÃ³n anterior
  if (measurePts.length >= 2) clearMeasure();

  measurePts.push(e.latlng);

  const dot = L.circleMarker(e.latlng, {
    radius: 5, color: '#fff', weight: 2,
    fillColor: '#ff7700', fillOpacity: 1,
  }).addTo(map);
  measureLayers.push(dot);

  if (measurePts.length === 2) {
    if (measureRubber) { map.removeLayer(measureRubber); measureRubber = null; }

    const line = L.polyline(measurePts, {
      color: '#ff7700', weight: 2.5, dashArray: '8 5', opacity: 0.9,
    }).addTo(map);
    measureLayers.push(line);

    const dist = measurePts[0].distanceTo(measurePts[1]);
    const label = dist >= 1000
      ? `${(dist / 1000).toFixed(3)} km`
      : `${Math.round(dist)} m`;

    const el = document.getElementById('measure-result');
    if (el) {
      el.textContent = `ðŸ“ ${label}`;
      el.classList.remove('hidden');
    }
  }
});

// ===== WMS LAYERS =====
// Fuentes verificadas:
//   BfN   â†’ geodienste.bfn.de  (Bundesamt fÃ¼r Naturschutz, nacional)
//   BKG   â†’ sgx.geodatenzentrum.de  (Bundesamt fÃ¼r Kartographie, nacional)
//   GDI-SH â†’ dienste.gdi-sh.de  (Geodateninfrastruktur Schleswig-Holstein)
const WMS_LAYERS = {};

const BFN  = 'https://geodienste.bfn.de/ogc/wms/schutzgebiet';
const OSM_WMS = 'https://ows.terrestris.de/osm/service';

function createWmsLayer(url, options) {
  const layer = L.tileLayer.wms(url, {
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    ...options,
  });

  let hasWarned = false;
  layer.on('tileerror', () => {
    if (hasWarned) return;
    hasWarned = true;
    console.warn(`WMS no disponible o con error: ${options.layers} (${url})`);
  });

  return layer;
}

// Naturschutz (BfN nacional)
WMS_LAYERS['chk-naturschutz'] = createWmsLayer(BFN, {
  layers: 'Naturschutzgebiete',
  attribution: 'BfN - Naturschutzgebiete',
  opacity: 0.55,
});

// Infraestructura general OSM via WMS
WMS_LAYERS['chk-infra-osm'] = createWmsLayer(OSM_WMS, {
  layers: 'OSM-Overlay-WMS',
  attribution: 'OpenStreetMap contributors / terrestris OSM WMS',
  opacity: 0.7,
});

// FFH (BfN)
WMS_LAYERS['chk-ffh'] = createWmsLayer(BFN, {
  layers: 'Fauna_Flora_Habitat_Gebiete',
  attribution: 'Â© BfN â€“ FFH-Gebiete', opacity: 0.5,
});

// Vogelschutz SPA (BfN)
WMS_LAYERS['chk-vogel'] = createWmsLayer(BFN, {
  layers: 'Vogelschutzgebiete',
  attribution: 'Â© BfN â€“ Vogelschutzgebiete', opacity: 0.5,
});

// Landschaftsschutz (BfN)
WMS_LAYERS['chk-landschaft'] = createWmsLayer(BFN, {
  layers: 'Landschaftsschutzgebiete',
  attribution: 'Â© BfN â€“ Landschaftsschutz', opacity: 0.45,
});

// Biotopkataster (BfN â€” Biotoptypen bundesweit)
WMS_LAYERS['chk-biotop'] = createWmsLayer(BFN, {
  layers: 'biotoptyp',
  attribution: 'Â© BfN â€“ Biotoptypen', opacity: 0.55,
});

// GewÃ¤sser / Hydrographie â€” BKG GewÃ¤ssernetz
WMS_LAYERS['chk-hydro'] = createWmsLayer(
  'https://sgx.geodatenzentrum.de/wms_gewaessernetz', {
  layers: 'gewaessernetz',
  attribution: 'Â© BKG â€“ GewÃ¤ssernetz', opacity: 0.7,
});

// Ãœberschwemmungsgebiete HQ100 â€” GDI-SH HWRM
WMS_LAYERS['chk-hq100'] = createWmsLayer(
  'https://dienste.gdi-sh.de/WMS_SH_HWRM_RL', {
  layers: 'Ueberschwemmungsgebiete_HQ100',
  attribution: 'Â© GDI-SH â€“ Ãœberschwemmungsgebiete HQ100', opacity: 0.6,
});

// ===== STYLE HELPERS =====
function styleFor(layerName) {
  const cfg = {
    'wbk_weg_best':      { color: '#a85c00', fillColor: '#d4891a', weight: 2, fillOpacity: 0.45 },
    'wbk_weg_temp':      { color: '#ff8c00', fillColor: '#ffb347', weight: 2, fillOpacity: 0.35, dashArray: '6 4' },
    'wbk_arbeitsflaeche':{ color: '#00aa44', fillColor: '#00cc55', weight: 1.5, fillOpacity: 0.3 },
    'wbk_geruest':       { color: '#aa00aa', fillColor: '#cc44cc', weight: 1.5, fillOpacity: 0.35 },
    'wbk_ausholzung':    { color: '#007733', fillColor: '#009944', weight: 2,   fillOpacity: 0.4, dashArray: '4 3' },
    'wbk_schutznetz':    { color: '#0055bb', fillColor: '#2277ee', weight: 1.5, fillOpacity: 0.35 },
    'wbk_sperrung':      { color: '#dd0000', fillColor: '#ff4444', weight: 2,   fillOpacity: 0.4, dashArray: '8 4' },
  };
  return cfg[layerName] || { color: '#888', fillColor: '#aaa', weight: 1, fillOpacity: 0.3 };
}

// ===== TORRE MARKER =====
// mast_typ: "Abspannmast" â†’ rojo #e63030 | "Tragmast" â†’ azul #3a7bd5
const MAST_COLOR = {
  'Abspannmast': '#e63030',
  'Tragmast':    '#3a7bd5',
};

const TOWER_CHAIN_TYPES = {};
const CHAIN_PLAN_BASE_URL = window.location.hostname.endsWith('github.io')
  ? `${window.location.origin}/Audorf-Kassoe/assets/ketten/`
  : 'assets/ketten/';
const CHAIN_PLAN_LINKS = {
  'DA-Kette': `${CHAIN_PLAN_BASE_URL}LH-13-305_DA-Kette_002-442-213_Elecnor.pdf`,
  'V-Kette': `${CHAIN_PLAN_BASE_URL}LH-13-305_V-Kette_002-442-214_Elecnor.pdf`,
  'TA-Kette': `${CHAIN_PLAN_BASE_URL}LH-13-305_TA-Kette_V-Teil_002-294-203_Elecnor.pdf`,
  'Hilfskette': `${CHAIN_PLAN_BASE_URL}EH-Kette_SSDH_002-384-768_Elecnor.pdf`,
};
const LWL_PLAN_LINKS = {
  muffe: `${CHAIN_PLAN_BASE_URL}KETTEN_ESLK_Abspannung_Muffe_002-369-963_Elecnor.pdf`,
  abspannung: `${CHAIN_PLAN_BASE_URL}KETTEN_ESLK_Abspannung_002-369-964_Elecnor.pdf`,
  aufhaengung: `${CHAIN_PLAN_BASE_URL}KETTEN_ESLK_Aufhaengung_C-Bock_002-369-960_Elecnor.pdf`,
};
const LWL_MUFFE_MASTS = new Set(['79', '91', '100N', '108', '119', '128', '141', '146', '160', '175', '189', '206']);
const ERDUNG_ASSET_BASE_URL = window.location.hostname.endsWith('github.io')
  ? `${window.location.origin}/Audorf-Kassoe/assets/Erdungen/`
  : 'assets/Erdungen/';
const ERDUNG_DOC_LINKS = {
  rollenerde: `${ERDUNG_ASSET_BASE_URL}AAA-CE0256LB%20(%20singola%201000x95%20-%20spiegazione%20struttura%20codice%20).pdf`,
  abspann: `${ERDUNG_ASSET_BASE_URL}Datenblatt%20Nr.%201.pdf`,
  temporary: `${ERDUNG_ASSET_BASE_URL}Datenblatt%20Nr.%202.pdf`,
  usage040250028: `${ERDUNG_ASSET_BASE_URL}040250028-EN-V02.pdf`,
  usageEuK: `${ERDUNG_ASSET_BASE_URL}040106020_EuK_en_V02.PDF`,
  silhouette: `${ERDUNG_ASSET_BASE_URL}befestigungspunkte-aussenleiter.svg`,
};

function setTowerChains(mast, chains) {
  TOWER_CHAIN_TYPES[String(mast).toUpperCase()] = chains;
}

function setTowerChainRange(start, end, chainType, value) {
  for (let mast = start; mast <= end; mast += 1) {
    setTowerChains(mast, { [chainType]: value });
  }
}

setTowerChains(79, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChainRange(80, 90, 'V-Kette', '6.00');
setTowerChains(91, { 'DA-Kette': '12.00' });
setTowerChainRange(92, 96, 'V-Kette', '6.00');
setTowerChainRange(101, 102, 'V-Kette', '6.00');
setTowerChains(103, { 'TA-Kette': '6.00' });
setTowerChainRange(104, 106, 'V-Kette', '6.00');
setTowerChains(107, { 'TA-Kette': '6.00' });
setTowerChains(108, { 'DA-Kette': '12.00' });
setTowerChains(109, { 'V-Kette': '6.00' });
setTowerChains(110, { 'TA-Kette': '6.00' });
setTowerChainRange(111, 113, 'V-Kette', '6.00');
setTowerChains(114, { 'DA-Kette': '12.00' });
setTowerChainRange(115, 118, 'V-Kette', '6.00');
setTowerChains(119, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChains(120, { 'V-Kette': '6.00' });
setTowerChains(121, { 'TA-Kette': '6.00' });
setTowerChains(122, { 'DA-Kette': '12.00' });
setTowerChainRange(123, 127, 'V-Kette', '6.00');
setTowerChains(128, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChainRange(129, 140, 'V-Kette', '6.00');
setTowerChains(141, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChainRange(142, 145, 'V-Kette', '6.00');
setTowerChains(146, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChainRange(147, 159, 'V-Kette', '6.00');
setTowerChains(160, { 'DA-Kette': '12.00' });
setTowerChains(165, { 'DA-Kette': '12.00', 'Hilfskette': '2.00' });
setTowerChainRange(166, 188, 'V-Kette', '6.00');
setTowerChains(189, { 'DA-Kette': '12.00' });
setTowerChains(190, { 'TA-Kette': '6.00' });
setTowerChainRange(191, 202, 'V-Kette', '6.00');
setTowerChains('203N', { 'DA-Kette': '12.00' });
setTowerChains('204N', { 'DA-Kette': '12.00' });
setTowerChains(205, { 'V-Kette': '6.00' });
setTowerChains(206, { 'DA-Kette': '12.00' });

function getTowerChainTypes(apoyo) {
  const key = (apoyo || '').replace(/^M0*/i, '').toUpperCase();
  const numericKey = key.replace(/[A-Z]+$/i, '');
  return TOWER_CHAIN_TYPES[key] || TOWER_CHAIN_TYPES[numericKey] || null;
}

function formatTowerChains(apoyo) {
  const chains = getTowerChainTypes(apoyo);
  if (!chains) return '&mdash;';
  return Object.entries(chains)
    .map(([type, value]) => `${type}: ${value}`)
    .join('<br>');
}

function towerChainPlanButtons(apoyo) {
  const chains = getTowerChainTypes(apoyo);
  if (!chains) return '';
  const buttons = Object.keys(chains)
    .map(type => {
      const href = CHAIN_PLAN_LINKS[type];
      if (!href) return '';
      return `<a class="popup-plan-link" href="${href}" target="_blank" rel="noopener noreferrer">Plano ${escapeHtml(type)}</a>`;
    })
    .filter(Boolean)
    .join('');
  if (!buttons) return '';
  return `<div class="popup-plan-actions">${buttons}</div>`;
}

function normalizedMastKey(apoyo) {
  return String(apoyo || '').replace(/^M0*/i, '').toUpperCase();
}

function towerLwlPlanButton(apoyo, mastTyp) {
  const mastKey = normalizedMastKey(apoyo);
  const isMuffe = LWL_MUFFE_MASTS.has(mastKey);
  const isAbspannung = mastTyp === 'Abspannmast';
  const cfg = isMuffe
    ? {
        label: 'ESLK Abspannung Muffe',
        href: LWL_PLAN_LINKS.muffe,
        note: 'Muffenstandort gemaess Spleissplan',
      }
    : isAbspannung
      ? {
          label: 'ESLK Abspannung',
          href: LWL_PLAN_LINKS.abspannung,
          note: 'Abspannmast ohne Muffe',
        }
      : {
          label: 'ESLK Aufhaengung C-Bock',
          href: LWL_PLAN_LINKS.aufhaengung,
          note: 'Tragmast / Aufhaengung',
        };
  return `
    <div class="popup-plan-section">
      <div class="popup-plan-section-title">LWL / Fibra optica</div>
      <div class="popup-row"><span>Plano:</span> ${escapeHtml(cfg.label)}</div>
      <div class="popup-row"><span>Aplicacion:</span> ${escapeHtml(cfg.note)}</div>
      <div class="popup-plan-actions popup-plan-actions-compact">
        <a class="popup-plan-link" href="${cfg.href}" target="_blank" rel="noopener noreferrer">Abrir plano LWL</a>
      </div>
    </div>
  `;
}

function googleMapsDirectionsUrl(latlng) {
  if (!latlng) return '#';
  const lat = Number(latlng.lat).toFixed(6);
  const lng = Number(latlng.lng).toFixed(6);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function popupNavigationLink(latlng) {
  if (!latlng) return '';
  const lat = Number(latlng.lat).toFixed(6);
  const lng = Number(latlng.lng).toFixed(6);
  return `
    <div class="popup-actions">
      <a class="popup-nav-link" href="${googleMapsDirectionsUrl(latlng)}" target="_blank" rel="noopener noreferrer">
        Abrir ruta en Google Maps
      </a>
      <div class="popup-coords">Destino: ${lat}, ${lng}</div>
    </div>
  `;
}

function towerPopupHtml(props, latlng) {
  const p = props || {};
  const label = (p.apoyo || '').replace(/^M0*/, 'M');
  const color = MAST_COLOR[p.mast_typ] || '#888';
  const chainHtml = formatTowerChains(p.apoyo);
  return `
    <div class="popup-title" style="color:${color}">${escapeHtml(label)}</div>
    <div class="popup-row"><span>Tipo:</span> ${escapeHtml(p.mast_typ || '-')}</div>
    <div class="popup-row"><span>Cadenas:</span> ${chainHtml}</div>
    ${towerChainPlanButtons(p.apoyo)}
    ${towerLwlPlanButton(p.apoyo, p.mast_typ)}
    ${popupNavigationLink(latlng)}
  `;
}

function createRescueIcon(label) {
  const suffix = String(label || 'R').replace(/^.*-RP/i, 'R');
  return L.divIcon({
    className: '',
    html: `<div class="rescue-marker"><span>${escapeHtml(suffix)}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function rescuePopupHtml(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">RETTUNGSPUNKT</div>
    <div class="popup-row"><span>Rettungspunkt:</span> ${escapeHtml(p.rettungspunkt || '-')}</div>
    <div class="popup-row"><span>Mast Nr.:</span> ${escapeHtml(p.mast_nr || '-')}</div>
    <div class="popup-row"><span>Adresse:</span> ${escapeHtml(p.adresse || '-')}</div>
    <div class="popup-row"><span>Koordinaten:</span> ${escapeHtml(p.koordinaten || '-')}</div>
    ${popupNavigationLink(latlng)}
  `;
}

function createWarehouseIcon(label) {
  const suffix = String(label || 'B').match(/\d+/)?.[0] || 'B';
  return L.divIcon({
    className: '',
    html: `<div class="warehouse-marker"><span>${escapeHtml(suffix)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function warehousePopupHtml(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">BAULAGER</div>
    <div class="popup-row"><span>Name:</span> ${escapeHtml(p.name || '-')}</div>
    <div class="popup-row"><span>Baulos:</span> ${escapeHtml(p.baulos || '-')}</div>
    <div class="popup-row"><span>Adresse:</span> ${escapeHtml(p.adresse || '-')}</div>
    <div class="popup-row"><span>PLZ / Stadt:</span> ${escapeHtml(p.plz || '-')} ${escapeHtml(p.stadt || '')}</div>
    <div class="popup-row"><span>Land:</span> ${escapeHtml(p.land || '-')}</div>
    <div class="popup-row"><span>Kontakt obra:</span> ${escapeHtml(p.kontakt || '-')}</div>
    <div class="popup-row"><span>Telefon:</span> ${escapeHtml(p.telefon || '-')}</div>
    <div class="popup-row"><span>Observaciones:</span> ${escapeHtml(p.observaciones || '-')}</div>
    <div class="popup-row"><span>Horario recepción:</span> ${escapeHtml(p.materialannahme || '-')}</div>
    <div class="popup-row"><span>GIS:</span> ${escapeHtml(p.type || '-')} · ${escapeHtml(p.project || '-')} · ${escapeHtml(p.owner || '-')} · ${escapeHtml(p.status || '-')}</div>
    <div class="popup-row"><span>Geocoding:</span> ${escapeHtml(p.geocoding_quality || '-')}</div>
    ${popupNavigationLink(latlng)}
  `;
}

function createToiToiIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="toitoi-marker">WC</div>',
    iconSize: [30, 34],
    iconAnchor: [15, 17],
    popupAnchor: [0, -17],
  });
}

function toitoiPopupHtml(props, latlng) {
  const p = props || {};
  const mapsUrl = p.maps_url || googleMapsDirectionsUrl(latlng);
  return `
    <div class="popup-title">TOITOI / SANITÄR</div>
    <div class="popup-row"><span>Name:</span> ${escapeHtml(p.name || '-')}</div>
    <div class="popup-row"><span>Apoyo:</span> ${escapeHtml(p.apoyo || '-')}</div>
    <div class="popup-row"><span>Status:</span> ${escapeHtml(p.status || '-')}</div>
    <div class="popup-row"><span>Quelle:</span> ${escapeHtml(p.quelle || '-')}</div>
    <div class="popup-actions">
      <a class="popup-nav-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Abrir punto en Google Maps</a>
      <div class="popup-coords">Destino: ${Number(latlng.lat).toFixed(6)}, ${Number(latlng.lng).toFixed(6)}</div>
    </div>
  `;
}

function spanPopupHtml(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">VANO / SPANNFELD</div>
    <div class="popup-row"><span>Vano:</span> ${escapeHtml(p.vano || '-')}</div>
    <div class="popup-row"><span>Mast inicio:</span> ${escapeHtml(p.mast_start || '-')}</div>
    <div class="popup-row"><span>Mast final:</span> ${escapeHtml(p.mast_end || '-')}</div>
    <div class="popup-row"><span>Distancia:</span> ${escapeHtml(p.distancia_m || '-')} m</div>
    ${popupNavigationLink(latlng)}
  `;
}

function createVogelschutzIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="vogel-marker"><span>VSM</span></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function vogelschutzPopupHtml(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">VOGELSCHUTZMARKER</div>
    <div class="popup-row"><span>Baulos:</span> ${escapeHtml(p.baulos || '-')}</div>
    <div class="popup-row"><span>Leitung:</span> ${escapeHtml(p.leitungsname || '-')}</div>
    <div class="popup-row"><span>Vano:</span> ${escapeHtml(p.vano || '-')}</div>
    <div class="popup-row"><span>Longitud tabla:</span> ${escapeHtml(p.longitud_tabla_m || '-')} m</div>
    <div class="popup-row"><span>Longitud calculada:</span> ${escapeHtml(p.longitud_calc_m || '-')} m</div>
    <div class="popup-row"><span>Plano:</span> ${escapeHtml(p.plan || '-')}</div>
    <div class="popup-row"><span>PDF pág.:</span> ${escapeHtml(p.pdf_page || '-')}</div>
    ${popupNavigationLink(latlng)}
  `;
}

function erdungIconClass(props) {
  const types = String(props?.erdung_typen || '').toLowerCase();
  if (types.includes('kreuzung')) return 'erdung-marker erdung-crossing';
  if (types.includes('abspann')) return 'erdung-marker erdung-abspann';
  return 'erdung-marker erdung-rollenerde';
}

function createErdungIcon(props) {
  return L.divIcon({
    className: '',
    html: `<div class="${erdungIconClass(props)}"><span>⏚</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function erdungPopupHtml(props, latlng) {
  const p = props || {};
  const types = String(p.erdung_typen || '');
  const needsRollenerde = types.toLowerCase().includes('rolle');
  const needsAbspann = types.toLowerCase().includes('abspann');
  const rollenerdeButton = needsRollenerde
    ? `<a class="popup-plan-link" href="${ERDUNG_DOC_LINKS.rollenerde}" target="_blank" rel="noopener noreferrer">Plan Rollenerde AAA-CE0256LB</a>`
    : '';
  const abspannButton = needsAbspann
    ? `<a class="popup-plan-link" href="${ERDUNG_DOC_LINKS.abspann}" target="_blank" rel="noopener noreferrer">Datenblatt Erdung Nr. 1</a>`
    : '';
  return `
    <div class="popup-title">ERDUNGSKONZEPT</div>
    <div class="erdung-popup-diagram">
      <img src="${ERDUNG_DOC_LINKS.silhouette}" alt="Befestigungspunkte Aussenleiter" />
    </div>
    <div class="popup-plan-section">
      <div class="popup-plan-section-title">Montage Traversen I / II</div>
      <div class="popup-row"><span>Tr. I:</span> 1 Erdung nach Datenblatt Nr. 1 je Phase und 1 Laufrad je Phase.</div>
      <div class="popup-row"><span>Tr. II:</span> 1 Erdung nach Datenblatt Nr. 1 je Phase und 1 Laufrad je Phase.</div>
      <div class="popup-row"><span>Referenz:</span> Befestigungspunkte Außenleiter gemäß beigefügtem Schema.</div>
    </div>
    <div class="popup-plan-section">
      <div class="popup-plan-section-title">Temporäre Arbeitserdung</div>
      <div class="popup-row"><span>Hinweis:</span> An jedem Mast, an dem gearbeitet wird, ist je Phase eine temporäre Erdung nach Datenblatt Nr. 2 anzubringen. Diese temporäre Erdung wird nicht gesondert symbolisiert.</div>
      <div class="popup-plan-actions popup-plan-actions-compact">
        <a class="popup-plan-link" href="${ERDUNG_DOC_LINKS.temporary}" target="_blank" rel="noopener noreferrer">Datenblatt Erdung Nr. 2</a>
      </div>
    </div>
    <div class="popup-plan-section">
      <div class="popup-plan-section-title">Anwendung der Erdungen</div>
      <div class="popup-row"><span>Vorgabe:</span> Die Erdungen sind gemäß den verlinkten Anwendungsunterlagen zu montieren und zu verwenden.</div>
      <div class="popup-plan-actions popup-plan-actions-compact">
        <a class="popup-plan-link" href="${ERDUNG_DOC_LINKS.usage040250028}" target="_blank" rel="noopener noreferrer">040250028-EN-V02</a>
        <a class="popup-plan-link" href="${ERDUNG_DOC_LINKS.usageEuK}" target="_blank" rel="noopener noreferrer">040106020 EuK</a>
      </div>
    </div>
    <div class="popup-row"><span>Mast:</span> ${escapeHtml(p.apoyo || '-')}</div>
    <div class="popup-row"><span>Masttyp:</span> ${escapeHtml(p.mast_typ || '-')}</div>
    <div class="popup-row"><span>Erdung:</span> ${escapeHtml(p.erdung_typen || '-')}</div>
    <div class="popup-row"><span>Grund:</span> ${escapeHtml(p.gruende || '-')}</div>
    <div class="popup-row"><span>Seilzug:</span> ${escapeHtml(p.seilzug_abschnitt || p.abschnitt || '-')}</div>
    <div class="popup-row"><span>Kreuzungsfeld:</span> ${escapeHtml(p.crossing_vanos || '-')}</div>
    <div class="popup-row"><span>Register-Nr.:</span> ${escapeHtml(p.crossing_ids || '-')}</div>
    <div class="popup-row"><span>Beschreibung:</span> ${escapeHtml(p.crossing_details || '-')}</div>
    <div class="popup-row"><span>Besitzer / Behörde:</span> ${escapeHtml(p.besitzer || '-')}</div>
    <div class="popup-plan-actions popup-plan-actions-compact">
      ${rollenerdeButton}
      ${abspannButton}
    </div>
    <div class="popup-actions">
      <a class="popup-nav-link" href="${googleMapsDirectionsUrl(latlng)}" target="_blank" rel="noopener noreferrer">
        Route in Google Maps öffnen
      </a>
      <div class="popup-coords">Ziel: ${Number(latlng.lat).toFixed(6)}, ${Number(latlng.lng).toFixed(6)}</div>
    </div>
  `;
}

function createTowerIcon(apoyo, mastTyp, zoom) {
  const label = apoyo.replace(/^M0*/, 'M');       // M097A â†’ M97A
  const color = MAST_COLOR[mastTyp] || '#888';
  const isAbspann = mastTyp === 'Abspannmast';
  const show = zoom >= 12;
  return L.divIcon({
    className: '',
    html: show
      ? `<div class="tower-label" style="border-color:${color};color:#fff;background:rgba(15,52,96,0.92)">${label}</div>`
      : `<div class="tower-dot" style="background:${color};${isAbspann ? 'width:9px;height:9px;' : ''}"></div>`,
    iconSize: show ? [38, 18] : (isAbspann ? [9, 9] : [7, 7]),
    iconAnchor: show ? [19, 9] : (isAbspann ? [4, 4] : [3, 3]),
  });
}

// ===== GeoJSON LAYER LOADER =====
const GEO_LAYERS = {};

function loadGeoJSON(id, url, optsFn, onEachFn) {
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      GEO_LAYERS[id] = L.geoJSON(data, {
        style: optsFn,
        pointToLayer: optsFn,
        onEachFeature: onEachFn,
      });
      return GEO_LAYERS[id];
    });
}

// ===== TORRE LAYER (special handling) =====
let towerLayer = null;
let rescueLayer = null;
let warehouseLayer = null;
let toitoiLayer = null;
let spanLayer = null;
let vogelschutzLayer = null;
let erdungLayer = null;
const towerLookup = {};
const towerSuggestions = [];

function normalizeTowerQuery(value) {
  let text = String(value || '').trim().toUpperCase();
  text = text.replace(/^MAST\s*/i, '').replace(/\s+/g, '');
  if (!text) return '';
  if (!text.startsWith('M')) text = `M${text}`;
  return text.replace(/^M0+(?=\d)/, 'M');
}

function mastNumberKey(value) {
  const text = normalizeTowerQuery(value);
  const match = text.match(/\d+/);
  const number = match ? Number(match[0]) : 999999;
  const suffix = text.replace(/^M\d*/, '');
  return [number, suffix];
}

function showTowerSearchStatus(message, isError = false) {
  const el = document.querySelector('.goto-mast-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('error', Boolean(isError));
}

function refreshTowerSuggestions() {
  const list = document.getElementById('goto-mast-options');
  if (!list) return;
  const current = new Set(Array.from(list.options).map(option => option.value));
  towerSuggestions
    .filter(item => item.value && !current.has(item.value))
    .sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1].localeCompare(b.sortKey[1]))
    .forEach(item => {
      const option = document.createElement('option');
      option.value = item.value;
      option.label = item.label;
      list.appendChild(option);
      current.add(item.value);
    });
}

function goToMast(value) {
  const key = normalizeTowerQuery(value);
  if (!key) {
    showTowerSearchStatus('Introduce un apoyo', true);
    return;
  }

  const marker = towerLookup[key];
  if (!marker) {
    showTowerSearchStatus(`${key} no encontrado`, true);
    return;
  }

  const layerToggle = document.getElementById('chk-torres');
  if (towerLayer && !map.hasLayer(towerLayer)) {
    towerLayer.addTo(map);
    if (layerToggle) layerToggle.checked = true;
  }

  const latlng = marker.getLatLng();
  showTowerSearchStatus(`Zoom a ${marker._apoyo || key}`);
  map.flyTo(latlng, Math.max(map.getZoom(), 16), { duration: 0.75 });
  window.setTimeout(() => {
    marker.setIcon(createTowerIcon(marker._apoyo, marker._mastTyp, map.getZoom()));
    marker.bindPopup(towerPopupHtml(marker._featureProps || { apoyo: marker._apoyo, mast_typ: marker._mastTyp }, latlng));
    marker.openPopup();
  }, 780);
}

const GoToMastControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const container = L.DomUtil.create('div', 'leaflet-bar goto-mast-control');
    container.innerHTML = `
      <form class="goto-mast-form" autocomplete="off">
        <label for="goto-mast-input">Go To Mast:</label>
        <div class="goto-mast-row">
          <input id="goto-mast-input" type="text" inputmode="text" list="goto-mast-options" placeholder="M160" aria-label="Go To Mast" />
          <datalist id="goto-mast-options"></datalist>
          <button type="submit">OK</button>
        </div>
        <div class="goto-mast-status" aria-live="polite">Escribe o elige un apoyo</div>
      </form>
    `;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    const form = container.querySelector('form');
    const input = container.querySelector('input');
    form.addEventListener('submit', event => {
      event.preventDefault();
      goToMast(input.value);
      input.blur();
    });
    input.addEventListener('focus', () => {
      if (measureActive) {
        measureActive = false;
        map.getContainer().style.cursor = '';
        clearMeasure();
        document.querySelector('.measure-btn')?.classList.remove('active');
      }
    });
    input.addEventListener('input', () => {
      const key = normalizeTowerQuery(input.value);
      if (!key) {
        showTowerSearchStatus('Escribe o elige un apoyo');
      } else if (towerLookup[key]) {
        showTowerSearchStatus(`${key} listo`);
      } else {
        showTowerSearchStatus('Selecciona una torre de la lista', true);
      }
    });
    window.setTimeout(refreshTowerSuggestions, 0);
    return container;
  },
});

map.addControl(new GoToMastControl());

function loadTowers() {
  return fetch('data/torres_masten.geojson')
    .then(r => r.json())
    .then(data => {
      towerLayer = L.geoJSON(data, {
        pointToLayer: (feat, latlng) => {
          const apoyo   = feat.properties.apoyo    || '';
          const mastTyp = feat.properties.mast_typ || 'Tragmast';
          const m = L.marker(latlng, { icon: createTowerIcon(apoyo, mastTyp, map.getZoom()) });
          m._apoyo   = apoyo;
          m._mastTyp = mastTyp;
          m._featureProps = feat.properties;
          const key = normalizeTowerQuery(apoyo);
          if (key) {
            towerLookup[key] = m;
            towerSuggestions.push({
              value: key,
              label: `${key} - ${mastTyp}`,
              sortKey: mastNumberKey(key),
            });
            refreshTowerSuggestions();
          }
          return m;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(towerPopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });

      // Actualizar iconos al hacer zoom
      map.on('zoomend', () => {
        if (!towerLayer || !map.hasLayer(towerLayer)) return;
        const z = map.getZoom();
        towerLayer.eachLayer(m => {
          if (m._apoyo !== undefined)
            m.setIcon(createTowerIcon(m._apoyo, m._mastTyp, z));
        });
      });

      return towerLayer;
    });
}

function loadRescuePoints() {
  return fetch('data/rettungspunkte.geojson')
    .then(r => r.json())
    .then(data => {
      rescueLayer = L.geoJSON(data, {
        pane: 'rescuePane',
        pointToLayer: (feat, latlng) => {
          const marker = L.marker(latlng, {
            icon: createRescueIcon(feat.properties?.rettungspunkt),
            pane: 'rescuePane',
          });
          marker.bindTooltip(feat.properties?.rettungspunkt || 'Rettungspunkt', {
            direction: 'top',
            offset: [0, -12],
            opacity: 0.96,
          });
          return marker;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(rescuePopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return rescueLayer;
    });
}

function loadWarehouses() {
  return fetch('data/baulager.geojson')
    .then(r => r.json())
    .then(data => {
      warehouseLayer = L.geoJSON(data, {
        pane: 'warehousePane',
        pointToLayer: (feat, latlng) => {
          const marker = L.marker(latlng, {
            icon: createWarehouseIcon(feat.properties?.name),
            pane: 'warehousePane',
          });
          marker.bindTooltip(feat.properties?.name || 'Baulager', {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.96,
          });
          return marker;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(warehousePopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return warehouseLayer;
    });
}

function loadToiToi() {
  return fetch('data/toitoi.geojson')
    .then(r => r.json())
    .then(data => {
      toitoiLayer = L.geoJSON(data, {
        pane: 'toitoiPane',
        pointToLayer: (feat, latlng) => {
          const marker = L.marker(latlng, {
            icon: createToiToiIcon(),
            pane: 'toitoiPane',
          });
          marker.bindTooltip(feat.properties?.name || 'ToiToi', {
            direction: 'top',
            offset: [0, -15],
            opacity: 0.96,
          });
          return marker;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(toitoiPopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return toitoiLayer;
    });
}

function createSpanLabel(feature) {
  const p = feature.properties || {};
  if (!Number.isFinite(Number(p.mid_lat)) || !Number.isFinite(Number(p.mid_lng))) return null;
  return L.marker([Number(p.mid_lat), Number(p.mid_lng)], {
    interactive: false,
    pane: 'spanPane',
    icon: L.divIcon({
      className: 'span-distance-label',
      html: escapeHtml(p.label || ''),
      iconAnchor: [16, 6],
    }),
  });
}

function loadSpanDistances() {
  return fetch('data/vanos_distancias.geojson')
    .then(r => r.json())
    .then(data => {
      const lines = L.geoJSON(data, {
        pane: 'spanPane',
        style: () => ({
          color: '#fbbf24',
          weight: 2,
          opacity: 0.95,
          dashArray: '5 4',
        }),
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(spanPopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
          layer.on('mouseover', function() { this.setStyle({ weight: 4, opacity: 1 }); });
          layer.on('mouseout', function() { lines.resetStyle(this); });
        },
      });
      const labels = L.layerGroup(
        (data.features || []).map(createSpanLabel).filter(Boolean),
        { pane: 'spanPane' }
      );
      spanLayer = L.layerGroup([lines, labels]);
      return spanLayer;
    });
}

function loadVogelschutzMarkers() {
  return fetch('data/vogelschutzmarker_vanos.geojson')
    .then(r => r.json())
    .then(data => {
      vogelschutzLayer = L.geoJSON(data, {
        pane: 'vogelschutzPane',
        pointToLayer: (feat, latlng) => {
          const marker = L.marker(latlng, {
            icon: createVogelschutzIcon(),
            pane: 'vogelschutzPane',
          });
          marker.bindTooltip(feat.properties?.vano || 'Vogelschutzmarker', {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.96,
          });
          return marker;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(vogelschutzPopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return vogelschutzLayer;
    });
}

function loadErdungskonzept() {
  return fetch('data/erdungskonzept.geojson')
    .then(r => r.json())
    .then(data => {
      erdungLayer = L.geoJSON(data, {
        pane: 'erdungPane',
        pointToLayer: (feat, latlng) => {
          const marker = L.marker(latlng, {
            icon: createErdungIcon(feat.properties),
            pane: 'erdungPane',
          });
          marker.bindTooltip(`${feat.properties?.apoyo || 'Mast'} · ${feat.properties?.erdung_typen || 'Erdung'}`, {
            direction: 'top',
            offset: [0, -15],
            opacity: 0.96,
          });
          return marker;
        },
        onEachFeature: (feat, layer) => {
          layer.on('click', e => {
            layer.bindPopup(erdungPopupHtml(feat.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return erdungLayer;
    });
}

// ===== DATA FILE DEFINITIONS =====
const DATA_FILES = [
  { id: 'chk-buffer', url: 'data/trassenachse_gesamt_buffer_800m.geojson',
    style: () => ({ color: '#e63030', fillColor: '#e63030', weight: 1.5, fillOpacity: 0.08, dashArray: '6 4' }),
    pointToLayer: null, checked: true },
  { id: 'chk-eje', url: 'data/trassenachse_gesamt.geojson',
    style: () => ({ color: '#e63030', weight: 3 }),
    pointToLayer: null, checked: true },
  { id: 'chk-weg-best',  url: 'data/wbk_weg_best.geojson',  style: () => styleFor('wbk_weg_best'),       checked: true },
  { id: 'chk-weg-temp',  url: 'data/wbk_weg_temp.geojson',  style: () => styleFor('wbk_weg_temp'),       checked: true },
  { id: 'chk-arbeit',    url: 'data/wbk_arbeitsflaeche.geojson', style: () => styleFor('wbk_arbeitsflaeche'), checked: true },
  { id: 'chk-geruest',   url: 'data/wbk_geruest.geojson',   style: () => styleFor('wbk_geruest'),        checked: true },
  { id: 'chk-ausholz',   url: 'data/wbk_ausholzung.geojson',style: () => styleFor('wbk_ausholzung'),     checked: true },
  { id: 'chk-schutz',    url: 'data/wbk_schutznetz.geojson',style: () => styleFor('wbk_schutznetz'),     checked: true },
  { id: 'chk-sperr',     url: 'data/wbk_sperrung.geojson',  style: () => styleFor('wbk_sperrung'),       checked: true },
];

// ===== LOAD ALL =====
let bounds = null;

const geoPromises = DATA_FILES.map(def =>
  fetch(def.url).then(r => r.json()).then(data => {
    const gl = L.geoJSON(data, {
      style: def.style || (() => ({})),
      pointToLayer: (feat, latlng) =>
        L.circleMarker(latlng, { radius: 5, color: '#e63030', fillColor: '#ff6060', weight: 1, fillOpacity: 0.9 }),
      onEachFeature: (feat, layer) => {
        const lname = def.url.split('/').pop().replace('.geojson', '');
        layer.on('click', e => {
          layer.bindPopup(
            `<div class="popup-title">${lname.toUpperCase().replace(/_/g,' ')}</div>
             ${Object.entries(feat.properties || {}).map(([k,v]) =>
               `<div class="popup-row"><span>${escapeHtml(k)}:</span> ${escapeHtml(v ?? '-')}</div>`).join('')}
             ${popupNavigationLink(e.latlng)}`
          );
          layer.openPopup(e.latlng);
        });
        if (layer.setStyle) {
          layer.on('mouseover', function() { this.setStyle({ weight: 4, opacity: 1 }); });
          layer.on('mouseout',  function() { gl.resetStyle(this); });
        }
      },
    });
    GEO_LAYERS[def.id] = gl;
    if (def.checked) {
      gl.addTo(map);
      const b = gl.getBounds();
      if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
    }
    const el = document.getElementById(def.id);
    if (el) el.addEventListener('change', e => {
      if (e.target.checked) gl.addTo(map);
      else map.removeLayer(gl);
    });
    return gl;
  })
);

const towerPromise = loadTowers().then(gl => {
  GEO_LAYERS['chk-torres'] = gl;
  gl.addTo(map);
  const el = document.getElementById('chk-torres');
  if (el) el.addEventListener('change', e => {
    if (e.target.checked) gl.addTo(map);
    else map.removeLayer(gl);
  });
  return gl;
});

const rescuePromise = loadRescuePoints().then(gl => {
  GEO_LAYERS['chk-rettung'] = gl;
  gl.addTo(map);
  const b = gl.getBounds();
  if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  const el = document.getElementById('chk-rettung');
  if (el) el.addEventListener('change', e => {
    if (e.target.checked) gl.addTo(map);
    else map.removeLayer(gl);
  });
  return gl;
});

const warehousePromise = loadWarehouses().then(gl => {
  GEO_LAYERS['chk-baulager'] = gl;
  gl.addTo(map);
  const b = gl.getBounds();
  if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  const el = document.getElementById('chk-baulager');
  if (el) el.addEventListener('change', e => {
    if (e.target.checked) gl.addTo(map);
    else map.removeLayer(gl);
  });
  return gl;
});

const toitoiPromise = loadToiToi().then(gl => {
  GEO_LAYERS['chk-toitoi'] = gl;
  gl.addTo(map);
  const b = gl.getBounds();
  if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  const el = document.getElementById('chk-toitoi');
  if (el) el.addEventListener('change', e => {
    if (e.target.checked) gl.addTo(map);
    else map.removeLayer(gl);
  });
  return gl;
});

const spanPromise = loadSpanDistances().then(gl => {
  GEO_LAYERS['chk-vanos'] = gl;
  const el = document.getElementById('chk-vanos');
  if (el) {
    if (el.checked) gl.addTo(map);
    el.addEventListener('change', e => {
      if (e.target.checked) gl.addTo(map);
      else map.removeLayer(gl);
    });
  }
  return gl;
});

const vogelschutzPromise = loadVogelschutzMarkers().then(gl => {
  GEO_LAYERS['chk-vogelschutz'] = gl;
  const el = document.getElementById('chk-vogelschutz');
  if (el) {
    if (el.checked) gl.addTo(map);
    const b = gl.getBounds();
    if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
    el.addEventListener('change', e => {
      if (e.target.checked) gl.addTo(map);
      else map.removeLayer(gl);
    });
  }
  return gl;
});

const erdungPromise = loadErdungskonzept().then(gl => {
  GEO_LAYERS['chk-erdung'] = gl;
  const el = document.getElementById('chk-erdung');
  if (el) {
    if (el.checked) gl.addTo(map);
    const b = gl.getBounds();
    if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
    el.addEventListener('change', e => {
      if (e.target.checked) gl.addTo(map);
      else map.removeLayer(gl);
    });
  }
  return gl;
});

Promise.all([...geoPromises, towerPromise, rescuePromise, warehousePromise, toitoiPromise, spanPromise, vogelschutzPromise, erdungPromise]).then(() => {
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  document.getElementById('loading-overlay').classList.add('hidden');
  loadDefaultDeferredLayers();
}).catch(err => {
  console.error('Error cargando datos:', err);
  document.getElementById('loading-overlay').classList.add('hidden');
  loadDefaultDeferredLayers();
});

// ===== STATUS GENEHMIGUNG =====
let statusGenehmigungLayer = null;
let statusGenehmigungPromise = null;
const statusGenehmigungRenderer = L.svg({ padding: 0.5, pane: 'statusGenehmigungPane' });

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusGenehmigungStyle(feature) {
  const status = feature.properties?.status_genehmigung;
  if (status === 'genehmigt') {
    return { color: '#0f7a38', weight: 1.6, opacity: 0.95, fillColor: '#22aa55', fillOpacity: 0.42 };
  }
  if (status === 'nicht_informiert') {
    return { color: '#b71c1c', weight: 1.6, opacity: 0.95, fillColor: '#e53935', fillOpacity: 0.42 };
  }
  return { color: '#b8860b', weight: 1.4, opacity: 0.9, fillColor: '#f6c343', fillOpacity: 0.32 };
}

function statusGenehmigungHoverStyle(feature) {
  const base = statusGenehmigungStyle(feature);
  return { ...base, weight: 3, opacity: 1, fillOpacity: Math.min((base.fillOpacity || 0.35) + 0.18, 0.62) };
}

function statusGenehmigungTooltip(props) {
  const p = props || {};
  return `
    <strong>${escapeHtml(p.status_label || 'STATUS')}</strong><br>
    ${escapeHtml(p.gemarkung || 'â€”')} Â· Flur ${escapeHtml(p.flur || 'â€”')} Â· ${escapeHtml(p.flurstueck || 'â€”')}<br>
    ${escapeHtml(p.eigentuemer || 'Sin propietario')}
  `;
}

function statusGenehmigungPopup(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">STATUS GENEHMIGUNG</div>
    <div class="popup-row"><span>Status:</span> ${escapeHtml(p.status_label || 'â€”')}</div>
    <div class="popup-row"><span>Gemarkung:</span> ${escapeHtml(p.gemarkung || 'â€”')}</div>
    <div class="popup-row"><span>Flur:</span> ${escapeHtml(p.flur || 'â€”')}</div>
    <div class="popup-row"><span>FlurstÃ¼ck:</span> ${escapeHtml(p.flurstueck || p.flstkennz || 'â€”')}</div>
    <div class="popup-row"><span>Gemeinde:</span> ${escapeHtml(p.gemeinde || 'â€”')}</div>
    <div class="popup-row"><span>Kreis:</span> ${escapeHtml(p.kreis || 'â€”')}</div>
    <div class="popup-row"><span>ALKIS aktualit.:</span> ${escapeHtml(p.aktualit || 'â€”')}</div>
    <div class="popup-row"><span>Baulos:</span> ${escapeHtml(p.baulos || 'â€”')}</div>
    <div class="popup-row"><span>Masten:</span> ${escapeHtml(p.masten || 'â€”')}</div>
    <div class="popup-row"><span>Eigentuemer:</span> ${escapeHtml(p.eigentuemer || 'â€”')}</div>
    <div class="popup-row"><span>Nombre:</span> ${escapeHtml(p.vorname || 'â€”')}</div>
    <div class="popup-row"><span>Apellido:</span> ${escapeHtml(p.nachname || 'â€”')}</div>
    <div class="popup-row"><span>Correo:</span> ${escapeHtml(p.email || 'â€”')}</div>
    <div class="popup-row"><span>Telefono:</span> ${escapeHtml(p.telefon || 'â€”')}</div>
    <div class="popup-row"><span>Info fechas:</span> ${escapeHtml(p.info_daten || 'â€”')}</div>
    <div class="popup-row"><span>Bemerkung:</span> ${escapeHtml(p.bemerkung || 'â€”')}</div>
    ${popupNavigationLink(latlng)}
  `;
}

function loadStatusGenehmigungLayer() {
  if (statusGenehmigungPromise) return statusGenehmigungPromise;

  statusGenehmigungPromise = fetch('data/status_genehmigung.geojson')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      statusGenehmigungLayer = L.geoJSON(data, {
        attribution: 'Status Genehmigung: 04_PERMITS / ALKIS WFS',
        renderer: statusGenehmigungRenderer,
        style: statusGenehmigungStyle,
        onEachFeature: (feature, layer) => {
          layer.bindPopup(statusGenehmigungPopup(feature.properties));
          layer.bindTooltip(statusGenehmigungTooltip(feature.properties), {
            sticky: true,
            direction: 'top',
            className: 'status-genehmigung-tooltip',
            opacity: 0.96,
          });
          layer.on({
            click: e => {
              layer.bindPopup(statusGenehmigungPopup(feature.properties, e.latlng));
              layer.openPopup(e.latlng);
            },
            mouseover: () => {
              layer.setStyle(statusGenehmigungHoverStyle(feature));
              layer.bringToFront();
            },
            mouseout: () => {
              statusGenehmigungLayer?.resetStyle(layer);
            },
            contextmenu: e => {
              L.DomEvent.preventDefault(e.originalEvent);
              layer.bindPopup(statusGenehmigungPopup(feature.properties, e.latlng));
              layer.openPopup(e.latlng);
            },
          });
        },
      });
      return statusGenehmigungLayer;
    })
    .catch(err => {
      statusGenehmigungPromise = null;
      console.error('Error cargando STATUS GENEHMIGUNG:', err);
      window.alert('No se pudo cargar data/status_genehmigung.geojson.');
      throw err;
    });

  return statusGenehmigungPromise;
}

const statusGenehmigungToggle = document.getElementById('chk-status-genehmigung');
if (statusGenehmigungToggle) {
  statusGenehmigungToggle.addEventListener('change', e => {
    if (e.target.checked) {
      loadStatusGenehmigungLayer().then(layer => layer.addTo(map).bringToFront());
    } else if (statusGenehmigungLayer) {
      map.removeLayer(statusGenehmigungLayer);
    }
  });

  if (statusGenehmigungToggle.checked) {
    loadStatusGenehmigungLayer().then(layer => layer.addTo(map).bringToFront());
  }
}

let defaultDeferredLayersStarted = false;

function scheduleDeferredLayerLoad(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 2500 });
  } else {
    window.setTimeout(callback, 600);
  }
}

function loadDefaultDeferredLayers() {
  if (defaultDeferredLayersStarted) return;
  defaultDeferredLayersStarted = true;
  scheduleDeferredLayerLoad(() => {
    syncCatastroVisibility();
  });
}

// ===== CATASTRO WFS VECTOR =====
let catastroLayer = null;
let catastroPromise = null;
let catastroLabelData = [];
const catastroRenderer = L.canvas({ padding: 0.5, pane: 'catastroPane' });
const catastroLabelLayer = L.layerGroup();
const CATASTRO_LOAD_MIN_ZOOM = 15;
const CATASTRO_LABEL_MIN_ZOOM = 16;

function getFeatureLabelLatLng(feature) {
  const bounds = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity };

  function scan(coords) {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        bounds.minLng = Math.min(bounds.minLng, lng);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLng = Math.max(bounds.maxLng, lng);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
      }
      return;
    }
    coords.forEach(scan);
  }

  scan(feature.geometry?.coordinates);
  if (!Number.isFinite(bounds.minLng)) return null;
  return L.latLng((bounds.minLat + bounds.maxLat) / 2, (bounds.minLng + bounds.maxLng) / 2);
}

function updateCatastroLabels() {
  catastroLabelLayer.clearLayers();
  if (!catastroLayer || !map.hasLayer(catastroLayer) || map.getZoom() < CATASTRO_LABEL_MIN_ZOOM) return;

  const viewBounds = map.getBounds().pad(0.08);
  const visibleLabels = catastroLabelData.filter(item => viewBounds.contains(item.latlng));
  visibleLabels.forEach(item => {
    L.marker(item.latlng, {
      interactive: false,
      icon: L.divIcon({
        className: 'catastro-parcel-label',
        html: item.label,
        iconAnchor: [10, 6],
      }),
    }).addTo(catastroLabelLayer);
  });
}

function catastroPopup(props, latlng) {
  const p = props || {};
  return `
    <div class="popup-title">ALKIS Flurstueck</div>
    <div class="popup-row"><span>Flurstueck:</span> ${escapeHtml(p.flurstueck || 'â€”')}</div>
    <div class="popup-row"><span>Kennzeichen:</span> ${escapeHtml(p.flstkennz || 'â€”')}</div>
    <div class="popup-row"><span>Gemarkung:</span> ${escapeHtml(p.gemarkung || 'â€”')}</div>
    <div class="popup-row"><span>Flur:</span> ${escapeHtml(p.flur || 'â€”')}</div>
    <div class="popup-row"><span>Gemeinde:</span> ${escapeHtml(p.gemeinde || 'â€”')}</div>
    <div class="popup-row"><span>Kreis:</span> ${escapeHtml(p.kreis || 'â€”')}</div>
    <div class="popup-row"><span>Aktualitaet:</span> ${escapeHtml(p.aktualit || 'â€”')}</div>
    <div class="popup-row"><span>OID:</span> ${escapeHtml(p.oid || 'â€”')}</div>
    ${popupNavigationLink(latlng)}
  `;
}

function loadCatastroWfsLayer() {
  if (catastroPromise) return catastroPromise;

  catastroPromise = fetch('data/catastro_flurstueck.geojson')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      catastroLabelData = data.features
        .map(feature => ({
          latlng: getFeatureLabelLatLng(feature),
          label: feature.properties?.flurstueck || feature.properties?.flstkennz || '',
        }))
        .filter(item => item.latlng && item.label);

      catastroLayer = L.geoJSON(data, {
        attribution: 'Â© GeoBasis-DE/LVermGeo SH/CC BY 4.0',
        renderer: catastroRenderer,
        style: () => ({
          color: '#00c8ff',
          weight: 1.1,
          opacity: 0.95,
          fill: false,
          fillOpacity: 0,
        }),
        onEachFeature: (feature, layer) => {
          layer.bindPopup(catastroPopup(feature.properties));
          layer.on('click', e => {
            layer.bindPopup(catastroPopup(feature.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
          layer.on('contextmenu', e => {
            L.DomEvent.preventDefault(e.originalEvent);
            layer.bindPopup(catastroPopup(feature.properties, e.latlng));
            layer.openPopup(e.latlng);
          });
        },
      });
      return catastroLayer;
    })
    .catch(err => {
      catastroPromise = null;
      console.error('Error cargando catastro WFS local:', err);
      window.alert('No se pudo cargar data/catastro_flurstueck.geojson. Genera primero la capa WFS local.');
      throw err;
    });

  return catastroPromise;
}

function hideCatastroLayer() {
  if (catastroLayer && map.hasLayer(catastroLayer)) map.removeLayer(catastroLayer);
  if (map.hasLayer(catastroLabelLayer)) map.removeLayer(catastroLabelLayer);
  catastroLabelLayer.clearLayers();
}

function syncCatastroVisibility() {
  if (!catastroToggle?.checked || map.getZoom() < CATASTRO_LOAD_MIN_ZOOM) {
    hideCatastroLayer();
    return;
  }

  loadCatastroWfsLayer().then(layer => {
    if (!catastroToggle?.checked || map.getZoom() < CATASTRO_LOAD_MIN_ZOOM) {
      hideCatastroLayer();
      return;
    }
    if (!map.hasLayer(layer)) layer.addTo(map);
    if (!map.hasLayer(catastroLabelLayer)) catastroLabelLayer.addTo(map);
    updateCatastroLabels();
    if (statusGenehmigungLayer && map.hasLayer(statusGenehmigungLayer)) statusGenehmigungLayer.bringToFront();
  });
}

const catastroToggle = document.getElementById('chk-catastro');
if (catastroToggle) {
  catastroToggle.addEventListener('change', e => {
    if (e.target.checked) {
      syncCatastroVisibility();
    } else {
      hideCatastroLayer();
    }
  });

  // Autoload is deferred until the base project layers are visible.
}

map.on('zoomend moveend', () => {
  syncCatastroVisibility();
  updateCatastroLabels();
});

// ===== WMS CHECKBOXES =====
Object.keys(WMS_LAYERS).forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', e => {
    if (e.target.checked) WMS_LAYERS[id].addTo(map);
    else map.removeLayer(WMS_LAYERS[id]);
  });
});

// ===== BASEMAP SWITCHER =====
let currentBasemap = 'satellite';

window.setBasemap = function(key, btn) {
  if (!BASEMAPS[key]) return;
  map.removeLayer(BASEMAPS[currentBasemap]);
  BASEMAPS[key].addTo(map);
  BASEMAPS[key].bringToBack();
  currentBasemap = key;
  document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

// ===== SIDEBAR MOBILE =====
window.toggleSidebar = function() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const btnToggle = document.getElementById('btn-menu-toggle');
  const isOpen = sidebar.classList.toggle('open');
  if (backdrop)  backdrop.classList.toggle('visible', isOpen);
  if (btnToggle) btnToggle.textContent = isOpen ? 'âœ•' : 'â˜°';
};
