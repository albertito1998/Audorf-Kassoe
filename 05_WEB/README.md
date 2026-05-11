# Audorf–Kassøe BL02+03 | WebGIS Zuwegungen

Visor WebGIS estático para planificación de zuwegungen (accesos) de la línea de transmisión eléctrica Audorf–Kassøe BL02+03.

## Capas

| Capa | Descripción |
|------|-------------|
| Trassenachse | Eje principal de la línea (~70 km, 382 torres) |
| Buffer 800m | Corredor de planificación ±800 m |
| WBK_WEG_BEST | Accesos existentes |
| WBK_WEG_TEMP | Accesos temporales |
| WBK_ARBEITSFLAECHE | Áreas de trabajo |
| WBK_GERUEST | Andamios |
| WBK_AUSHOLZUNG | Tala / Ausholzung |
| WBK_SCHUTZNETZ | Redes de protección |
| WBK_SPERRUNG | Cierres / Sperrungen |

## Tecnología

- **Leaflet 1.9.4** — mapa web
- **EPSG:4326** — sistema de referencia web
- **EPSG:25832** — sistema de referencia CAD/QGIS
- Sin backend · Sin Node.js

## Fuente CAD

`REV00 Audorf Kassoe BL02+03.dxf` — AutoCAD DXF exportado desde DWG original.

## Publicado con GitHub Pages
