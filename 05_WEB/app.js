'use strict';

// ===== BASEMAPS =====
const BASEMAPS = {
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri World Imagery', maxZoom: 19 }
  ),
  topo: L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenTopoMap', maxZoom: 17 }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
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

map.on('mousemove', e => {
  // Línea elástica mientras se elige el segundo punto
  if (measureActive && measurePts.length === 1) {
    if (!measureRubber) {
      measureRubber = L.polyline([measurePts[0], e.latlng], {
        color: '#ff7700', weight: 2, dashArray: '6 4', opacity: 0.8,
      }).addTo(map);
    } else {
      measureRubber.setLatLngs([measurePts[0], e.latlng]);
    }
  }
  document.getElementById('coords-bar').textContent =
    `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
});

map.on('click', e => {
  if (!measureActive) return;

  // Tercer clic: reiniciar medición anterior
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
      el.textContent = `📏 ${label}`;
      el.classList.remove('hidden');
    }
  }
});

// ===== WMS LAYERS =====
// Fuentes verificadas:
//   BfN   → geodienste.bfn.de  (Bundesamt für Naturschutz, nacional)
//   BKG   → sgx.geodatenzentrum.de  (Bundesamt für Kartographie, nacional)
//   GDI-SH → dienste.gdi-sh.de  (Geodateninfrastruktur Schleswig-Holstein)
const WMS_LAYERS = {};

const BFN  = 'https://geodienste.bfn.de/ogc/wms/schutzgebiet';

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

// Naturschutz (BfN nacional — funciona en toda Alemania)
WMS_LAYERS['chk-naturschutz'] = createWmsLayer(BFN, {
  layers: 'Naturschutzgebiete',
  attribution: '© BfN – Naturschutzgebiete', opacity: 0.55,
});

// FFH (BfN)
WMS_LAYERS['chk-ffh'] = createWmsLayer(BFN, {
  layers: 'Fauna_Flora_Habitat_Gebiete',
  attribution: '© BfN – FFH-Gebiete', opacity: 0.5,
});

// Vogelschutz SPA (BfN)
WMS_LAYERS['chk-vogel'] = createWmsLayer(BFN, {
  layers: 'Vogelschutzgebiete',
  attribution: '© BfN – Vogelschutzgebiete', opacity: 0.5,
});

// Landschaftsschutz (BfN)
WMS_LAYERS['chk-landschaft'] = createWmsLayer(BFN, {
  layers: 'Landschaftsschutzgebiete',
  attribution: '© BfN – Landschaftsschutz', opacity: 0.45,
});

// Biotopkataster (BfN — Biotoptypen bundesweit)
WMS_LAYERS['chk-biotop'] = createWmsLayer(BFN, {
  layers: 'biotoptyp',
  attribution: '© BfN – Biotoptypen', opacity: 0.55,
});

// Gewässer / Hydrographie — BKG Gewässernetz
WMS_LAYERS['chk-hydro'] = createWmsLayer(
  'https://sgx.geodatenzentrum.de/wms_gewaessernetz', {
  layers: 'gewaessernetz',
  attribution: '© BKG – Gewässernetz', opacity: 0.7,
});

// Überschwemmungsgebiete HQ100 — GDI-SH HWRM
WMS_LAYERS['chk-hq100'] = createWmsLayer(
  'https://dienste.gdi-sh.de/WMS_SH_HWRM_RL', {
  layers: 'Ueberschwemmungsgebiete_HQ100',
  attribution: '© GDI-SH – Überschwemmungsgebiete HQ100', opacity: 0.6,
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
// mast_typ: "Abspannmast" → rojo #e63030 | "Tragmast" → azul #3a7bd5
const MAST_COLOR = {
  'Abspannmast': '#e63030',
  'Tragmast':    '#3a7bd5',
};

const TOWER_CHAIN_TYPES = {};

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

function createTowerIcon(apoyo, mastTyp, zoom) {
  const label = apoyo.replace(/^M0*/, 'M');       // M097A → M97A
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
          return m;
        },
        onEachFeature: (feat, layer) => {
          const p     = feat.properties;
          const label = (p.apoyo || '').replace(/^M0*/, 'M');
          const color = MAST_COLOR[p.mast_typ] || '#888';
          const chainHtml = formatTowerChains(p.apoyo);
          layer.bindPopup(
            `<div class="popup-title" style="color:${color}">${label}</div>
             <div class="popup-row"><span>Tipo:</span> ${p.mast_typ || '—'}</div>
             <div class="popup-row"><span>Cadenas:</span> ${chainHtml}</div>`
          );
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
        layer.on('click', () =>
          layer.bindPopup(
            `<div class="popup-title">${lname.toUpperCase().replace(/_/g,' ')}</div>
             ${Object.entries(feat.properties || {}).map(([k,v]) =>
               `<div class="popup-row"><span>${k}:</span> ${v ?? '—'}</div>`).join('')}`
          ).openPopup()
        );
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

Promise.all([...geoPromises, towerPromise]).then(() => {
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  document.getElementById('loading-overlay').classList.add('hidden');
}).catch(err => {
  console.error('Error cargando datos:', err);
  document.getElementById('loading-overlay').classList.add('hidden');
});

// ===== CATASTRO WFS VECTOR =====
let catastroLayer = null;
let catastroPromise = null;
let catastroLabelData = [];
const catastroRenderer = L.canvas({ padding: 0.5 });
const catastroLabelLayer = L.layerGroup();
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
        attribution: '© GeoBasis-DE/LVermGeo SH/CC BY 4.0',
        renderer: catastroRenderer,
        style: () => ({
          color: '#00c8ff',
          weight: 1.1,
          opacity: 0.95,
          fill: false,
          fillOpacity: 0,
        }),
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          const parcelNumber = p.flurstueck || p.flstkennz || '';
          layer.bindPopup(
            `<div class="popup-title">Flurstück</div>
             <div class="popup-row"><span>Gemarkung:</span> ${p.gemarkung || '—'}</div>
             <div class="popup-row"><span>Flur:</span> ${p.flur || '—'}</div>
             <div class="popup-row"><span>Nr.:</span> ${p.flurstueck || p.flstkennz || '—'}</div>`
          );
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

const catastroToggle = document.getElementById('chk-catastro');
if (catastroToggle) {
  catastroToggle.addEventListener('change', e => {
    if (e.target.checked) {
      loadCatastroWfsLayer().then(layer => {
        layer.addTo(map).bringToFront();
        catastroLabelLayer.addTo(map);
        updateCatastroLabels();
      });
    } else if (catastroLayer) {
      map.removeLayer(catastroLayer);
      map.removeLayer(catastroLabelLayer);
      catastroLabelLayer.clearLayers();
    }
  });
}

map.on('zoomend moveend', updateCatastroLabels);

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
  if (btnToggle) btnToggle.textContent = isOpen ? '✕' : '☰';
};
