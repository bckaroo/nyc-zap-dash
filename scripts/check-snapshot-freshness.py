#!/usr/bin/env python3
"""Fail the build when the committed public dashboard snapshot is stale.

The GitHub Pages deploy builds from the tracked snapshot
(``src/data/public-dashboard-data.json``), not from a live database: CI has no
``data/`` DB, so the exporter falls back to whatever snapshot is committed. That
means a green deploy can ship arbitrarily old data. This gate turns that silent
failure into a red run.

``collected_through`` in the snapshot is ``max(last_updated_date)`` across
records, i.e. the latest collection that touched any record -- a proxy for "is
anyone still refreshing this snapshot". The comparison reference is the
**commit/build date** (``--as-of``), never the runtime wall clock, so re-running
an old workflow compares against when that commit was built instead of today.

Exit codes: 0 = fresh, 1 = stale/missing/unreadable.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT_PATH = BASE_DIR / "src" / "data" / "public-dashboard-data.json"
DEFAULT_MAX_DAYS = 10


def parse_reference_date(value: str) -> date:
    """Accept ``YYYY-MM-DD`` or a full ISO-8601 instant (GitHub commit timestamps)."""
    text = value.strip()
    if not text:
        raise ValueError("empty date")
    try:
        return date.fromisoformat(text)
    except ValueError:
        pass
    normalised = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        return datetime.fromisoformat(normalised).date()
    except ValueError as exc:
        raise ValueError(f"not an ISO-8601 date or timestamp: {value!r}") from exc


def load_collected_through(snapshot_path: Path) -> date:
    if not snapshot_path.is_file():
        raise SystemExit(f"ERROR: snapshot not found: {snapshot_path}")
    try:
        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ERROR: cannot read snapshot {snapshot_path}: {exc}")
    if not isinstance(payload, dict):
        raise SystemExit(f"ERROR: snapshot {snapshot_path} is not a JSON object")

    raw = payload.get("collected_through")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        raise SystemExit(
            f"ERROR: snapshot {snapshot_path.name} has no collected_through value; "
            "freshness cannot be verified. Re-run "
            "`python3 scripts/export-public-dashboard-data.py --update-snapshot` "
            "against a populated data/zap-applications.db and commit the result."
        )
    try:
        return parse_reference_date(str(raw))
    except ValueError as exc:
        raise SystemExit(
            f"ERROR: collected_through={raw!r} in {snapshot_path.name} is not an "
            f"ISO-8601 date ({exc})"
        )


def check(snapshot_path: Path, as_of: date, max_days: int) -> int:
    collected_through = load_collected_through(snapshot_path)
    staleness = (as_of - collected_through).days
    label = f"collected_through={collected_through.isoformat()} as_of={as_of.isoformat()}"

    if staleness < 0:
        print(
            f"OK (fresh): {label}, snapshot is {-staleness} day(s) AHEAD of the "
            "reference date; treating as fresh."
        )
        return 0

    if staleness > max_days:
        print(
            f"FAIL (stale): {label}, snapshot is {staleness} day(s) old "
            f"(max {max_days}).\n"
            "The committed snapshot is what GitHub Pages deploys, so this deploy "
            "would publish stale data.\n"
            "Fix: refresh and commit the snapshot --\n"
            "  python3 scripts/export-public-dashboard-data.py --update-snapshot\n"
            "  git add src/data/public-dashboard-data.json && git commit"
        )
        return 1

    print(f"OK (fresh): {label}, snapshot is {staleness} day(s) old (max {max_days}).")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fail when the committed dashboard snapshot is stale."
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=DEFAULT_SNAPSHOT_PATH,
        help="Tracked snapshot to check (default: src/data/public-dashboard-data.json)",
    )
    parser.add_argument(
        "--as-of",
        default=None,
        help=(
            "Reference date (YYYY-MM-DD or ISO-8601 instant). In CI pass the commit "
            "timestamp; defaults to today for manual runs."
        ),
    )
    parser.add_argument(
        "--max-days",
        type=int,
        default=DEFAULT_MAX_DAYS,
        help=f"Maximum allowed staleness in days (default: {DEFAULT_MAX_DAYS})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.as_of is None:
        as_of = datetime.now(timezone.utc).date()
    else:
        try:
            as_of = parse_reference_date(args.as_of)
        except ValueError as exc:
            print(f"ERROR: --as-of {exc}")
            return 1
    if args.max_days < 0:
        print("ERROR: --max-days must be >= 0")
        return 1
    return check(args.snapshot, as_of, args.max_days)


if __name__ == "__main__":
    sys.exit(main())
