#!/usr/bin/env python3
"""Download and simplify authoritative NYC borough and Community District boundaries."""

from __future__ import annotations

import argparse
import json
import math
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]
DATASETS = {
    "boroughs": {
        "dataset_id": "gthc-hcne",
        "name": "NYC Borough Boundaries",
        "source_url": "https://data.cityofnewyork.us/d/gthc-hcne",
        "api_url": "https://data.cityofnewyork.us/resource/gthc-hcne.geojson?$limit=20",
        "output": BASE_DIR / "public" / "data" / "nyc-boroughs.geojson",
    },
    "community_districts": {
        "dataset_id": "5crt-au7u",
        "name": "NYC Community District Boundaries",
        "source_url": "https://data.cityofnewyork.us/d/5crt-au7u",
        "api_url": "https://data.cityofnewyork.us/resource/5crt-au7u.geojson?$limit=200",
        "output": BASE_DIR / "public" / "data" / "nyc-community-districts.geojson",
    },
}


def perpendicular_distance(point: list[float], start: list[float], end: list[float]) -> float:
    if start == end:
        return math.hypot(point[0] - start[0], point[1] - start[1])
    numerator = abs(
        (end[1] - start[1]) * point[0]
        - (end[0] - start[0]) * point[1]
        + end[0] * start[1]
        - end[1] * start[0]
    )
    denominator = math.hypot(end[1] - start[1], end[0] - start[0])
    return numerator / denominator


def simplify_line(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if tolerance <= 0 or len(points) <= 2:
        return points
    maximum = 0.0
    split_index = 0
    for index, point in enumerate(points[1:-1], start=1):
        distance = perpendicular_distance(point, points[0], points[-1])
        if distance > maximum:
            maximum = distance
            split_index = index
    if maximum <= tolerance:
        return [points[0], points[-1]]
    left = simplify_line(points[: split_index + 1], tolerance)
    right = simplify_line(points[split_index:], tolerance)
    return left[:-1] + right


def simplify_ring(ring: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(ring) < 4:
        return ring
    open_ring = ring[:-1] if ring[0] == ring[-1] else ring[:]
    if len(open_ring) < 3:
        return ring
    # Rotate to a stable extremal point so the closed ring has meaningful endpoints.
    start_index = min(range(len(open_ring)), key=lambda index: (open_ring[index][0], open_ring[index][1]))
    rotated = open_ring[start_index:] + open_ring[:start_index]
    halfway = len(rotated) // 2
    first = simplify_line(rotated[: halfway + 1], tolerance)
    second = simplify_line(rotated[halfway:] + [rotated[0]], tolerance)
    simplified = first[:-1] + second
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified if len(simplified) >= 4 else ring


def simplify_geometry(geometry: dict[str, Any], tolerance: float) -> dict[str, Any]:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if geometry_type == "Polygon":
        simplified = [simplify_ring(ring, tolerance) for ring in coordinates]
    elif geometry_type == "MultiPolygon":
        simplified = [
            [simplify_ring(ring, tolerance) for ring in polygon]
            for polygon in coordinates
        ]
    else:
        raise ValueError(f"Unsupported boundary geometry type: {geometry_type}")
    return {"type": geometry_type, "coordinates": simplified}


def prepare_feature_collection(
    source: dict[str, Any],
    kind: str,
    retrieved_at: str,
    tolerance: float,
) -> dict[str, Any]:
    dataset = DATASETS[kind]
    features = []
    for feature in source.get("features", []):
        properties = feature.get("properties", {})
        if kind == "boroughs":
            identifier = str(properties.get("borocode", ""))
            output_properties = {
                "borocode": identifier,
                "boroname": str(properties.get("boroname", "")),
            }
        else:
            identifier = str(properties.get("boro_cd", ""))
            if not identifier.isdigit() or not (1 <= int(identifier) % 100 <= 18):
                continue
            output_properties = {"boro_cd": identifier}
        if not identifier or not feature.get("geometry"):
            continue
        features.append({
            "type": "Feature",
            "id": identifier,
            "properties": output_properties,
            "geometry": simplify_geometry(feature["geometry"], tolerance),
        })
    features.sort(key=lambda feature: int(feature["id"]))
    return {
        "type": "FeatureCollection",
        "metadata": {
            "name": dataset["name"],
            "dataset_id": dataset["dataset_id"],
            "source_url": dataset["source_url"],
            "api_url": dataset["api_url"],
            "retrieved_at": retrieved_at,
            "simplification_tolerance_degrees": tolerance,
            "feature_count": len(features),
            "scope": "59 numbered Community Districts; joint-interest areas excluded"
            if kind == "community_districts" else "Five NYC boroughs",
        },
        "features": features,
    }


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "ZapDash/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def write_json(payload: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retrieved-at", default=date.today().isoformat())
    parser.add_argument("--tolerance", type=float, default=0.00008)
    args = parser.parse_args()

    for kind, dataset in DATASETS.items():
        payload = prepare_feature_collection(
            fetch_json(dataset["api_url"]),
            kind,
            args.retrieved_at,
            args.tolerance,
        )
        write_json(payload, dataset["output"])
        print(f"Wrote {payload['metadata']['feature_count']} {kind} features to {dataset['output']}")


if __name__ == "__main__":
    main()
