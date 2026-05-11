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

map.on('mousemove', e => {
  document.getElementById('coords-bar').textContent =
    `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
});

// ===== WMS LAYERS =====
const WMS_LAYERS = {};

WMS_LAYERS['chk-catastro'] = L.tileLayer.wms(
  'https://service.gdi.nrw.de/wms/alkis_basis',
  { layers: 'adv_alkis_basis', format: 'image/png', transparent: true,
    attribution: 'GDI-SH Kataster', opacity: 0.7 }
);
WMS_LAYERS['chk-naturschutz'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'nsg', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – NSG', opacity: 0.6 }
);
WMS_LAYERS['chk-ffh'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'ffh_gebiete', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – FFH', opacity: 0.6 }
);
WMS_LAYERS['chk-vogel'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'eu_vogelschutzgebiete', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – Vogelschutz', opacity: 0.6 }
);
WMS_LAYERS['chk-landschaft'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'lsg', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – LSG', opacity: 0.6 }
);
WMS_LAYERS['chk-biotop'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'biotoptypen_sh', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – Biotope', opacity: 0.65 }
);
WMS_LAYERS['chk-hydro'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/lkn/wms',
  { layers: 'gewaesser', format: 'image/png', transparent: true,
    attribution: 'LKN SH – Gewässer', opacity: 0.7 }
);
WMS_LAYERS['chk-hq100'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/lkn/wms',
  { layers: 'ueberschwemmungsgebiete', format: 'image/png', transparent: true,
    attribution: 'LKN SH – Überschwemmung', opacity: 0.65 }
);

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

// ===== TORRE MARKER (con número visible) =====
function createTowerIcon(num, zoom) {
  const show = zoom >= 12;
  return L.divIcon({
    className: '',
    html: show
      ? `<div class="tower-label">${num}</div>`
      : `<div class="tower-dot"></div>`,
    iconSize: show ? [28, 18] : [8, 8],
    iconAnchor: show ? [14, 9] : [4, 4],
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
          const num = feat.properties.torre;
          const m = L.marker(latlng, { icon: createTowerIcon(num, map.getZoom()) });
          m._towerNum = num;
          return m;
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties;
          layer.bindPopup(
            `<div class="popup-title">Mast M${p.torre}</div>
             <div class="popup-row"><span>Número:</span> ${p.nombre}</div>
             <div class="popup-row"><span>Info:</span> ${p.descripcion || '—'}</div>`
          );
        },
      });

      // Actualizar iconos al hacer zoom
      map.on('zoomend', () => {
        if (!towerLayer || !map.hasLayer(towerLayer)) return;
        const z = map.getZoom();
        towerLayer.eachLayer(m => {
          if (m._towerNum !== undefined)
            m.setIcon(createTowerIcon(m._towerNum, z));
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
  { id: 'chk-geruest',   url: 'data/wbk_geruest.geojson',   style: () => styleFor('wbk_geruest'),        checked: false },
  { id: 'chk-ausholz',   url: 'data/wbk_ausholzung.geojson',style: () => styleFor('wbk_ausholzung'),     checked: false },
  { id: 'chk-schutz',    url: 'data/wbk_schutznetz.geojson',style: () => styleFor('wbk_schutznetz'),     checked: false },
  { id: 'chk-sperr',     url: 'data/wbk_sperrung.geojson',  style: () => styleFor('wbk_sperrung'),       checked: false },
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

window.setBasemap = function(key) {
  if (!BASEMAPS[key]) return;
  map.removeLayer(BASEMAPS[currentBasemap]);
  BASEMAPS[key].addTo(map);
  BASEMAPS[key].bringToBack();
  currentBasemap = key;
  document.querySelectorAll('.basemap-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
};

// ===== SIDEBAR MOBILE =====
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

map.on('click', () => {
  if (window.innerWidth <= 768)
    document.getElementById('sidebar').classList.remove('open');
});

// ===== CHECKBOX HELPER =====
window.toggleCheck = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !el.checked;
  el.dispatchEvent(new Event('change'));
};
