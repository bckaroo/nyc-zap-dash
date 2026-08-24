#!/usr/bin/env python3
"""
ZAP Collector — reliable weekly resync from the live ZAP API.

Source of truth: the ZAP per-project API at
    https://zap-api-production.herokuapp.com/projects/{id}
(The SODA/OpenData CSV feed is STALE — last updated ~2026-04-24 — and the
heroku /projects.csv endpoint is dead. The per-project API is the live feed.)

What this script does (NO LLM required — runs on qwen3.5-9b):
  1. Build a bounded candidate ID list: every active project already in the
     local DB + a bounded scan of recent 2026 IDs per borough.
  2. Query the live API for each candidate.
  3. Upsert every result into zap-applications.db (CREATE TABLE IF NOT EXISTS
     + INSERT OR REPLACE + a last_updated_date + newsletter_included flag).
     This DB is the stable, self-building cache.
  4. Emit zap-weekly-data.json = projects whose status/milestone changed in
     the last 7 days (selected from the live data, not fragile date math).
  5. EXIT NON-ZERO with a clear message if the API is unreachable, so the
     cron alerts instead of producing an empty newsletter.

Usage:
    python3 zap-collector.py [--db PATH] [--output PATH] [--scan-years Y1 Y2]
                             [--scan-range N] [--lookback DAYS] [--verbose]

Designed to be invoked by a no-agent cron job; stdout is the summary message.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

# ── Constants ──────────────────────────────────────────────────────────────

ZAP_API_BASE = "https://zap-api-production.herokuapp.com/projects"

# Where the stable DB lives (self-building; created if missing).
DEFAULT_DB = "/home/abuck/.openclaw/workspace/projects/newsroom/zap-newsletter/zap-applications.db"
DEFAULT_OUTPUT = "/home/abuck/.openclaw/workspace/projects/newsroom/zap-newsletter/zap-weekly-data.json"

# Borough prefix codes: M=Manhattan, K=Brooklyn, Q=Queens, X=Bronx, R=Staten Island
BOROUGH_PREFIXES = ["M", "K", "Q", "X", "R"]
DEFAULT_SCAN_YEARS = [2026, 2025]
DEFAULT_SCAN_RANGE = 100  # Reduced from 250 — DB already has recent data; this is just a freshness check

SLEEP_BETWEEN_CALLS = 0.35  # Increased from 0.2s to be more polite under load
API_TIMEOUT = 30  # Increased from 20s to handle slow API responses
RETRY_ATTEMPTS = 3
RETRY_BACKOFF = 2.0  # Increased from 1.5s to be more polite under load

COMPLETED_STATUSES = {"Completed", "completed", "Withdrawn", "withdrawn", "Disapproved"}

# What counts as "active" (worth tracking / newsworthy pool)
ACTIVE_STATUSES = {
    "Filed", "filed",
    "Noticed", "noticed",
    "In Public Review", "in public review",
    "Certified", "certified",
    "Approved", "approved",
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def log(msg, verbose=False):
    if verbose:
        print(msg, flush=True)


def fetch_project(pid, verbose=False):
    """Fetch one project from the live API. Returns parsed JSON or None (404)."""
    url = f"{ZAP_API_BASE}/{pid}"
    last_err = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "ZAPCollector/2.0")
        try:
            with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
                if resp.status == 200:
                    return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # Expected for scan misses
            last_err = f"HTTP {e.code}"
        except Exception as e:  # network blip — retry
            last_err = str(e)
        if attempt < RETRY_ATTEMPTS:
            time.sleep(RETRY_BACKOFF * attempt)
    if verbose and last_err:
        log(f"  ERR {pid}: {last_err}")
    return "ERR"  # sentinel: transient failure, not a 404


def safe_str(v, default=""):
    return v if isinstance(v, str) else (default if v is None else str(v))


def extract_project_data(pid, api_data):
    """Parse a ZAP API response into our DB/JSON row."""
    data = api_data.get("data", {})
    attrs = data.get("attributes", {})

    project_name = safe_str(attrs.get("dcp-projectname"), pid)
    borough = safe_str(attrs.get("dcp-borough"))
    public_status = safe_str(attrs.get("dcp-publicstatus"))
    brief = safe_str(attrs.get("dcp-projectbrief"))
    ulurp_non = safe_str(attrs.get("dcp-ulurp-nonulurp"))
    certified = safe_str(attrs.get("dcp-certifiedreferred"))[:10]
    noticed = safe_str(attrs.get("dcp-noticeddate"))[:10]
    applicant = safe_str(attrs.get("dcp-applicant-customer-value"))
    cd = safe_str(attrs.get("dcp-validatedcommunitydistricts"))
    ceqr = safe_str(attrs.get("dcp-ceqrnumber"))
    ceqr_type = safe_str(attrs.get("dcp-ceqrtype"))
    eas_eis = safe_str(attrs.get("dcp-easeis"))

    # Milestones with actual dates → freshest activity signal
    milestones = []
    for item in api_data.get("included", []):
        if item.get("type") != "milestones":
            continue
        ma = item.get("attributes", {})
        if ma.get("statuscode") == "Not Started":
            continue
        end = safe_str(ma.get("dcp-actualenddate"))[:10]
        start = safe_str(ma.get("dcp-actualstartdate"))[:10]
        disp = safe_str(ma.get("display-name"), safe_str(ma.get("milestonename")))
        if disp and (end or start):
            milestones.append({"name": disp.strip(),
                               "start": start, "end": end})

    # Dispositions (CB / BP recommendations + votes)
    dispositions = []
    for item in api_data.get("included", []):
        if item.get("type") != "dispositions":
            continue
        da = item.get("attributes", {})
        rec = (safe_str(da.get("dcp-communityboardrecommendation"))
               or safe_str(da.get("dcp-boroughpresidentrecommendation"))
               or safe_str(da.get("dcp-boroughboardrecommendation")))
        if not rec:
            continue
        dispositions.append({
            "body": safe_str(da.get("dcp-recommendationsubmittedby-value")),
            "recommendation": rec,
            "votes_for": da.get("dcp-votinginfavorrecommendation"),
            "votes_against": da.get("dcp-votingagainstrecommendation"),
            "date": safe_str(da.get("dcp-dateofvote"))[:10],
        })

    # Flood zone flags (boolean 0/1)
    fz_a = 1 if safe_str(attrs.get("dcp-floodzonea")).lower() in ("true", "1", "yes") else 0
    fz_shaded = 1 if safe_str(attrs.get("dcp-floodzoneshadedx")).lower() in ("true", "1", "yes") else 0

    # Newest activity date across milestones (freshest movement)
    dates = [m["end"] for m in milestones if m["end"]] + \
            [m["start"] for m in milestones if m["start"]]
    milestone_date = max(dates) if dates else ""

    return {
        "id": pid,
        "project_id": pid,
        "project_name": project_name,
        "project_brief": brief,
        "borough": borough,
        "community_district": cd,
        "public_status": public_status,
        "ulurp_non": ulurp_non,
        "ceqr_number": ceqr,
        "ceqr_type": ceqr_type,
        "eas_eis": eas_eis,
        "primary_applicant": applicant,
        "applicant_type": safe_str(attrs.get("dcp-applicanttype")),
        "flood_zone_a": fz_a,
        "flood_zone_shadedx": fz_shaded,
        "milestone_date": milestone_date,
        "certified_referred": certified,
        "noticed_date": noticed,
        "milestones": milestones,
        "dispositions": dispositions,
        "zapi_url": f"https://zap.planning.nyc.gov/projects/{pid}",
    }


# Canonical column set → type. init_db self-heals a legacy table by adding
# any missing columns, so schema drift never breaks the collector.
DB_COLUMNS = {
    "id": "TEXT PRIMARY KEY",
    "project_id": "TEXT",
    "project_name": "TEXT",
    "project_brief": "TEXT",
    "borough": "TEXT",
    "community_district": "TEXT",
    "public_status": "TEXT",
    "ulurp_non": "TEXT",
    "ceqr_number": "TEXT",
    "ceqr_type": "TEXT",
    "eas_eis": "TEXT",
    "primary_applicant": "TEXT",
    "applicant_type": "TEXT",
    "flood_zone_a": "INTEGER DEFAULT 0",
    "flood_zone_shadedx": "INTEGER DEFAULT 0",
    "milestone_date": "TEXT",
    "certified_referred": "TEXT",
    "noticed_date": "TEXT",
    "first_seen_date": "TEXT DEFAULT CURRENT_TIMESTAMP",
    "last_updated_date": "TEXT",
    "newsletter_included": "TEXT",
}


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS zap_applications (
            id TEXT PRIMARY KEY
        )
    """)
    existing = {r[1] for r in conn.execute("PRAGMA table_info(zap_applications)")}
    for col, coltype in DB_COLUMNS.items():
        if col in existing:
            continue
        conn.execute(f"ALTER TABLE zap_applications ADD COLUMN {col} {coltype}")
    conn.commit()


def upsert(conn, row, today):
    conn.execute("""
        INSERT INTO zap_applications (
            id, project_id, project_name, project_brief, borough,
            community_district, public_status, ulurp_non, ceqr_number,
            ceqr_type, eas_eis, primary_applicant, applicant_type,
            flood_zone_a, flood_zone_shadedx, milestone_date,
            certified_referred, noticed_date, last_updated_date
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            project_name=excluded.project_name,
            project_brief=excluded.project_brief,
            borough=excluded.borough,
            community_district=excluded.community_district,
            public_status=excluded.public_status,
            ulurp_non=excluded.ulurp_non,
            ceqr_number=excluded.ceqr_number,
            ceqr_type=excluded.ceqr_type,
            eas_eis=excluded.eas_eis,
            primary_applicant=excluded.primary_applicant,
            applicant_type=excluded.applicant_type,
            flood_zone_a=excluded.flood_zone_a,
            flood_zone_shadedx=excluded.flood_zone_shadedx,
            milestone_date=excluded.milestone_date,
            certified_referred=excluded.certified_referred,
            noticed_date=excluded.noticed_date,
            last_updated_date=excluded.last_updated_date
    """, (
        row["id"], row["project_id"], row["project_name"], row["project_brief"],
        row["borough"], row["community_district"], row["public_status"],
        row["ulurp_non"], row["ceqr_number"], row["ceqr_type"], row["eas_eis"],
        row["primary_applicant"], row["applicant_type"], row["flood_zone_a"],
        row["flood_zone_shadedx"], row["milestone_date"], row["certified_referred"],
        row["noticed_date"], today,
    ))


def build_candidate_ids(db_conn, scan_years, scan_range):
    """DB-known active IDs + bounded recent scan IDs."""
    ids = set()
    try:
        rows = db_conn.execute(
            "SELECT id FROM zap_applications WHERE public_status IS NOT NULL"
        ).fetchall()
        for (pid,) in rows:
            ids.add(pid)
    except Exception:
        pass  # DB may be empty/fresh

    for year in scan_years:
        for prefix in BOROUGH_PREFIXES:
            for num in range(1, scan_range + 1):
                ids.add(f"{year}{prefix}{num:04d}")
    return ids


def run(db_path, output_path, scan_years, scan_range, lookback_days, verbose):
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    cutoff = (now - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    # ── DB ──
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    init_db(conn)

    # ── API reachability check (fail loud if down) ──
    probe = fetch_project("2026M0366", verbose=False)
    if probe is None or probe == "ERR":
        conn.close()
        print("ERROR: ZAP API unreachable (probe 2026M0366 failed). "
              "Aborting to avoid an empty newsletter.", file=sys.stderr)
        sys.exit(2)

    # ── Candidates ──
    candidate_ids = build_candidate_ids(conn, scan_years, scan_range)
    log(f"Total candidate IDs: {len(candidate_ids)}", verbose)

    fetched = 0
    active = []
    completed = 0
    errors = 0
    api_failures = 0
    seen = set()

    for pid in sorted(candidate_ids):
        if pid in seen:
            continue
        seen.add(pid)
        fetched += 1
        result = fetch_project(pid, verbose)
        if result is None:
            continue  # 404 scan miss
        if result == "ERR":
            errors += 1
            api_failures += 1
            continue
        attrs = result.get("data", {}).get("attributes", {})
        status = safe_str(attrs.get("dcp-publicstatus"))
        if status in COMPLETED_STATUSES:
            completed += 1
            # Still record it so we stop re-fetching forever
            row = extract_project_data(pid, result)
            upsert(conn, row, today)
            continue
        row = extract_project_data(pid, result)
        upsert(conn, row, today)
        active.append(row)
        log(f"  OK {pid} | {row['project_name'][:45]} | {status}", verbose)
        time.sleep(SLEEP_BETWEEN_CALLS)
        if verbose and fetched % 50 == 0:
            print(f"  ...{fetched}/{len(candidate_ids)} fetched, "
                  f"{len(active)} active, {completed} done, {errors} err",
                  flush=True)

    conn.commit()

    # ── Select THIS WEEK's pool (from live data, not fragile date math) ──
    # A project is "this week" if it was first seen this week OR its milestone
    # date or certified/referred date fell in the last 7 days.
    week_pool = []
    for row in active:
        is_week = False
        reasons = []
        if row["milestone_date"] and row["milestone_date"] >= week_start:
            is_week = True
            reasons.append(f"milestone {row['milestone_date']}")
        if row["certified_referred"] and row["certified_referred"] >= week_start:
            is_week = True
            reasons.append(f"certified {row['certified_referred']}")
        if row["noticed_date"] and row["noticed_date"] >= week_start:
            is_week = True
            reasons.append(f"noticed {row['noticed_date']}")
        # Freshly seen in DB this run
        seen_row = conn.execute(
            "SELECT first_seen_date FROM zap_applications WHERE id=?",
            (row["id"],)).fetchone()
        if seen_row and seen_row["first_seen_date"] >= week_start:
            is_week = True
            reasons.append("new to DB")
        if is_week:
            row["week_reasons"] = reasons
            week_pool.append(row)

    conn.close()

    output = {
        "generated_at": now.isoformat(),
        "week_start": week_start,
        "week_end": today,
        "api_source": ZAP_API_BASE,
        "db_path": db_path,
        "totals": {
            "candidates": len(candidate_ids),
            "fetched": fetched,
            "active_tracked": len(active),
            "completed_seen": completed,
            "api_errors": errors,
        },
        "week_projects": sorted(week_pool, key=lambda p: p["id"]),
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ ZAP collector complete:")
    print(f"   Candidates:   {len(candidate_ids)}")
    print(f"   Fetched:      {fetched}")
    print(f"   Active:       {len(active)}")
    print(f"   Completed:    {completed}")
    print(f"   API errors:   {errors}")
    print(f"   THIS WEEK:    {len(week_pool)} projects")
    print(f"   DB:           {db_path}")
    print(f"   Output:       {output_path}")
    if not week_pool:
        print("   ⚠️  No projects with activity in the last 7 days. "
              "Generator should still run (397b can pick newsworthy from active pool).")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZAP weekly collector")
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--scan-years", nargs="+", type=int, default=DEFAULT_SCAN_YEARS)
    parser.add_argument("--scan-range", type=int, default=DEFAULT_SCAN_RANGE)
    parser.add_argument("--lookback", type=int, default=60,
                        help="Milestone lookback window (days) for DB freshness")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    run(args.db, args.output, args.scan_years, args.scan_range,
        args.lookback, args.verbose)
