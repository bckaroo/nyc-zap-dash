#!/usr/bin/env python3
"""Export ZAP application records for the static public dashboard prototype."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "zap-applications.db"
OUT_PATH = BASE_DIR / "files" / "public-dashboard-data.json"


def row_to_dict(cursor: sqlite3.Cursor, row: sqlite3.Row) -> dict:
    return {description[0]: row[index] for index, description in enumerate(cursor.description)}


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                id,
                project_id,
                project_name,
                project_brief,
                borough,
                community_district,
                public_status,
                ulurp_non,
                ceqr_number,
                ceqr_type,
                eas_eis,
                primary_applicant,
                applicant_type,
                flood_zone_a,
                flood_zone_shadedx,
                milestone_date,
                certified_referred,
                first_seen_date,
                last_updated_date,
                newsletter_included
            FROM zap_applications
            ORDER BY datetime(COALESCE(milestone_date, last_updated_date, first_seen_date)) DESC,
                     project_name COLLATE NOCASE ASC
            """
        )
        records = [row_to_dict(cursor, row) for row in cursor.fetchall()]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(DB_PATH),
        "record_count": len(records),
        "records": records,
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} records to {OUT_PATH}")


if __name__ == "__main__":
    main()
