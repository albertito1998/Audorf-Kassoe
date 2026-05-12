#!/usr/bin/env python3
"""Download ALKIS Flurstueck parcels from GDI-SH WFS into local GeoJSON."""

from __future__ import annotations

import argparse
import json
import math
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests


WFS_URL = "https://service.gdi-sh.de/WFS_SH_ALKIS_vereinf_OpenGBD"
STORED_QUERY = "http://repository.gdi-de.org/query/adv/produkt/alkis-vereinfacht/2.0/ave-by-bbox"
CRS_25832 = "urn:ogc:def:crs:EPSG::25832"


def wgs84_to_utm32(lon: float, lat: float) -> tuple[float, float]:
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    lon0 = math.radians(9.0)
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)

    n = a / math.sqrt(1 - e2 * math.sin(lat_rad) ** 2)
    t = math.tan(lat_rad) ** 2
    c = ep2 * math.cos(lat_rad) ** 2
    aa = math.cos(lat_rad) * (lon_rad - lon0)
    m = a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat_rad
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat_rad)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat_rad)
        - (35 * e2**3 / 3072) * math.sin(6 * lat_rad)
    )

    x = k0 * n * (
        aa
        + (1 - t + c) * aa**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * aa**5 / 120
    ) + 500000.0
    y = k0 * (
        m
        + n
        * math.tan(lat_rad)
        * (
            aa**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * aa**6 / 720
        )
    )
    return x, y


def utm32_to_wgs84(x: float, y: float) -> tuple[float, float]:
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    lon0 = math.radians(9.0)

    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )

    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = ep2 * math.cos(phi1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = (x - 500000.0) / (n1 * k0)

    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720
    )
    lon = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120
    ) / math.cos(phi1)

    return math.degrees(lon), math.degrees(lat)


def local_text(node: ET.Element, name: str) -> str:
    found = node.find(f".//{{*}}{name}")
    return (found.text or "").strip() if found is not None else ""


def rings_from_polygon(poly: ET.Element) -> list[list[list[float]]]:
    rings = []
    for tag in ("exterior", "interior"):
        nodes = poly.findall(f".//{{*}}{tag}")
        for node in nodes:
            pos = node.find(".//{*}posList")
            if pos is None or not pos.text:
                continue
            values = [float(v) for v in pos.text.split()]
            ring = []
            for i in range(0, len(values) - 1, 2):
                ring.append(list(utm32_to_wgs84(values[i], values[i + 1])))
            if ring:
                rings.append(ring)
    return rings


def parse_flurstueck_gml(xml_text: str, seen: set[str]) -> list[dict]:
    root = ET.fromstring(xml_text)
    features = []

    for node in root.findall(".//{*}Flurstueck"):
        oid = local_text(node, "oid") or node.attrib.get("{http://www.opengis.net/gml/3.2}id", "")
        if oid in seen:
            continue

        polygons = []
        for poly in node.findall(".//{*}Polygon"):
            rings = rings_from_polygon(poly)
            if rings:
                polygons.append(rings)

        if not polygons:
            continue

        seen.add(oid)
        nr = local_text(node, "flstnrzae")
        nenner = local_text(node, "flstnrnen")
        flurstueck = f"{nr}/{nenner}" if nenner else nr
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "oid": oid,
                    "flstkennz": local_text(node, "flstkennz"),
                    "gemarkung": local_text(node, "gemarkung"),
                    "flur": local_text(node, "flur"),
                    "flurstueck": flurstueck,
                    "gemeinde": local_text(node, "gemeinde"),
                    "kreis": local_text(node, "kreis"),
                    "aktualit": local_text(node, "aktualit"),
                },
                "geometry": {
                    "type": "Polygon" if len(polygons) == 1 else "MultiPolygon",
                    "coordinates": polygons[0] if len(polygons) == 1 else polygons,
                },
            }
        )

    return features


def round_coordinates(coords, ndigits: int = 6):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(float(value), ndigits) for value in coords]
    return [round_coordinates(item, ndigits) for item in coords]


def route_points(path: Path) -> list[tuple[float, float]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    coords = data["features"][0]["geometry"]["coordinates"]
    return [wgs84_to_utm32(float(lon), float(lat)) for lon, lat, *_ in coords]


def query_bbox(session: requests.Session, bbox: tuple[float, float, float, float], retries: int = 4) -> str:
    x1, y1, x2, y2 = bbox
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "storedquery_id": STORED_QUERY,
        "CRS": CRS_25832,
        "x1": f"{x1:.3f}",
        "y1": f"{y1:.3f}",
        "x2": f"{x2:.3f}",
        "y2": f"{y2:.3f}",
    }
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(WFS_URL, params=params, timeout=90)
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            wait = min(20.0, 2.0 * attempt)
            print(f"  retry {attempt}/{retries} after WFS error: {exc}")
            time.sleep(wait)

    raise RuntimeError(f"WFS request failed after {retries} retries") from last_error


def build_tiles(points: list[tuple[float, float]], buffer_m: float, grid_m: float) -> list[tuple[float, float, float, float]]:
    keys = set()
    tiles = []
    for x, y in points:
        key = (round(x / grid_m), round(y / grid_m))
        if key in keys:
            continue
        keys.add(key)
        cx, cy = key[0] * grid_m, key[1] * grid_m
        tiles.append((cx - buffer_m, cy - buffer_m, cx + buffer_m, cy + buffer_m))
    return tiles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--route", default="../data/trassenachse_gesamt.geojson")
    parser.add_argument("--output", default="../data/catastro_flurstueck.geojson")
    parser.add_argument("--buffer", type=float, default=650.0, help="Half-size of each WFS query tile in meters.")
    parser.add_argument("--grid", type=float, default=900.0, help="Tile spacing in meters along the route.")
    parser.add_argument("--sleep", type=float, default=0.15, help="Pause between WFS requests.")
    args = parser.parse_args()

    base = Path(__file__).resolve().parent
    route_path = (base / args.route).resolve()
    output_path = (base / args.output).resolve()
    points = route_points(route_path)
    tiles = build_tiles(points, args.buffer, args.grid)

    session = requests.Session()
    features = []
    seen: set[str] = set()

    for i, bbox in enumerate(tiles, 1):
        print(f"[{i}/{len(tiles)}] WFS bbox {bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}")
        xml_text = query_bbox(session, bbox)
        new_features = parse_flurstueck_gml(xml_text, seen)
        features.extend(new_features)
        print(f"  +{len(new_features)} parcels, total {len(features)}")
        time.sleep(args.sleep)

    for feature in features:
        feature["geometry"]["coordinates"] = round_coordinates(feature["geometry"]["coordinates"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "name": "catastro_flurstueck_wfs",
                "source": WFS_URL,
                "features": features,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(features)} parcels to {output_path}")


if __name__ == "__main__":
    main()
