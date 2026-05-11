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
const GDISH = 'https://service.gdi-sh.de/WMS_SH_ALKIS_OpenGBD';
const ALKIS_WFS = 'https://service.gdi-sh.de/WFS_SH_ALKIS_vereinf_OpenGBD';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

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

function createCatastroVectorLayer() {
  const layer = L.geoJSON(null, {
    style: () => ({
      color: '#7fd0ff',
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0,
    }),
    onEachFeature: (feature, leafletLayer) => {
      const p = feature.properties || {};
      leafletLayer.bindPopup(
        `<div class="popup-title">Katasterbezirk</div>
         <div class="popup-row"><span>Gemarkung:</span> ${p.gemarkung || '—'}</div>
         <div class="popup-row"><span>Flur:</span> ${p.flur || '—'}</div>`
      );
    },
  });

  layer._loading = false;
  layer._pendingRefresh = false;
  layer._lastKey = null;

  layer.refreshData = async function refreshData() {
    if (!map.hasLayer(layer) || map.getZoom() < 14) {
      layer.clearLayers();
      return;
    }

    if (layer._loading) {
      layer._pendingRefresh = true;
      return;
    }

    const bounds = map.getBounds().pad(0.2);
    const sw25832 = proj4('EPSG:4326', 'EPSG:25832', [bounds.getWest(), bounds.getSouth()]);
    const ne25832 = proj4('EPSG:4326', 'EPSG:25832', [bounds.getEast(), bounds.getNorth()]);
    const bboxKey = [sw25832[0], sw25832[1], ne25832[0], ne25832[1]].map(v => v.toFixed(0)).join(':');

    if (bboxKey === layer._lastKey) return;

    layer._loading = true;
    layer._lastKey = bboxKey;

    try {
      const params = new URLSearchParams({
        service: 'wfs',
        version: '2.0.0',
        request: 'GetFeature',
        storedquery_id: 'http://repository.gdi-de.org/query/adv/produkt/alkis-vereinfacht/2.0/ave-by-bbox',
        CRS: 'urn:ogc:def:crs:EPSG::25832',
        x1: sw25832[0].toString(),
        y1: sw25832[1].toString(),
        x2: ne25832[0].toString(),
        y2: ne25832[1].toString(),
      });

      const response = await fetch(`${ALKIS_WFS}?${params.toString()}`);
      const xmlText = await response.text();
      const geojson = parseKatasterbezirkGml(xmlText);
      layer.clearLayers();
      layer.addData(geojson);
    } catch (err) {
      console.error('Error cargando catastro vectorial:', err);
    } finally {
      layer._loading = false;
      if (layer._pendingRefresh) {
        layer._pendingRefresh = false;
        layer._lastKey = null;
        layer.refreshData();
      }
    }
  };

  return layer;
}

function parseKatasterbezirkGml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const features = [];
  const katasterNodes = Array.from(xml.getElementsByTagNameNS('*', 'KatasterBezirk'));

  katasterNodes.forEach(node => {
    const polygons = [];
    const polygonNodes = Array.from(node.getElementsByTagNameNS('*', 'Polygon'));

    polygonNodes.forEach(polyNode => {
      const exterior = polyNode.getElementsByTagNameNS('*', 'exterior')[0];
      if (!exterior) return;

      const rings = [];
      const exteriorPos = exterior.getElementsByTagNameNS('*', 'posList')[0];
      const outerRing = posListToLatLngRing(exteriorPos?.textContent || '');
      if (!outerRing.length) return;
      rings.push(outerRing);

      const interiorNodes = Array.from(polyNode.getElementsByTagNameNS('*', 'interior'));
      interiorNodes.forEach(interior => {
        const pos = interior.getElementsByTagNameNS('*', 'posList')[0];
        const ring = posListToLatLngRing(pos?.textContent || '');
        if (ring.length) rings.push(ring);
      });

      polygons.push(rings);
    });

    if (!polygons.length) return;

    const properties = {
      gemarkung: readXmlValue(node, 'gemarkung'),
      flur: readXmlValue(node, 'flur'),
      kreis: readXmlValue(node, 'kreis'),
      gemeinde: readXmlValue(node, 'gemeinde'),
    };

    features.push({
      type: 'Feature',
      properties,
      geometry: {
        type: polygons.length === 1 ? 'Polygon' : 'MultiPolygon',
        coordinates: polygons.length === 1 ? polygons[0] : polygons,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

function posListToLatLngRing(posListText) {
  if (!posListText) return [];
  const values = posListText.trim().split(/\s+/).map(Number);
  const ring = [];

  for (let i = 0; i < values.length - 1; i += 2) {
    const x = values[i];
    const y = values[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const [lng, lat] = proj4('EPSG:25832', 'EPSG:4326', [x, y]);
    ring.push([lng, lat]);
  }

  return ring;
}

function readXmlValue(node, localName) {
  const el = node.getElementsByTagNameNS('*', localName)[0];
  return el ? el.textContent.trim() : '';
}

const catastroVectorLayer = createCatastroVectorLayer();

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
          layer.bindPopup(
            `<div class="popup-title" style="color:${color}">${label}</div>
             <div class="popup-row"><span>Tipo:</span> ${p.mast_typ || '—'}</div>
             <div class="popup-row"><span>Info:</span> ${p.descripcion || '—'}</div>`
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

// ===== CATASTRO VECTOR =====
const catastroToggle = document.getElementById('chk-catastro');
if (catastroToggle) {
  catastroToggle.addEventListener('change', e => {
    if (e.target.checked) {
      catastroVectorLayer.addTo(map);
      catastroVectorLayer._lastKey = null;
      catastroVectorLayer.refreshData();
    } else {
      map.removeLayer(catastroVectorLayer);
      catastroVectorLayer.clearLayers();
      catastroVectorLayer._lastKey = null;
    }
  });
}

map.on('moveend zoomend', () => {
  if (catastroToggle?.checked) catastroVectorLayer.refreshData();
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
  if (btnToggle) btnToggle.textContent = isOpen ? '✕' : '☰';
};
