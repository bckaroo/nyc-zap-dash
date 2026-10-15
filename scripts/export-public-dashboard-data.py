#!/usr/bin/env python3
"""Create the privacy-safe, static ZapDash feed from the canonical SQLite cache."""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def read_records(db_path: Path) -> list[dict[str, Any]]:
    if not db_path.is_file():
        raise FileNotFoundError(f"Canonical ZAP database not found: {db_path}")

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"SELECT {', '.join(PUBLIC_FIELDS)} FROM zap_applications"
        ).fetchall()

    records: list[dict[str, Any]] = []
    for row in rows:
        record = {field: clean(row[field]) for field in PUBLIC_FIELDS}
        record["id"] = str(record["id"])
        record["project_id"] = str(record["project_id"] or record["id"])
        record["activity_date"] = activity_date(record)
        record["source_url"] = f"{SOURCE['url']}/{record['id']}"
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
    return {
        "generated_at": generated_at,
        "collected_through": collected_through,
        "source": SOURCE,
        "record_count": len(records),
        "records": records,
    }


def export(db_path: Path, output_path: Path, generated_at: str) -> dict[str, Any]:
    payload = build_payload(db_path, generated_at)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(output_path)
    return payload


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise ValueError("Invalid dashboard payload: records missing")
    if payload.get("record_count") != len(payload["records"]):
        raise ValueError("Invalid dashboard payload: record_count mismatch")
    if not payload.get("generated_at") or not payload.get("collected_through"):
        raise ValueError("Invalid dashboard payload: metadata missing")
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
