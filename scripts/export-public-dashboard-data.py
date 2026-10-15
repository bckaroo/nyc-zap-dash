#!/usr/bin/env python3
"""Create the privacy-safe, static ZapDash feed from the canonical SQLite cache."""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BASE_DIR / "data" / "zap-applications.db"
DEFAULT_OUT_PATH = BASE_DIR / "data" / "public-dashboard-data.json"
DEFAULT_SNAPSHOT_PATH = BASE_DIR / "src" / "data" / "public-dashboard-data.json"
SOURCE = {
    "name": "NYC Department of City Planning Zoning Application Portal",
    "url": "https://zap.planning.nyc.gov/projects",
    "api_url": "https://zap-api-production.herokuapp.com/projects",
}
PUBLIC_FIELDS = (
    "id",
    "project_id",
    "project_name",
    "project_brief",
    "borough",
    "community_district",
    "public_status",
    "ulurp_non",
    "ceqr_number",
    "ceqr_type",
    "eas_eis",
    "primary_applicant",
    "applicant_type",
    "flood_zone_a",
    "flood_zone_shadedx",
    "milestone_date",
    "certified_referred",
    "first_seen_date",
    "last_updated_date",
)
GEOGRAPHY_DB_FIELDS = (
    "bbls_json",
    "bbl_featurecollection_json",
    "action_codes_json",
    "geography_location_method",
    "geography_location_source",
    "geography_status",
)
DERIVED_PUBLIC_FIELDS = ("activity_date", "source_url", "action_types", "location_method", "location_source")
BOROUGH_CODES = {
    "Manhattan": "1",
    "Bronx": "2",
    "Brooklyn": "3",
    "Queens": "4",
    "Staten Island": "5",
}
CD_BOROUGH_CODES = {"M": "1", "X": "2", "K": "3", "Q": "4", "R": "5"}
BOUNDARY_SOURCES = {
    "boroughs": {
        "dataset_id": "gthc-hcne",
        "name": "NYC Borough Boundaries",
        "source_url": "https://data.cityofnewyork.us/d/gthc-hcne",
        "file": "/data/nyc-boroughs.geojson",
        "retrieved_at": "2026-10-14",
    },
    "community_districts": {
        "dataset_id": "5crt-au7u",
        "name": "NYC Community District Boundaries",
        "source_url": "https://data.cityofnewyork.us/d/5crt-au7u",
        "file": "/data/nyc-community-districts.geojson",
        "retrieved_at": "2026-10-14",
        "scope": "59 numbered Community Districts; joint-interest areas excluded",
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(value: Any) -> Any:
    return "" if value is None else value


def activity_date(record: dict[str, Any]) -> str:
    """Return the first available date in substantive-to-discovery order."""
    for field in ("milestone_date", "certified_referred", "first_seen_date"):
        value = clean(record.get(field))
        if value:
            return str(value)[:10]
    return ""


def parse_json(value: Any, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value) if isinstance(value, str) else value
    except (TypeError, json.JSONDecodeError):
        return fallback


def point_in_ring(point: tuple[float, float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    for index, current in enumerate(ring):
        previous = ring[index - 1]
        if len(current) < 2 or len(previous) < 2:
            continue
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if ((y1 > y) != (y2 > y)) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def point_in_polygon(point: tuple[float, float], polygon: list[list[list[float]]]) -> bool:
    return bool(polygon and point_in_ring(point, polygon[0])) and not any(
        point_in_ring(point, hole) for hole in polygon[1:]
    )


def ring_centroid(ring: list[list[float]]) -> tuple[float, float] | None:
    area_twice = cx = cy = 0.0
    for index, current in enumerate(ring):
        previous = ring[index - 1]
        if len(current) < 2 or len(previous) < 2:
            continue
        cross = float(previous[0]) * float(current[1]) - float(current[0]) * float(previous[1])
        area_twice += cross
        cx += (float(previous[0]) + float(current[0])) * cross
        cy += (float(previous[1]) + float(current[1])) * cross
    if math.isclose(area_twice, 0.0):
        return None
    return cx / (3 * area_twice), cy / (3 * area_twice)


def point_on_polygon(polygon: list[list[list[float]]]) -> list[float] | None:
    """Return a deterministic point on the surface of an authoritative polygon."""
    if not polygon or len(polygon[0]) < 4:
        return None
    outer = polygon[0]
    centroid = ring_centroid(outer)
    if centroid and point_in_polygon(centroid, polygon):
        return [round(centroid[0], 7), round(centroid[1], 7)]

    ys = [float(point[1]) for point in outer if len(point) >= 2]
    if not ys:
        return None
    unique_ys = sorted(set(ys))
    candidate_ys = [(min(ys) + max(ys)) / 2]
    candidate_ys.extend((left + right) / 2 for left, right in zip(unique_ys, unique_ys[1:]))
    best: tuple[float, float, float] | None = None
    for y in candidate_ys:
        intersections = []
        for index, current in enumerate(outer):
            previous = outer[index - 1]
            x1, y1 = float(previous[0]), float(previous[1])
            x2, y2 = float(current[0]), float(current[1])
            if (y1 > y) == (y2 > y):
                continue
            intersections.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        intersections.sort()
        for left, right in zip(intersections[::2], intersections[1::2]):
            x = (left + right) / 2
            if point_in_polygon((x, y), polygon):
                width = right - left
                if best is None or width > best[0]:
                    best = (width, x, y)
    if best:
        return [round(best[1], 7), round(best[2], 7)]
    return [round(float(outer[0][0]), 7), round(float(outer[0][1]), 7)]


def iter_polygon_parts(feature_collection: Any) -> Iterator[tuple[list[list[list[float]]], str]]:
    if not isinstance(feature_collection, dict) or feature_collection.get("type") != "FeatureCollection":
        return
    for feature in feature_collection.get("features", []):
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        feature_bbl = str(properties.get("bbl") or properties.get("BBL") or "")
        if geometry.get("type") == "Polygon":
            yield geometry.get("coordinates", []), feature_bbl
        elif geometry.get("type") == "MultiPolygon":
            for polygon in geometry.get("coordinates", []):
                yield polygon, feature_bbl


def community_district_ids(value: str) -> list[str]:
    ids = []
    for prefix, number in re.findall(r"([MKQXR])(\d{1,2})", value.upper()):
        numeric = int(number)
        if 1 <= numeric <= 18:
            identifier = f"{CD_BOROUGH_CODES[prefix]}{numeric:02d}"
            if identifier not in ids:
                ids.append(identifier)
    return ids


def build_map_payload(records: list[dict[str, Any]]) -> dict[str, Any]:
    borough_projects: dict[tuple[str, str], set[str]] = {}
    district_projects: dict[tuple[str, str], set[str]] = {}
    distinct_projects = {str(record.get("project_id") or record.get("id")) for record in records}
    located_projects: set[str] = set()
    features = []

    for record in records:
        project_id = str(record.get("project_id") or record.get("id") or "")
        borough = str(record.get("borough") or "")
        borough_id = BOROUGH_CODES.get(borough)
        if borough_id and project_id:
            borough_projects.setdefault((borough_id, borough), set()).add(project_id)
        for district_id in community_district_ids(str(record.get("community_district") or "")):
            district_projects.setdefault((district_id, borough), set()).add(project_id)

        bbls = parse_json(record.get("bbls_json"), [])
        action_types = parse_json(record.get("action_codes_json"), [])
        if not isinstance(bbls, list):
            bbls = []
        if not isinstance(action_types, list):
            action_types = []
        action_types = [str(code).strip().upper() for code in action_types if str(code).strip()]
        feature_collection = parse_json(record.get("bbl_featurecollection_json"), {})
        parts = list(iter_polygon_parts(feature_collection))
        project_had_point = False
        for index, (polygon, feature_bbl) in enumerate(parts):
            point = point_on_polygon(polygon)
            if point is None:
                continue
            bbl = feature_bbl or (str(bbls[index]) if index < len(bbls) else "")
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": point},
                "properties": {
                    "project_id": project_id,
                    "project_name": str(record.get("project_name") or "Unnamed application"),
                    "borough": borough,
                    "community_district": str(record.get("community_district") or ""),
                    "action_types": action_types,
                    "primary_action_type": action_types[0] if action_types else "",
                    "location_method": "point_on_zap_bbl_polygon",
                    "location_source": "ZAP bbl-featurecollection",
                    "source_url": str(record.get("source_url") or f"{SOURCE['url']}/{record.get('id', '')}"),
                    "bbl": bbl,
                },
            })
            project_had_point = True
        if project_had_point:
            located_projects.add(project_id)

    features.sort(key=lambda feature: (
        feature["properties"]["project_id"],
        feature["properties"]["bbl"],
        feature["geometry"]["coordinates"],
    ))
    return {
        "borough_counts": [
            {"id": identifier, "name": name, "project_count": len(project_ids)}
            for (identifier, name), project_ids in sorted(borough_projects.items())
        ],
        "community_district_counts": [
            {"id": identifier, "borough": borough, "project_count": len(project_ids)}
            for (identifier, borough), project_ids in sorted(district_projects.items())
        ],
        "project_sites": {"type": "FeatureCollection", "features": features},
        "located_project_count": len(located_projects),
        "site_point_count": len(features),
        "unmatched_project_count": len(distinct_projects - located_projects),
    }


def read_records(db_path: Path) -> list[dict[str, Any]]:
    if not db_path.is_file():
        raise FileNotFoundError(f"Canonical ZAP database not found: {db_path}")

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"SELECT {', '.join(PUBLIC_FIELDS + GEOGRAPHY_DB_FIELDS)} FROM zap_applications"
        ).fetchall()

    records: list[dict[str, Any]] = []
    for row in rows:
        record = {field: clean(row[field]) for field in PUBLIC_FIELDS + GEOGRAPHY_DB_FIELDS}
        record["id"] = str(record["id"])
        record["project_id"] = str(record["project_id"] or record["id"])
        record["activity_date"] = activity_date(record)
        record["source_url"] = f"{SOURCE['url']}/{record['id']}"
        action_types = parse_json(record.get("action_codes_json"), [])
        record["action_types"] = action_types if isinstance(action_types, list) else []
        record["location_method"] = clean(record.get("geography_location_method"))
        record["location_source"] = clean(record.get("geography_location_source"))
        records.append(record)

    return sorted(
        records,
        key=lambda record: (
            str(record["activity_date"]),
            str(record["project_name"]).casefold(),
            str(record["id"]),
        ),
        reverse=True,
    )


def build_payload(db_path: Path, generated_at: str) -> dict[str, Any]:
    records = read_records(db_path)
    collected_through = max(
        (str(record["last_updated_date"])[:10] for record in records if record["last_updated_date"]),
        default="",
    )
    public_record_fields = PUBLIC_FIELDS + DERIVED_PUBLIC_FIELDS
    return {
        "generated_at": generated_at,
        "collected_through": collected_through,
        "source": SOURCE,
        "record_count": len(records),
        "boundaries": BOUNDARY_SOURCES,
        "map": build_map_payload(records),
        "records": [
            {field: clean(record.get(field)) for field in public_record_fields}
            for record in records
        ],
    }


def export(db_path: Path, output_path: Path, generated_at: str) -> dict[str, Any]:
    payload = build_payload(db_path, generated_at)
    write_payload(payload, output_path)
    return payload


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise ValueError("Invalid dashboard payload: records missing")
    if payload.get("record_count") != len(payload["records"]):
        raise ValueError("Invalid dashboard payload: record_count mismatch")
    if not payload.get("generated_at") or not payload.get("collected_through"):
        raise ValueError("Invalid dashboard payload: metadata missing")
    map_payload = payload.get("map")
    if not isinstance(map_payload, dict):
        raise ValueError("Invalid dashboard payload: map payload missing")
    sites = map_payload.get("project_sites", {})
    if sites.get("type") != "FeatureCollection" or not isinstance(sites.get("features"), list):
        raise ValueError("Invalid dashboard payload: project sites missing")
    if map_payload.get("site_point_count") != len(sites["features"]):
        raise ValueError("Invalid dashboard payload: site point count mismatch")
    if not isinstance(payload.get("boundaries"), dict):
        raise ValueError("Invalid dashboard payload: boundary metadata missing")
    return payload


def write_payload(payload: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(output_path)


def fallback_from_snapshot(snapshot_path: Path) -> dict[str, Any]:
    if not snapshot_path.is_file():
        raise SystemExit(
            "ERROR: canonical database not found and no tracked snapshot available.\n"
            f"Expected canonical database (locally built only): {DEFAULT_DB_PATH.name} under data/\n"
            "or the tracked privacy-safe snapshot: src/data/public-dashboard-data.json.\n"
            "Refresh the snapshot locally, then commit it before deploying from a clean checkout."
        )
    print(f"Snapshot fallback: using {snapshot_path} (canonical database not present)")
    return validate_payload(json.loads(snapshot_path.read_text(encoding="utf-8")))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT_PATH)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT_PATH)
    parser.add_argument(
        "--update-snapshot",
        action="store_true",
        help="Also refresh the tracked privacy-safe snapshot (local canonical DB runs only)",
    )
    parser.add_argument("--no-snapshot-update", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--generated-at", default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.db.is_file():
        payload = fallback_from_snapshot(args.snapshot)
        write_payload(payload, args.output)
        print(
            f"Snapshot fallback wrote {payload['record_count']} records to {args.output} "
            f"(generated_at={payload['generated_at']})"
        )
        return

    payload = export(args.db, args.output, args.generated_at or utc_now_iso())
    print(f"Wrote {payload['record_count']} records to {args.output}")
    if args.update_snapshot and not args.no_snapshot_update:
        write_payload(payload, args.snapshot)
        print(f"Refreshed tracked snapshot at {args.snapshot}")


if __name__ == "__main__":
    main()
