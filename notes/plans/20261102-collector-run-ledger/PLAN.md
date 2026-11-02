# PLAN — DEV-343: collector run ledger + liveness assertion

Status: approved by @spec (2026-11-02). Owner: builder.

## Why

`snapshot-freshness` (DEV-341) proves the committed snapshot is not stale against
`collected_through`. Investigation showed `collected_through` is `max(last_updated_date)`,
stamped by the collector with its own run date — so the gate already tracks run recency,
not DOB filing recency. Two holes remain:

1. A run that succeeds but upserts nothing advances no date. It is indistinguishable in
   the snapshot from a healthy run, and from no run at all.
2. 10 days of tolerance against a 7-day cadence lets a Monday pull ride a green check for
   almost two weeks.

## Build

1. `zap-collector.py`
   - New table `zap_collector_runs(run_id, started_at, finished_at, records_upserted, status, error)`.
   - `start_run()` sweeps any unfinished rows left by a crashed previous run into
     `status='error'`, then inserts the new row as `running`.
   - Probe failure records `status='error'` before `sys.exit(2)`; success records
     `status='ok'` with the upsert count immediately after the final `commit()`.
   - `enrich_geography_only` is left uninstrumented: it is a geometry backfill, not the
     freshness cycle, and must not paper over a dead main run.
2. `export-public-dashboard-data.py`
   - `read_collector_state()` reads the ledger read-only and tolerates the table being
     absent (older DBs) by returning nulls.
   - Payload gains `collector: {last_success_at, last_run_at, last_status, last_records_upserted}`.
3. `check-snapshot-freshness.py`
   - Liveness date = `collector.last_success_at`, falling back to `collected_through` when
     the ledger field is absent or null (pre-instrumentation snapshots keep equivalent
     strength instead of regressing to a pass).
   - New `--max-collector-age-days`, default 8: tolerates weekend drift and deploy lag,
     fails when a full weekly cycle is missed.
   - Still measured against `--as-of` (commit date), never wall clock.

## Proof

- Unit tests for every new branch, including "collector stale while collected_through is
  still within the old window" — the hole this closes.
- Red path on a real PR: backdate `collector.last_success_at`, watch `snapshot-freshness`
  fail, revert.
- Green path on the same PR with a healthy ledger.

## Out of scope

- Alerting on a failed collector run (cron exit code already covers the loud case).
- Backfilling historical runs: inventing run rows for cycles nobody recorded would make
  the ledger lie, which is the failure this task exists to prevent.
