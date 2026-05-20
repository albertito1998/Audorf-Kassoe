# Audorf-Kassoe BL02+03 | WebGIS Zuwegungen

Visor WebGIS estatico para la planificacion de accesos, areas de trabajo, permisos de parcelas y capas ambientales del proyecto Audorf-Kassoe BL02+03.

La web esta pensada para funcionar sin backend: todos los datos que consume el mapa estan publicados como archivos estaticos dentro de `05_WEB/`. El despliegue se realiza con GitHub Pages a partir del contenido de esta carpeta.

## Estado Actual

- Ultima actualizacion visible en la web: `Estado actualizado: 12.05.2026`.
- Deploy configurado con GitHub Pages mediante `.github/workflows/deploy.yml`.
- Rama de publicacion: `main`.
- Carpeta publicada por GitHub Pages: `05_WEB`.
- Ultimo commit de trabajo subido: `406778a Update WebGIS workflow and layers`.

## Estructura Principal

```text
AUDORF_KASSOE_WEBGIS/
  01_QGIS/
  02_CAD/
    export_autocad.dxf
  03_DATA/
  04_PERMITS/
    *.xlsx
  05_WEB/
    index.html
    app.js
    style.css
    README.md
    assets/
      elecnor-deutsch-tp.png
    data/
      *.geojson
    tools/
      build_catastro_wfs_geojson.py
      build_status_genehmigung.py
  update_webgis.ps1
```

## Archivos Web

| Archivo | Funcion |
|---|---|
| `index.html` | Estructura de la aplicacion, header, sidebar, checkboxes de capas y contenedor del mapa. |
| `app.js` | Logica Leaflet: carga de capas, popups, WMS, catastro, permisos, coordenadas, medicion y controles. |
| `style.css` | Estilos del visor, header, sidebar, leyendas, popups, etiquetas y responsive. |
| `assets/elecnor-deutsch-tp.png` | Logo normalizado de Elecnor Deutschland usado como favicon y en el header. |
| `data/*.geojson` | Datos estaticos consumidos por el mapa. |
| `tools/*.py` | Scripts auxiliares para generar capas GeoJSON desde Excel o WFS. |

## Capas Base del Proyecto

| Capa | Archivo | Estado inicial | Descripcion |
|---|---|---:|---|
| Torres / Masten | `data/torres_masten.geojson` | Activada | Torres del proyecto con popup individual. |
| Trassenachse | `data/trassenachse_gesamt.geojson` | Activada | Eje principal de la linea. |
| Buffer 800 m | `data/trassenachse_gesamt_buffer_800m.geojson` | Activada | Corredor de referencia alrededor de la traza. |
| WBK_WEG_BEST | `data/wbk_weg_best.geojson` | Activada | Caminos/accesos existentes. |
| WBK_WEG_TEMP | `data/wbk_weg_temp.geojson` | Activada | Caminos/accesos temporales. |
| WBK_ARBEITSFLAECHE | `data/wbk_arbeitsflaeche.geojson` | Activada | Areas de trabajo. |
| WBK_GERUEST | `data/wbk_geruest.geojson` | Activada | Andamios / protecciones temporales. |
| WBK_AUSHOLZUNG | `data/wbk_ausholzung.geojson` | Activada | Zonas de tala o despeje. |
| WBK_SCHUTZNETZ | `data/wbk_schutznetz.geojson` | Activada | Redes de proteccion. |
| WBK_SPERRUNG | `data/wbk_sperrung.geojson` | Activada | Cortes o cierres. |

## STATUS GENEHMIGUNG

Se creo una capa vectorial especifica llamada `STATUS GENEHMIGUNG`.

Archivo generado:

```text
05_WEB/data/status_genehmigung.geojson
```

Script generador:

```text
05_WEB/tools/build_status_genehmigung.py
```

Origen de datos:

```text
04_PERMITS/*.xlsx
```

Funcionamiento:

- Lee las hojas de permisos del Excel.
- Cruza cada fila con el catastro local usando `Gemarkung`, `Flur` y `Flurstueck`.
- Genera un GeoJSON con las geometria de la parcela y atributos de estado.
- La capa queda activada por defecto en la web.
- Las parcelas con permiso aparecen con relleno verde.
- Las parcelas no informadas aparecen con relleno rojo.
- Si una parcela esta informada pero sin permiso cerrado, queda como estado intermedio.

Campos relevantes generados:

| Campo | Descripcion |
|---|---|
| `status_genehmigung` | Valor interno del estado: `genehmigt`, `nicht_informiert` o `informiert_offen`. |
| `status_label` | Texto visible del estado. |
| `baulos` | Baulos de origen. |
| `masten` | Torres asociadas a la parcela. |
| `eigentuemer` | Nombre compuesto desde los campos disponibles del Excel. |
| `vorname` | Nombre si existe en el Excel. |
| `nachname` | Apellido si existe en el Excel. |
| `email` | Email si existe en el Excel. |
| `telefon` | Telefono si existe en el Excel. |
| `info_daten` | Fechas de informacion/notificacion si existen. |
| `bemerkung` | Observaciones. |
| `permit_rows` | Numero de filas del Excel que han entrado en el cruce. |

Estado actual generado por el script:

```text
Matched 118 parcels.
118 features written.
78 nicht_informiert.
40 genehmigt.
```

Interaccion en el mapa:

- Hover sobre parcela con tooltip.
- Click izquierdo abre popup.
- Click derecho tambien abre popup.
- La capa usa renderer SVG para mejorar eventos de hover/click.
- Tiene prioridad visual sobre el catastro gracias a un pane Leaflet propio.

## Catastro / Kataster SH WFS

Se incorporo una capa vectorial de catastro basada en WFS, pero guardada localmente como GeoJSON para no depender de llamadas WFS directas desde el navegador.

Archivo:

```text
05_WEB/data/catastro_flurstueck.geojson
```

Script:

```text
05_WEB/tools/build_catastro_wfs_geojson.py
```

Servicio fuente:

```text
https://service.gdi-sh.de/WFS_SH_ALKIS_vereinf_OpenGBD
```

Comportamiento visual:

- Se pinta como linea de parcela sin relleno.
- Color azul/cian.
- Popup con datos ALKIS disponibles.
- Etiquetas con numero de parcela a partir de zoom cercano.

Optimizacion de rendimiento:

- La capa aparece marcada por defecto en el sidebar.
- No se descarga al abrir el mapa.
- Solo se carga cuando el usuario llega a `zoom >= 15`.
- Las etiquetas de parcela se muestran desde `zoom >= 16`.
- Si el usuario vuelve a alejarse por debajo de `zoom 15`, la capa se oculta.

Esto evita que el archivo de catastro, que pesa varios MB, bloquee la carga inicial del mapa en Live Server o GitHub Pages.

Campos publicos disponibles en el catastro WFS local:

| Campo | Descripcion |
|---|---|
| `oid` | Identificador tecnico del objeto. |
| `flstkennz` | Identificador catastral. |
| `gemarkung` | Gemarkung. |
| `flur` | Flur. |
| `flurstueck` | Numero de parcela. |
| `gemeinde` | Municipio. |
| `kreis` | Kreis. |
| `aktualit` | Fecha/estado de actualizacion del dato. |

Limitacion importante:

El WFS publico de catastro no contiene propietario, telefono ni email. Esos datos no se pueden obtener automaticamente desde el WFS publico por motivos de proteccion de datos. Para propietario se requiere una consulta oficial al Katasteramt o Grundbuchamt con `berechtigtes Interesse`. En la web solo se muestran datos de propietario si vienen de una fuente interna, por ejemplo el Excel de permisos.

## Popups de Torres

Se ajusto la informacion mostrada al hacer click en una torre.

Cambios realizados:

- Se eliminaron campos poco utiles o demasiado tecnicos del popup.
- Se incorporo la informacion de tipo de cadena asociada a la torre.
- Los tipos manejados vienen de la tabla aportada por el usuario:
  - `DA-Kette`
  - `V-Kette`
  - `TA-Kette`
  - `Hilfskette`
- El popup evita mostrar bloques antiguos como:
  - `Info`
  - `Comentario`
  - `FamiliaTorre`
  - `A-SCimentacion`
  - `Peso Verstaerkung`
  - `Vol Cimen`
  - `Super. Trabajo`

## WMS y Capas Externas

Se añadieron capas WMS opcionales en el panel lateral.

| Checkbox | Fuente | Descripcion |
|---|---|---|
| `chk-infra-osm` | terrestris OSM WMS | Infraestructura general OSM via WMS. No es una capa exclusiva de lineas de alta tension. |
| `chk-naturschutz` | BfN | Naturschutzgebiete. |
| `chk-ffh` | BfN | Fauna-Flora-Habitat Gebiete. |
| `chk-vogel` | BfN | Vogelschutzgebiete. |
| `chk-landschaft` | BfN | Landschaftsschutzgebiete. |
| `chk-biotop` | BfN | Biotoptypen. |
| `chk-hydro` | BKG | Gewaessernetz / hidrografia. |
| `chk-hq100` | GDI-SH | Zonas de inundacion HQ100. |

El bloque WMS fue corregido para evitar un error de JavaScript causado por una definicion insertada dentro de otra.

## Header, Logo y Favicon

Se creo la carpeta:

```text
05_WEB/assets/
```

Se movio/copio el logo normalizado:

```text
05_WEB/assets/elecnor-deutsch-tp.png
```

Usos actuales:

- Favicon del navegador.
- Logo del header de la web.

Tambien se redujo el tamaño visual del logo para que no ocupe demasiado espacio en el header.

El header muestra:

- Logo de Elecnor Deutschland.
- Nombre del proyecto.
- Revision.
- Estado de ultima actualizacion.
- Autor y fecha.

## Coordenadas del Cursor

La barra inferior de coordenadas muestra ahora:

- Latitud WGS84.
- Longitud WGS84.
- Coordenadas UTM32N.
- EPSG usado: `EPSG:25832`.

Formato visible:

```text
Lat: ...  Lng: ... | UTM32N EPSG:25832 E: ... N: ...
```

La conversion se hace directamente en `app.js` mediante una funcion local `wgs84ToUtm32`.

## Herramienta de Medicion

La web mantiene una herramienta de medicion simple:

- Primer click: punto inicial.
- Segundo click: punto final.
- Muestra distancia en metros o kilometros.
- Tiene linea elastica mientras se mueve el cursor.

## Flujo de Actualizacion Automatizado

Se creo el script:

```text
update_webgis.ps1
```

Uso recomendado desde la raiz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1
```

Motivo de `-ExecutionPolicy Bypass`:

En este equipo PowerShell bloquea la ejecucion directa de `.ps1`. El bypass se aplica solo a este proceso y no cambia la politica global del sistema.

Que hace el script por defecto:

1. Detecta la raiz del repositorio.
2. Busca Python usando `py` o `python`.
3. Regenera `STATUS GENEHMIGUNG` desde el Excel de `04_PERMITS/`.
4. Actualiza la fecha del header en `05_WEB/index.html`.
5. Valida que existan los archivos principales de la web.
6. Ejecuta `git status`.
7. Hace `git add -A`.
8. Crea commit si hay cambios.
9. Ejecuta `git push origin main`.
10. El push dispara el deploy de GitHub Pages.

Opciones disponibles:

| Opcion | Funcion |
|---|---|
| `-SkipStatus` | No regenera `STATUS GENEHMIGUNG`. |
| `-UpdateCatastro` | Regenera el catastro local desde WFS. Puede tardar porque descarga datos por tiles. |
| `-ConvertDxf` | Convierte un DXF a GeoJSON usando `ogr2ogr`, si GDAL/QGIS esta instalado y disponible en PATH. |
| `-SkipGit` | Ejecuta la actualizacion y validacion sin commit ni push. |
| `-CommitMessage "texto"` | Permite definir el mensaje de commit. |
| `-DxfPath "ruta.dxf"` | Define el DXF de entrada para `-ConvertDxf`. |
| `-DxfOutput "ruta.geojson"` | Define el GeoJSON de salida para `-ConvertDxf`. |

Ejemplos:

Actualizar Excel, fecha, commit y deploy:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1
```

Probar sin subir a GitHub:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1 -SkipGit
```

Actualizar tambien el catastro WFS:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1 -UpdateCatastro
```

Convertir DXF a GeoJSON:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1 -ConvertDxf
```

Convertir un DXF concreto:

```powershell
powershell -ExecutionPolicy Bypass -File .\update_webgis.ps1 -ConvertDxf -DxfPath "02_CAD/export_autocad.dxf" -DxfOutput "05_WEB/data/export_autocad.geojson"
```

## Deploy en GitHub Pages

El deploy esta configurado en:

```text
.github/workflows/deploy.yml
```

Funcionamiento:

- Se ejecuta en cada push a `main`.
- Tambien se puede lanzar manualmente con `workflow_dispatch`.
- Publica exclusivamente la carpeta `05_WEB`.
- No necesita backend ni build con Node.

Flujo normal:

```text
Editar Excel/DXF -> ejecutar update_webgis.ps1 -> commit -> push -> GitHub Pages deploy
```

## Git y Archivos Ignorados

`.gitignore` se ajusto para evitar subir archivos pesados o fuentes privadas:

```text
02_CAD/export_autocad.dxf
04_PERMITS/*.xlsx
05_WEB/Elecnor Deutsch_TP.png
```

Razon:

- El DXF original puede ser pesado y no se debe publicar si no es necesario.
- El Excel de permisos puede contener datos personales y no debe subirse al repositorio publico.
- El logo fuente con espacios en el nombre se reemplazo por una version normalizada en `assets/`.

## Fuentes de Datos y Privacidad

Datos publicables:

- Geometrias de proyecto convertidas a GeoJSON.
- Catastro publico simplificado sin propietarios.
- Capas WMS publicas.
- Estados agregados de permisos si el equipo decide publicarlos.

Datos sensibles:

- Exceles de permisos.
- Datos de propietarios.
- Telefonos.
- Emails.
- Observaciones privadas.

Recomendacion:

No subir nunca a GitHub archivos Excel originales con propietarios o contactos. La web debe recibir solo los campos estrictamente necesarios y revisados.

## Dependencias

La web:

- Leaflet 1.9.4 desde CDN.
- No necesita Node.js.
- No necesita servidor backend.

Scripts:

- Python.
- `openpyxl` para leer Excel en `build_status_genehmigung.py`.
- `requests` para descargar WFS en `build_catastro_wfs_geojson.py`.
- `ogr2ogr` solo si se usa `-ConvertDxf`.

## Comprobaciones Realizadas

Durante la actualizacion se comprobo:

- `update_webgis.ps1 -SkipGit` funciona.
- El script regenera `STATUS GENEHMIGUNG`.
- Resultado actual: 118 parcelas cruzadas.
- El servidor local respondia `200` para `index.html` y `app.js`.
- `git diff --check` quedo limpio antes del commit.
- Push realizado correctamente a `origin/main`.

## Pendientes o Mejoras Futuras

- Definir una conversion DXF -> GeoJSON mas especifica por capas CAD si se quiere actualizar automaticamente `wbk_*`, `torres_masten` o `trassenachse_gesamt`.
- Añadir validacion de esquema para los GeoJSON generados.
- Añadir resumen automatico despues del script con numero de features por capa.
- Añadir una capa WMS especializada de alta tension si se encuentra una fuente oficial estable.
- Separar datos sensibles de propietarios en un flujo privado si el repositorio es publico.
- Añadir documentacion de como solicitar datos oficiales al Katasteramt/Grundbuchamt con `berechtigtes Interesse`.
