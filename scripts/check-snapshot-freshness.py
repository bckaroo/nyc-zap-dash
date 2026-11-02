#!/usr/bin/env python3
"""Fail the build when the committed public dashboard snapshot is stale or unrefreshed.

The GitHub Pages deploy builds from the tracked snapshot
(``src/data/public-dashboard-data.json``), not from a live database: CI has no
``data/`` DB, so the exporter falls back to whatever snapshot is committed. That
means a green deploy can ship arbitrarily old data. This gate turns that silent
failure into a red run.

Two independent questions are asked, because they fail differently:

1. **Staleness** -- is the data in the snapshot old? Measured on
   ``collected_through`` (``max(last_updated_date)`` across records) against
   ``--max-days``. This is the original DEV-341 check.
2. **Liveness** -- did a collector run actually succeed recently? Measured on
   ``collector.last_success_at`` from the run ledger against
   ``--max-collector-age-days``. ``collected_through`` alone cannot answer this:
   it advances only when records are written, so a successful run that found
   nothing new is indistinguishable from no run at all, and a wide staleness
   window hides a collector that stopped days ago.

When the snapshot predates the ledger (no ``collector.last_success_at``), liveness
falls back to ``collected_through`` under the staleness threshold -- exactly the
pre-ledger behaviour, so landing this check never reddens a snapshot that was
green before. Once the collector records a run, the stricter liveness window
applies automatically.

The comparison reference is always the **commit/build date** (``--as-of``), never
the runtime wall clock, so re-running an old workflow compares against when that
commit was built instead of today.

Exit codes: 0 = fresh and live, 1 = stale, dead, missing or unreadable.
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
# Weekly collector cadence (Mondays 06:45). 8 days tolerates a weekend of drift and a
# slow deploy cycle while still failing when a whole collection cycle is missed.
DEFAULT_MAX_COLLECTOR_AGE_DAYS = 8

REFRESH_HINT = (
    "Fix: refresh and commit the snapshot --\n"
    "  python3 scripts/export-public-dashboard-data.py --update-snapshot\n"
    "  git add src/data/public-dashboard-data.json && git commit"
)


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


def load_snapshot(snapshot_path: Path) -> dict:
    if not snapshot_path.is_file():
        raise SystemExit(f"ERROR: snapshot not found: {snapshot_path}")
    try:
        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ERROR: cannot read snapshot {snapshot_path}: {exc}")
    if not isinstance(payload, dict):
        raise SystemExit(f"ERROR: snapshot {snapshot_path} is not a JSON object")
    return payload


def load_collected_through(snapshot_path: Path) -> date:
    return read_collected_through(load_snapshot(snapshot_path), snapshot_path)


def read_collected_through(payload: dict, snapshot_path: Path) -> date:
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


def read_collector(payload: dict) -> dict:
    collector = payload.get("collector")
    return collector if isinstance(collector, dict) else {}


def check(
    snapshot_path: Path,
    as_of: date,
    max_days: int,
    max_collector_age_days: int,
) -> int:
    payload = load_snapshot(snapshot_path)
    collected_through = read_collected_through(payload, snapshot_path)
    collector = read_collector(payload)
    label = f"collected_through={collected_through.isoformat()} as_of={as_of.isoformat()}"

    staleness = (as_of - collected_through).days
    if staleness > max_days:
        print(
            f"FAIL (stale): {label}, snapshot is {staleness} day(s) old "
            f"(max {max_days}).\n"
            "The committed snapshot is what GitHub Pages deploys, so this deploy "
            "would publish stale data.\n" + REFRESH_HINT
        )
        return 1

    if staleness < 0:
        print(
            f"OK (fresh): {label}, snapshot is {-staleness} day(s) AHEAD of the "
            "reference date; treating as fresh."
        )
    else:
        print(f"OK (fresh): {label}, snapshot is {staleness} day(s) old (max {max_days}).")

    return check_liveness(payload, collector, as_of, staleness, max_collector_age_days)


def check_liveness(
    payload: dict,
    collector: dict,
    as_of: date,
    staleness: int,
    max_collector_age_days: int,
) -> int:
    raw_success = collector.get("last_success_at")
    last_status = collector.get("last_status")
    last_run_at = collector.get("last_run_at")
    run_context = (
        f"last_run_at={last_run_at or 'never'} status={last_status or 'unknown'}"
        f" records={collector.get('last_records_upserted', 'unknown')}"
    )

    # A recorded failure is a failure on its own, however fresh the dates look. A run
    # that errored means the most recent attempt to collect died, so this snapshot is
    # at least one cycle behind whatever the last good run wrote. Nothing else asserts
    # it: the dates were all written by the previous successful run and stay current
    # until they age past the window. Checked before the pre-ledger fallback because a
    # ledger that has recorded only failures still has nothing older to fall back to.
    if last_status is not None and str(last_status).strip().lower() == "error":
        print(
            "FAIL (collector run failed): the most recent collector run recorded "
            f"status=error. {run_context}\n"
            "The snapshot still carries the dates of the last successful run, so the "
            "staleness and collector-age assertions cannot see this on their own.\n"
            "Fix: get the collector running again, then --\n"
            "  python3 scripts/zap-collector.py\n"
            "  python3 scripts/export-public-dashboard-data.py --update-snapshot"
        )
        return 1

    if raw_success is None or (isinstance(raw_success, str) and not raw_success.strip()):
        print(
            "OK (live): no collector run recorded in this snapshot (pre-ledger "
            f"snapshot); falling back to collected_through, {staleness} day(s) old "
            f"(max {max_collector_age_days} via the staleness window).\n"
            "  The ledger starts recording on the next collector run; after that "
            "liveness is measured directly."
        )
        return 0

    try:
        success_at = parse_reference_date(str(raw_success))
    except ValueError as exc:
        print(
            f"ERROR: collector.last_success_at={raw_success!r} is not an ISO-8601 "
            f"date ({exc})"
        )
        return 1

    age = (as_of - success_at).days
    if age < 0:
        print(
            f"OK (live): last successful collector run {success_at.isoformat()} is "
            f"{-age} day(s) AFTER the reference date; treating as live. {run_context}"
        )
        return 0

    if age > max_collector_age_days:
        print(
            f"FAIL (no recent collector run): last success "
            f"{success_at.isoformat()} is {age} day(s) before as_of "
            f"(max {max_collector_age_days}). {run_context}\n"
            "collected_through can still look recent while the collector is dead, "
            "because a snapshot keeps whatever dates it was last written with.\n"
            "Fix: get the collector running again, then --\n"
            "  python3 scripts/zap-collector.py\n"
            "  python3 scripts/export-public-dashboard-data.py --update-snapshot"
        )
        return 1

    print(
        f"OK (live): last successful collector run {success_at.isoformat()} is "
        f"{age} day(s) before as_of (max {max_collector_age_days}). {run_context}"
    )
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fail when the committed dashboard snapshot is stale or unrefreshed."
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
    parser.add_argument(
        "--max-collector-age-days",
        type=int,
        default=DEFAULT_MAX_COLLECTOR_AGE_DAYS,
        help=(
            "Maximum allowed age of the last successful collector run, from the "
            f"run ledger (default: {DEFAULT_MAX_COLLECTOR_AGE_DAYS})"
        ),
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
    if args.max_collector_age_days < 0:
        print("ERROR: --max-collector-age-days must be >= 0")
        return 1
    return check(
        args.snapshot, as_of, args.max_days, args.max_collector_age_days
    )


if __name__ == "__main__":
    sys.exit(main())
