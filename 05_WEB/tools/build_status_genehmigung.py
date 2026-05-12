#!/usr/bin/env python3
"""Build parcel permission status from Excel permit tables and local WFS parcels."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

import openpyxl


EXCEL_GLOB = "../../04_PERMITS/*.xlsx"
CADASTRE_GEOJSON = "../data/catastro_flurstueck.geojson"
OUTPUT_GEOJSON = "../data/status_genehmigung.geojson"
PERMIT_SHEETS = ("Eigentürmer BL02", "Eigentürmer BL03")


def clean_text(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def normalize_text(value) -> str:
    return clean_text(value).casefold()


def normalize_flur(value) -> str:
    text = clean_text(value)
    match = re.search(r"\d+", text)
    return match.group(0) if match else text


def normalize_flurstueck(value) -> str:
    text = clean_text(value)
    if not text:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = text.replace(" ", "")
    text = re.sub(r"\.0$", "", text)
    return text


def parcel_key(gemarkung, flur, flurstueck) -> tuple[str, str, str]:
    return (normalize_text(gemarkung), normalize_flur(flur), normalize_flurstueck(flurstueck))


def is_truthy(value) -> bool:
    if value is True:
        return True
    if value is False or value is None:
        return False
    text = normalize_text(value)
    return text in {"true", "wahr", "ja", "yes", "x", "1", "✓"}


def format_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return clean_text(value)


def read_permit_rows(excel_path: Path) -> dict[tuple[str, str, str], dict]:
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    permits = defaultdict(lambda: {
        "masts": set(),
        "owners": set(),
        "baulose": set(),
        "remarks": set(),
        "info_dates": set(),
        "permission_values": [],
        "rows": 0,
    })

    for sheet_name in PERMIT_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        rows = ws.iter_rows(values_only=True)
        headers = [clean_text(v) for v in next(rows)]
        header_index = {name: idx for idx, name in enumerate(headers) if name}

        def get(row, name):
            idx = header_index.get(name)
            return row[idx] if idx is not None and idx < len(row) else None

        blank_streak = 0
        for row in rows:
            if not any(v is not None for v in row[:12]):
                blank_streak += 1
                if blank_streak > 25:
                    break
                continue
            blank_streak = 0

            gemarkung = get(row, "Gemarkung")
            flur = get(row, "Flur")
            flurstueck = get(row, "Flurstueck")
            key = parcel_key(gemarkung, flur, flurstueck)
            if not all(key):
                continue

            entry = permits[key]
            entry["rows"] += 1
            entry["baulose"].add(sheet_name.replace("Eigentürmer ", ""))
            entry["masts"].add(format_value(get(row, "Mast")))

            owner = " ".join(part for part in [format_value(get(row, "Vorname")), format_value(get(row, "Nachname"))] if part)
            if owner:
                entry["owners"].add(owner)

            remark = format_value(get(row, "Bemerkung"))
            if remark:
                entry["remarks"].add(remark)

            permission_value = get(row, "Zustimmung")
            if permission_value is None:
                permission_value = get(row, "Erlaubnis erhalten")
            entry["permission_values"].append(is_truthy(permission_value))

            for header in headers:
                if header.startswith("Fecha Información"):
                    info_date = format_value(get(row, header))
                    if info_date:
                        entry["info_dates"].add(info_date)

    return permits


def status_for(entry: dict) -> str:
    if any(entry["permission_values"]):
        return "genehmigt"
    if not entry["info_dates"]:
        return "nicht_informiert"
    return "informiert_offen"


def main() -> None:
    base = Path(__file__).resolve().parent
    excel_files = list((base / "../../04_PERMITS").resolve().glob("*.xlsx"))
    if not excel_files:
        raise FileNotFoundError("No .xlsx files found in 04_PERMITS")

    permits = {}
    for excel_path in excel_files:
        for key, value in read_permit_rows(excel_path).items():
            if key in permits:
                target = permits[key]
                for set_key in ("masts", "owners", "baulose", "remarks", "info_dates"):
                    target[set_key].update(value[set_key])
                target["permission_values"].extend(value["permission_values"])
                target["rows"] += value["rows"]
            else:
                permits[key] = value

    cadastre_path = (base / CADASTRE_GEOJSON).resolve()
    cadastre = json.loads(cadastre_path.read_text(encoding="utf-8"))
    features = []
    matched = 0

    for feature in cadastre["features"]:
        props = feature.get("properties", {})
        key = parcel_key(props.get("gemarkung"), props.get("flur"), props.get("flurstueck"))
        entry = permits.get(key)
        if not entry:
            continue
        matched += 1
        status = status_for(entry)
        status_props = {
            **props,
            "status_genehmigung": status,
            "status_label": {
                "genehmigt": "Genehmigt",
                "nicht_informiert": "Nicht informiert",
                "informiert_offen": "Informiert / offen",
            }[status],
            "baulos": ", ".join(sorted(v for v in entry["baulose"] if v)),
            "masten": ", ".join(sorted((v for v in entry["masts"] if v), key=lambda x: (len(x), x))),
            "eigentuemer": "; ".join(sorted(entry["owners"])),
            "info_daten": ", ".join(sorted(entry["info_dates"])),
            "bemerkung": "; ".join(sorted(entry["remarks"])),
            "permit_rows": entry["rows"],
        }
        features.append({
            "type": "Feature",
            "properties": status_props,
            "geometry": feature["geometry"],
        })

    output_path = (base / OUTPUT_GEOJSON).resolve()
    output_path.write_text(
        json.dumps({
            "type": "FeatureCollection",
            "name": "status_genehmigung",
            "source": str(excel_files[0].name),
            "features": features,
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    counts = defaultdict(int)
    for feature in features:
        counts[feature["properties"]["status_genehmigung"]] += 1
    print(f"Matched {matched} parcels. Wrote {len(features)} features to {output_path}")
    print(dict(counts))


if __name__ == "__main__":
    main()
