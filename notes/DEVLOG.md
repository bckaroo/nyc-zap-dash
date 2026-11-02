# ZapDash development log

## 2026-08-24 — DEV-032

Migrated the authoritative operational runbook, collector, dashboard-export
script, and durable source-history documentation into the canonical ZapDash
repository. The newsroom project directory remains the preserved operational
store for generated data and drafts. Added architecture, workflow, and data
contract documentation to make the current Monday collection → draft → human
approval flow explicit.

## 2026-10-14 — DEV-034, Phase 1 MVP

Replaced the live OpenData-dependent landing page with a statically prerendered
Phase 1 dashboard sourced from the canonical local SQLite feed. The build now
runs the privacy-safe exporter automatically, publishes source/freshness and
coverage disclosures, adds citywide metrics, borough and Community District
activity filtering, a searchable application/detail view with official ZAP
links, and the trailing-12-month **Most active named applicants** view with an
explicit warning that the named applicant is not necessarily the developer.

Added deterministic exporter coverage plus analytics and public-label tests.
Verification on the 216-record 2026-10-14 local snapshot:

- `npm test` — PASS: 7 Vitest tests and 1 Python unittest.
- `npm run lint` — PASS: 0 errors, 0 warnings.
- `npm run build` — PASS: Next.js 16.2.3 compiled, type-checked, and statically
  prerendered `/`; exporter wrote 216 records before the build.
- Production browser QA at 1440×1100 and 390×844 — no horizontal overflow at
  either width; all 216 project links rendered. Search for `6418` returned one
  expected record and its official ZAP link; the Brooklyn filter returned 51
  Brooklyn-only records.

No deployment, commit, push, CRM write, external enrichment, or email action
was performed.

## 2026-10-14 — DEV-034, Phase 1 review corrections

An independent review rejected the first implementation with five findings; all
were addressed with regression tests written first:

- **Critical:** `activity_date` previously took the max of milestone,
  certified/referred, and first-seen dates, letting recent collector discovery
  override substantive dates and pulling all 216 records into the
  trailing-12-month window. Activity date is now a strict fallback (milestone →
  certified/referred → first-seen); a first-observed date never overrides a
  milestone or certification date.
- Added a seven-day "Current filings and weekly highlights" window, an 18-month
  zero-filled trend, tabular chart equivalents, visible mobile field labels,
  and a details affordance.
- Rolling-12-month analytics are anchored to `collected_through` (UTC
  date-only, inclusive boundary), not `generated_at`.
- Added explicit empty/stale dataset rendering plus a staleness note.
- **Deployment contract:** the operational SQLite DB stays out of Git;
  `npm run build` regenerates the allowlisted feed and refreshes a tracked
  privacy-safe snapshot at `src/data/public-dashboard-data.json` (gitignore
  exempted). Clean checkouts and CI build from the committed snapshot; missing
  database and snapshot fails with a clear nonzero exit.

Verification (2026-10-14): `npm test` PASS — 10 Vitest + 6 Python tests;
`npm run lint` PASS; `npm run build` PASS (216-record export + snapshot
refresh; Next.js static prerender of `/`); `git diff --check` PASS;
`git check-ignore` confirms `src/data/public-dashboard-data.json` is
trackable. Data audit: 216 records, 0 duplicate IDs, 0 records whose
activity date was sourced from first-seen while a substantive date existed.
Clean-checkout verification: with `data/zap-applications.db` temporarily
removed, `npm run build` succeeded entirely from the tracked snapshot fallback
and the snapshot payload matches the canonical export exactly.

No deploy, push, CRM write, or email action was performed; the tracked
snapshot is uncommitted pending review.

## 2026-10-14 — DEV-034, persistent dashboard launch

Promoted ZapDash from a verified build to an always-on dashboard using the
centrally assigned port 9003. Registered the live service in the shared port
registry, created and enabled `zapdash.service`, bound Next.js to
`127.0.0.1:9003`, and added a tailnet-only Tailscale Serve route at
`https://vengeance.tail92bcba.ts.net:9003/`.

Live verification after the final CSS repair:

- Local and tailnet requests both returned HTTP 200 with the 580 KB rendered
  page.
- `zapdash.service` is enabled and active; the port registry reports ZapDash
  ONLINE with the expected Next.js process.
- Browser verification against the tailnet URL rendered the ZapDash title,
  216 application detail controls, and 229 official ZAP links.
- Desktop (800 px) and mobile (390 px) checks both reported zero horizontal
  overflow after adding explicit minimum-width containment to the dashboard
  grid; mobile rendered semantic field labels and detail affordances.
- `npm test`, `npm run lint`, and `npm run build` passed before the service
  restart. No email or CRM action was performed.

## 2026-10-14 — DEV-296, authoritative geography map and applicant drill-down

Added a three-scale MapLibre geography view without changing ZapDash's activity
dataset. Low zoom renders distinct-project borough counts, borough scale renders
distinct-project Community District counts, and zoom 11+ renders only points
derived from authoritative ZAP BBL polygons. Added complete action-type color
legend, source/coverage disclosures, popups linked to official ZAP records, and
an accessible geography table. Tracked simplified NYC Open Data borough and all
59 numbered Community District boundaries as cartographic reference only.

Expanded the trailing-12-month top-10 named-applicant list into keyboard-
operable ARIA accordions. Each panel lists exactly the records used in that
applicant's count and links every project to its official ZAP page. No external
application, development, or permit dataset was introduced.

Ran the constrained DB-only geography enrichment against the 216 existing
application IDs. Results: 207 projects located, 8 returned without usable ZAP
geometry, 1 stored ID was not found by the live API, and 0 API errors. The
public snapshot reports 207 located projects, 425 authoritative site points,
and 9 unmatched/unlocated projects. The operational table remained 216 rows
with 216 distinct IDs.

Final verification:

- `npm test` — PASS: 17 Vitest tests and 13 Python unittests.
- `npm run lint` — PASS with no errors or warnings.
- `npm run build` — PASS: 216-record export/snapshot refresh, TypeScript, and
  static prerender of `/`.
- Snapshot-only `npm run build` with the operational DB temporarily absent —
  PASS; output matched the tracked snapshot byte for byte, and the restored DB
  checksum matched its pre-test checksum.
- `git diff --check` — PASS.
- Restarted the existing `zapdash.service` without changing its unit or port.
  The enabled service is active on `127.0.0.1:9003`; local and tailnet requests
  returned HTTP 200 with identical 839,798-byte HTML.
- Live tailnet browser QA rendered the borough choropleth and high-zoom colored
  ZAP site dots with no map error, 19 action legend entries, 55 geography
  fallback rows, and all 10 applicant accordions. The first accordion declared
  and listed exactly 8 projects. Desktop and 390×844 mobile checks had zero
  horizontal overflow.

No commit, push, CRM write, or email action was performed.

## 2026-10-15 — light grayscale basemap

Added `scripts/generate-basemap-style.cjs`, which writes the keyless
`public/data/basemap-grayscale.json` used by `GeographyMap`. The style uses
Esri World Light Gray raster tiles (light greyscale streets, water, and
labels). A Protomaps vector approach was tried first and abandoned because
build.protomaps.com sends no CORS headers (browser tile fetch fails) and
`@protomaps/basemaps` 5.7.2 emits sparse-array holes in paint colors that
MapLibre v5 strict validation rejects, aborting style load.

## 2026-11-01 — DEV-337–DEV-340, dashboard staleness and pipeline closure

Closed the two broken links in the weekly chain: nothing failed when the tracked
snapshot went stale, and nothing refreshed it after the collector ran.

- **DEV-337 — staleness gate (commit 0fa24ff).** `scripts/check-snapshot-freshness.py`
  reads `collected_through` from `src/data/public-dashboard-data.json` and fails when
  it is more than `--max-days` (default 10) behind a reference date. Wired into
  `.github/workflows/deploy-pages.yml` as its own step after `npm ci`, with
  `--as-of "${{ github.event.head_commit.timestamp || github.run_started_at }}"`.
  The reference is the **commit/build date, not the runtime date**, so re-running an
  old commit cannot silently pass. `tests/test_check_snapshot_freshness.py` covers
  fresh, exactly-at-limit, stale, missing and unreadable snapshots plus the
  `--max-days` override and the default path.
- **DEV-338 — `--workers` (commit 36d8d8f).** `scripts/zap-collector.py run()` now
  takes `workers` (default 1, so behaviour is unchanged) and fetches candidates in a
  `ThreadPoolExecutor`. `_fetch_one` does network only; every SQLite write stays on
  the main thread in `_absorb`, because a shared `sqlite3` connection is not
  thread-safe. `SLEEP_BETWEEN_CALLS` now paces successful bodies only — 404 scan
  misses are free. `tests/test_zap_collector_workers.py` asserts serial and
  `--workers 2` produce identical rows, totals and week pool (timestamps excluded).
- **DEV-339 — weekly snapshot PR.** `~/.hermes/profiles/ops/scripts/zap-snapshot-pr.sh`
  (Hermes cron `6a38ad31e5c2`, `15 6 * * 1`, America/New_York, no-agent, delivered to
  bot-chat:ops — runs 15 minutes after the 06:00 collector). It re-exports the
  snapshot from the canonical DB; if it changed, it commits to `snapshot/dashboard-<date>`,
  opens a PR, merges (auto-merge, falling back to a direct squash merge when the repo
  does not allow auto-merge), and then **verifies the Pages run by matching the merge
  commit SHA** rather than accepting that "a run exists". First live run:
  PR #1 → squash-merged `bf87557` (that squashed commit message still reads
  `DEV-52003`, a mis-transcribed id from the first report; DEV-339 is the board
  task and is what the script now cites by default) → run 41360512800, `success`. Failures are loud
  (non-zero exit, no silent skip) for missing gh auth, missing DB, or an unrelated
  dirty tracked tree.
- **DEV-340 — archive the duplicate newsroom pipeline.** Moved
  `projects/newsroom/zap-newsletter/` to
  `projects/newsroom/_archived/zap-newsletter-2026-11-01/` and added `DEPRECATED.md`
  naming `dev/zap` as the only runnable pipeline. Nothing was deleted, and no cron
  job, script or skill in the ops profile referenced the old path.

Verification: `npm test` — 18 JS tests pass, 29 Python tests pass, "OK". Collector
worker parity suite 3/3 in 14.16s (template-DB setup: `init_db` issues one
`ALTER TABLE` per column at ~0.2s of fsync each on this filesystem, so the schema is
built once per class and copied per test instead of rebuilt 26 times).

Deviations accepted, recorded as follow-ups (not blockers):

- `zap-snapshot-pr.sh` lives at `~/.hermes/profiles/ops/scripts/` per the plan's
  artifact map, so it is **not versioned in this repo** and can drift from `main`
  without anyone noticing. Consider committing a copy under `scripts/` and having
  the cron job exec that, leaving the profile path as a thin wrapper.
- The job opens a PR on **every** run, including weeks where no application data
  changed, because the exporter always rewrites `generated_at`. That keeps the
  freshness disclosure honest but is weekly PR noise; a future refinement is to
  compare everything except `generated_at` and skip when only that moved.

## 2026-11-01 — Board task t_1876a925: trailing-12-month pipeline-entry card

Added the market-trend card: **Applications entering the pipeline per month**, a
stacked bar chart over the rolling 12 months ending at `collected_through`,
stacked by the application's primary ZAP action type (the first listed code, the
same convention the map colours by), with a prior-12-month baseline and
year-over-year change.

The measure required a new data contract, because none of the existing dates can
answer "how many applications started that month":

- `milestone_date` is the **latest** milestone, so counting by it pushes old
  projects into the current month and manufactures growth. It remains the right
  signal for freshness and the weekly feed; it is wrong for trends.
- `first_seen_date` is a collector artifact (everything is stamped since 2026-07-01).

The ZAP per-project API already returns the full milestone history, which the
collector parsed but discarded. The collector now persists `pipeline_start_date`
(earliest actual milestone date — pipeline entry) and `milestones_json` (full
history, unused by the dashboard yet), self-healing both columns via `init_db`;
`update_geography` refreshes them too so `--enrich-geography-only` can backfill
without a scan. The exporter publishes `pipeline_start_date` as an allowlisted
public field.

Card behaviour: each application counts once, in its entry month, so stack height
equals applications entering review that month (no double counting for
multi-action filings); the eight largest action types are kept and the tail folds
into "Other actions (n)"; records with no milestone date are excluded and counted
in the note (18 of 242 in the 2026-11-02 collection). The collection month is
disclosed as incomplete.

Verification (2026-11-02 collection): `npm test` PASS — 25 Vitest (19 dashboard
analytics + 6 map) and 30 Python tests; `npm run lint` clean; `npm run build`
PASS. Live card reads 112 trailing-12-month entries against 101 in the prior year
(+11%) for Dec '25–Nov '26. Screenshot QA at 1280px confirmed 12 labelled bars, a
single-line legend, and no clipping.

Operational follow-up: the systemd service was **not** restarted from this
unattended run — run `systemctl --user restart zapdash.service` to serve the new
build on 127.0.0.1:9003 and the tailnet route.

## 2026-11-02 — t_1876a925 verification and publication

Second pass on the same card, after the first run exhausted its iteration budget
with the code committed but the refreshed snapshot still unstaged.

- Re-ran the full gate on the committed tree: 25 Vitest (19 analytics, 6 map) and
  30 Python tests PASS, `npm run lint` clean, `npm run build` PASS. The build
  re-exported the feed (242 records, 224 with `pipeline_start_date`, earliest
  2023-06, `collected_through` 2026-11-02) and rewrote the tracked snapshot, which
  is the 470-insertion change now committed.
- Live render verified against a throwaway `next start -p 9317` instance, because
  an unattended run cannot `systemctl --user restart` (blocked by the approval
  guard) and must not disturb the port-9003 service. The rendered panel reads
  Dec '25–Nov '26 · 112 applications entered the review pipeline, prior 12 months
  101, change +11%, with both disclosures (Nov '26 incomplete; 18 records carry no
  milestone date and are excluded).
- Snapshot + this entry committed and pushed; the Pages workflow deploys from
  `main`, so the public copy picks the card up on the same push.

Still open for the operator: `systemctl --user restart zapdash.service` to put the
new build on 127.0.0.1:9003 and the tailnet route (the served bundle predates the
card until then).
