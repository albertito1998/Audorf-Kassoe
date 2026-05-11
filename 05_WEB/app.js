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

// Coords bar
map.on('mousemove', e => {
  document.getElementById('coords-bar').textContent =
    `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
});

// ===== WMS LAYERS =====
const WMS_LAYERS = {};

// Kataster Schleswig-Holstein
WMS_LAYERS['chk-catastro'] = L.tileLayer.wms(
  'https://service.gdi.nrw.de/wms/alkis_basis',
  { layers: 'adv_alkis_basis', format: 'image/png', transparent: true,
    attribution: 'GDI-SH Kataster', opacity: 0.7 }
);

// Naturschutz SH (LLUR)
WMS_LAYERS['chk-naturschutz'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'nsg', format: 'image/png', transparent: true,
    attribution: 'LLUR Schleswig-Holstein', opacity: 0.6 }
);

// FFH
WMS_LAYERS['chk-ffh'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'ffh_gebiete', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – FFH', opacity: 0.6 }
);

// Vogelschutz (SPA)
WMS_LAYERS['chk-vogel'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'eu_vogelschutzgebiete', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – Vogelschutz', opacity: 0.6 }
);

// Landschaftsschutz
WMS_LAYERS['chk-landschaft'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'lsg', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – LSG', opacity: 0.6 }
);

// Biotopkataster
WMS_LAYERS['chk-biotop'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/llur/wms',
  { layers: 'biotoptypen_sh', format: 'image/png', transparent: true,
    attribution: 'LLUR SH – Biotope', opacity: 0.65 }
);

// Gewässer / Hydrographie
WMS_LAYERS['chk-hydro'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/lkn/wms',
  { layers: 'gewaesser', format: 'image/png', transparent: true,
    attribution: 'LKN SH – Gewässer', opacity: 0.7 }
);

// Überschwemmungsgebiete HQ100
WMS_LAYERS['chk-hq100'] = L.tileLayer.wms(
  'https://opendata.schleswig-holstein.de/geoserver/lkn/wms',
  { layers: 'ueberschwemmungsgebiete', format: 'image/png', transparent: true,
    attribution: 'LKN SH – Überschwemmung', opacity: 0.65 }
);

// ===== STYLE HELPERS =====
function styleFor(layerName, geomType) {
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

function popupHtml(lname, feat) {
  const props = feat.properties || {};
  return `<div class="popup-title">${lname.toUpperCase().replace(/_/g,' ')}</div>
    ${Object.entries(props).map(([k,v]) =>
      `<div class="popup-row"><span>${k}:</span> ${v ?? '—'}</div>`
    ).join('')}`;
}

// ===== GeoJSON LAYERS =====
const GEO_LAYERS = {};

function loadGeoJSON(id, url, styleFn, onEachFn) {
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      GEO_LAYERS[id] = L.geoJSON(data, {
        style: styleFn,
        pointToLayer: (feat, latlng) =>
          L.circleMarker(latlng, { radius: 5, color: '#e63030', fillColor: '#ff6060',
            weight: 1, fillOpacity: 0.9 }),
        onEachFeature: onEachFn,
      });
      return GEO_LAYERS[id];
    });
}

// ===== LAYER DEFINITIONS =====
const DATA_FILES = [
  { id: 'chk-buffer',   url: 'data/trassenachse_gesamt_buffer_800m.geojson',
    style: () => ({ color: '#e63030', fillColor: '#e63030', weight: 1.5, fillOpacity: 0.08, dashArray: '6 4' }),
    checked: true },
  { id: 'chk-eje',      url: 'data/trassenachse_gesamt.geojson',
    style: () => ({ color: '#e63030', weight: 3 }),
    checked: true },
  { id: 'chk-weg-best', url: 'data/wbk_weg_best.geojson',
    style: () => styleFor('wbk_weg_best'), checked: true },
  { id: 'chk-weg-temp', url: 'data/wbk_weg_temp.geojson',
    style: () => styleFor('wbk_weg_temp'), checked: true },
  { id: 'chk-arbeit',   url: 'data/wbk_arbeitsflaeche.geojson',
    style: () => styleFor('wbk_arbeitsflaeche'), checked: true },
  { id: 'chk-geruest',  url: 'data/wbk_geruest.geojson',
    style: () => styleFor('wbk_geruest'), checked: false },
  { id: 'chk-ausholz',  url: 'data/wbk_ausholzung.geojson',
    style: () => styleFor('wbk_ausholzung'), checked: false },
  { id: 'chk-schutz',   url: 'data/wbk_schutznetz.geojson',
    style: () => styleFor('wbk_schutznetz'), checked: false },
  { id: 'chk-sperr',    url: 'data/wbk_sperrung.geojson',
    style: () => styleFor('wbk_sperrung'), checked: false },
];

// ===== LOAD ALL + FIT BOUNDS =====
let bounds = null;

Promise.all(DATA_FILES.map(def =>
  loadGeoJSON(def.id, def.url, def.style, (feat, layer) => {
    const lname = def.url.split('/').pop().replace('.geojson','');
    layer.on('click', () => layer.bindPopup(popupHtml(lname, feat)).openPopup());
    layer.on('mouseover', function() { if (this.setStyle) this.setStyle({ weight: 4, opacity: 1 }); });
    layer.on('mouseout',  function() { if (this.setStyle) GEO_LAYERS[def.id].resetStyle(this); });
  }).then(gl => {
    if (def.checked) {
      gl.addTo(map);
      const b = gl.getBounds();
      if (b.isValid()) bounds = bounds ? bounds.extend(b) : b;
    }
    // wire checkbox
    document.getElementById(def.id).addEventListener('change', e => {
      if (e.target.checked) gl.addTo(map);
      else map.removeLayer(gl);
    });
  })
)).then(() => {
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

// Cerrar sidebar al hacer click en el mapa (mobile)
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
