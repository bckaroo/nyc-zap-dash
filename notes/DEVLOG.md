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
  (Hermes cron `6a38ad31e5c2`, `45 6 * * 1`, America/New_York, no-agent, delivered to
  bot-chat:ops — starts 45 minutes after the 06:00 collector and waits if it is still running). It re-exports the
  snapshot from the canonical DB; if it changed, it commits to `snapshot/dashboard-<date>`,
  opens a PR, requests squash auto-merge only (no direct-merge fallback; refusal
  leaves the PR open and exits non-zero), and then **verifies the Pages run by matching the merge
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

Record notes from the ops run that exercised the job end to end:

- Auto-merge does not weaken the gate, it only moves it — and since 2026-11-02 the
  gate sits *before* the merge. `pr-check.yml` runs `snapshot-freshness` on
  `pull_request`, `main` requires that context, and auto-merge therefore waits on it:
  the snapshot PR cannot land with stale data. `deploy-pages.yml` still triggers on
  `push` to `main` only, and keeps firing the freshness check afterwards as a second,
  post-merge backstop. The job never falls back to a direct squash merge: if the
  auto-merge request is refused, it dies and leaves the PR open for a human.
- Two ordering facts that cost a run each, recorded so they are not rediscovered:
  the required status check can only be required after it has reported on a real PR
  (requiring a never-run context blocks every merge, including the snapshot job's);
  and `gh pr merge --auto` *queues* the merge, so the PR is still `OPEN` immediately
  afterwards — reading `mergeCommit` right away returns null and is a bug, not a
  refusal. Poll for `state == MERGED` before verifying the Pages run.
- Record correction, not a history rewrite: commit `bf87557` ("DEV-52003: refresh
  public dashboard snapshot through 2026-11-01 (#1)") cites a task id that does not
  exist on the DevOS board (`devos show DEV-52003` → task not found; PROJ-002 stops
  at DEV-340). The work it carries is DEV-339. Left in place because it is already
  on `main` and rewriting a pushed commit costs more than the wrong id does.

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

### Follow-up polish (same day)

Visual QA of the deployed Pages copy at 1280px showed the card rendering correctly
(12 stacked bars, one-line labelled legend, no clipping) with one readability wart:
the panel note said Nov '26 was incomplete *and* the chart repeated "shows no
entries yet" underneath. The redundant chart note is gone, and the panel note now
also states the right-censoring caveat — the newest months can still grow as ZAP
publishes later milestones — so a reader does not mistake the last two bars for a
collapse in filings. Pages deploy 41372336040 succeeded and the live copy was
re-read and screenshotted after the change.

## 2026-11-02 — t_f4d30975 integration: dimension toggle on the per-month card

Wired the dimension-aware trend card into the shipped dashboard and removed the
last mock/duplicate surface around it.

- `DashboardExplorer` now owns `trendDimension` state, computes
  `buildMonthlyTrend(records, collected_through, dimension)` in a memo, and passes
  it to `MonthlyTrendChart`. The panel-level `.chart-note` is gone: the component
  owns that copy (measure, dimension wording, partial month, undated exclusions),
  so the disclosure renders once.
- `MonthlyPipelineChart.tsx` deleted — `MonthlyTrendChart` supersedes it
  (identical action-mode visuals plus the toggle, states and a11y table), and two
  charts reaching for the same data is how they drift.
- Fixed a real responsive bug found during verification: `.visually-hidden` on a
  `<table>` does not clip, because table layout grows past the 1px width. The
  screen-reader table now sits inside a clipped `<div class="visually-hidden">`.
  Before the fix the page scrolled sideways to 1124px at 360px viewport width.
- `tests/dashboard-trend-integration.test.tsx` (9 tests) asserts the wiring
  against `buildMonthlyTrend` output for a seeded payload: 12-month window,
  per-row stack sums, zero month rendered as zeroes, legend/table categories
  matching the API, toggle radios, chart aria-label, single chart note, and the
  empty-snapshot path.
- Browser verification on the production build (`next start`, seeded payload,
  served through a throwaway tunnel): bar pixel heights 69px/application with
  per-month totals 3,3,2,2,1,2,2,2,3,2 = 22 (Jan and Apr render no bar at 0),
  legend 8 action codes + "Other actions (1)" roll-up, tooltip read from the DOM
  as "Aug '26 · 2 applications / 2 Renewal", toggle click flips the aria-label to
  "inferred applicant type" and the legend to the six applicant buckets with the
  same 22 total, and no console errors on load. At 360px the card itself has no
  horizontal overflow (toggle stacks, legend wraps); the map panel still does
  (pre-existing, unrelated to this card).
- Gate: 103 Vitest, 30 Python unittest, eslint, tsc and `next build` all green.

Re-verified the integration on the production build (`next start`) against the
real tracked snapshot (242 records, collected through 2026-11-02) after the card
landed, so the numbers below come from the shipped data rather than a fixture:

- Independent recount of `src/data/public-dashboard-data.json` gives Dec '25–Nov
  '26 = 25, 9, 11, 14, 14, 11, 8, 5, 8, 5, 2, 0 (window total 112, prior 101, 18
  undated). The rendered stack heights divide by the y-axis scale (9.86 px per
  application) to exactly those counts, and Nov '26 — the incomplete month with
  no entries — contributes no bar segments at all.
- Tooltip on Mar '26 read from the live DOM: "14 applications" with 4 + 4 + 2 +
  2 + 2 per action type, and the legend lists the 8 kept codes plus
  "Other actions (8)".
- Switching to Applicant type keeps the same 112 and the same per-month
  distribution, recolours to developer / city agency / nonprofit (the only three
  buckets present in this snapshot, per the D2 risk), and rewrites the aria-label
  to "stacked by inferred applicant type".
- No console errors, no pageerror and no unhandled rejection on a fresh load. At
  360px the card has zero overflowing descendants (panel width 321px); the only
  horizontal overflow on the page is the map panel's error text, which predates
  this change.

Pushed to `main` as `af65aaa` and verified on the PUBLIC Pages copy
(`https://bckaroo.github.io/nyc-zap-dash/`, deploy run 41394445580, success):

- Rendered HTML carries the card heading, the trailing/prior/change metric row
  and the `trend-dimension` radio group ("Application type" / "Applicant type").
- In a real browser, stack heights measure 25, 9, 11, 14, 14, 11, 8, 5, 8, 5, 2
  (Nov '26 empty) against the 9.857 px/application axis scale = 112, matching
  the trailing metric; the toggle swaps to developer / city agency / nonprofit
  colours and keeps the same 112.
- Measurement note: Recharts animates stack heights, and a headless tab that
  never paints freezes mid-animation (heights read ~41% of final). Take a
  screenshot between measurements before reading bar geometry.

Still outstanding (operator): bounce `zapdash.service` so 127.0.0.1:9003 serves
the new bundle - unattended runs cannot perform service lifecycle actions.

## 2026-11-02 — DEV-343: collector run ledger and the liveness assertion

`snapshot-freshness` (DEV-341) compared `collected_through` against the commit
date, and `collected_through` is `max(last_updated_date)` — a value the
collector stamps with its own run date. So the gate already measured run
recency rather than DOB filing recency. What it could not see:

- A run that succeeds but upserts nothing advances no date. In the snapshot it
  is indistinguishable from a healthy run, and from no run at all.
- Ten days of tolerance against a seven-day cadence lets a missed Monday ride a
  green check for almost two weeks.

Fixed by recording the thing the gate actually needs: a run ledger.

- `zap_collector_runs(run_id, started_at, finished_at, records_upserted, status,
  error)`. `start_run()` sweeps any unfinished row left by a crashed run into
  `status='error'` before opening the new one, so a killed process cannot leave
  a phantom live run behind. `finish_run()` writes `ok` plus the upsert count;
  zero upserts records as `ok`, because finding nothing new is a real answer.
- The exporter publishes `collector.{last_success_at, last_run_at, last_status,
  last_records_upserted}` and tolerates a database that predates the table.
- The checker asks two independent questions: staleness of the data
  (`collected_through`, `--max-days` 10, unchanged) and liveness of the
  collector (`last_success_at`, `--max-collector-age-days` 8). Both are measured
  against `--as-of` (commit date), never the wall clock. A snapshot with no
  ledger yet falls back to `collected_through` under the staleness window, so
  nothing that was green before goes red on landing.
- 22 new tests; suite at 53 Python unittest, green.
- Follow-up `b722cce` (PR #7): the gate now also fails when the most recent run
  is recorded as `error`, before the pre-ledger fallback. A failed run leaves
  every date in the snapshot written by the previous success, so both
  date-based assertions pass while the newest attempt to collect is dead — the
  one state the ledger recorded and nothing acted on. `running` stays in
  flight, not dead. Suite at 55.

Red/green on PR #6, deliberately, before merge:

- `191f4e9` — healthy ledger (nulls, pre-ledger) — `snapshot-freshness` success.
- `0261545` — `last_success_at` backdated to 2026-10-24 while `collected_through`
  stayed 2026-11-02 — success on staleness ("0 day(s) old") and **failure** on
  liveness ("last success 2026-10-24 is 9 day(s) before as_of (max 8)"). This is
  precisely the state the old gate passed.
- `6597944` — revert — success.

Backfilling historical runs was rejected: inventing rows for cycles nobody
recorded would make the ledger lie, which is the failure this card exists to
prevent. Alerting on a failed run stays out of scope; the cron exit code
already covers the loud case.

- Follow-up `62a7cc9` (PR #9): the gate now also asserts *provenance* — that
  the snapshot was exported by a run which had already finished. Ops rehearsed
  the hole: a collector that starts and never finishes leaves its row open and
  `last_success_at` pointing at the previous cycle, so Monday 06:45 prints
  "OK (live) ... 7 day(s) before as_of (max 8)" and deploys last cycle's
  numbers, only reddening the following Monday at 14 days. The discriminator is
  the lag between the snapshot's own `generated_at` and `collector.last_success_at`
  (`--max-export-lag-hours`, default 24): minutes when the exporter runs behind a
  working collector, a full cycle when it runs against a DB no recent run wrote.
  Measured against `generated_at` rather than `--as-of` so the verdict belongs to
  the snapshot and an old commit keeps the verdict it was built with. An export
  that *predates* the last success is not a failure, and a snapshot without
  `generated_at` skips the assertion rather than inventing one. Suite at 60.
  Red test on PR #9 (`de0bd6e`, reverted `a7aaa70`): the tracked snapshot mutated into the hang shape
  — every date fresh, `status=running`, `last_success_at` a cycle back — failed
  in 4s on provenance alone while staleness and liveness both printed OK.

- Follow-up `ea069bc` (PR #11): the payload carries the evidence ops asked for, rather
  than the gate inferring it. `collector.exported_at` is the exporter's own clock (it
  equals the payload's `generated_at`) and `collector.recent_runs` is the newest eight
  runs, newest first, each `{started_at, finished_at, status, records_upserted}`. The
  four summary fields are unchanged. Two reasons it is the payload's job and not the
  gate's:

  `exported_at - last_success_at` is the hang discriminator expressed as data rather
  than as an assertion — minutes when the exporter follows a live collector, a full
  cycle when it follows a run that never finished. A consumer can compute it without
  knowing our defaults.

  `recent_runs` lets a zero-upsert streak be judged from the artifact instead of
  inferred from a single row. Ops had called per-run history superseded; they reversed
  that when they saw they needed the streak, and reversal is theirs to make — eight
  rows is two months of weekly coverage and still small enough to serve to a browser,
  so the payload stays a snapshot and unbounded history stays in the database.

  A run that never finished exports `finished_at: ""`, the payload's existing convention
  for absent values, so a hang is visible without inventing a timestamp. Fields absent
  from an older export stay valid, `validate_collector_state` rejects a malformed run
  list at export time rather than turning a downstream liveness check into a
  `TypeError`, and the tracked snapshot is deliberately not regenerated here — it gains
  the new shape on the next real collector run. Suite at 70.

- **The round trip, and what it cost: merged `ea069bc`, reverted `a837c4a`, restored here.**
  Ops sent "do not add a runs list" while the merge was already in flight and I reverted it
  before that message's reply could land; they then decided the opposite — keep it, because
  removing eight rows costs another PR and a round of review and the design is sound. Both
  messages were honest and neither was a disagreement; it was two people acting on
  different snapshots of the same conversation. The cost of guessing wrong in the
  reversible direction was one `git revert` each way, which is the argument for keeping
  published-surface additions append-only and independently revertible rather than
  bundled with the thing they serve.

  The decision now carries a constraint, recorded here and in a comment beside
  `RECENT_RUN_LIMIT` so it cannot be re-litigated by whoever touches that file next: **the
  cap stays at 8 and never becomes "all runs"; any widening of the shape — a new field, a
  larger cap, a different row shape — goes back to ops before it lands.** A payload served
  to a browser is a permanent commitment to every consumer of it, and ops owns that
  surface, not the collector lane.

  Ops also corrected their own framing, unprompted, and the correction is worth keeping:
  `exported_at` is the same number as `generated_at` by construction, with a test pinning
  the equality — so they will assert from the artifact side anyway, on the principle that
  they should not be depending on our defaults being right. Two fields carrying one number
  is duplication; a consumer that verifies rather than assumes is not. Suite at 70.

- **`finished_at` on a swept row is a declaration time, not a death time.** Ops found this
  by arithmetic on the live export rather than by reading my code: the swept row's
  `finished_at` is 13:52:22.581400, bit-identical to the *next* run's `started_at`, because
  the crash sweep stamps a hung row with the start of the run that finally noticed it. Two
  consequences, both now stated where the fields are defined and pinned by tests:

  1. **Duration is meaningless for a swept row.** Mine reads 441.6 s only because the
     timeout happened to be minutes. A Monday run swept the following Monday would publish
     604,800 s, and anyone graphing start-to-finish time would be reading a week-long
     collection that lasted no such thing.
  2. **`last_run_at` is not evidence of activity**, for the same reason — on a swept row it
     is the sweep boundary, so it looks freshly touched while the work behind it is a cycle
     old. Liveness has to key on `last_success_at`, which only ever comes from an `ok` row.

  Rule, written into `start_run`, `read_collector_state`, and beside the gate's use of
  `last_run_at`: **never derive "did this run finish" from `finished_at` arithmetic, and
  never read recency off `last_run_at`; key both on `status` plus `last_success_at`.** The
  gate already did that, so nothing was broken — the defect was that a consumer could not
  have known. A field whose name promises an event and whose value records a declaration is
  worse than a missing field, because it invites exactly the arithmetic ops did.

  Suite at 72 (both new tests fail if the sweep is ever "fixed" to invent a death time, or
  if the exporter starts deriving recency from `last_run_at`).

- **Standing rule, from @spec: the published payload is a data contract, not code.** A
  change to the *shape* of `src/data/public-dashboard-data.json` — a new field, a rename, a
  removal, a type change, a changed cap — gets its own planning pass before implementation
  instead of riding along with gate or collector work. Shape is ops' to call: they add, they
  withdraw, this repo implements and records. Additions must be additive, independently
  revertible, and valid-by-absence so an older snapshot still validates; the semantics ship
  with the field, including the awkward path (unfinished run, swept run, missing value).

  The three payload rounds in this task are the argument for the rule, not an exception to
  it: merged, reverted, restored, inside a day, each safe on its own and all of it noise
  that a planning pass would have spent once instead of three times. Held in
  `notes/DEVLOG.md` because the repo's `AGENTS.md` is a protected file — the same paragraph
  belongs there once a human approves the write.


- **Withdrawn: `collector.exported_at` and `collector.recent_runs`. The block is four
  summary fields again.** Ops' final call, and it supersedes the two entries above that
  describe the widened shape, the `RECENT_RUN_LIMIT` cap constraint and the
  `validate_collector_state` run-list check — all three are gone with the fields. Run
  history is a query against `zap_collector_runs` on the operator's own machine, not a
  field in a JSON a browser downloads.

  Reasons, in ops' words and mine agreeing: it had zero consumers; `exported_at` was the
  same number as the top-level `generated_at` by construction, so a consumer asserting
  provenance could always read `generated_at` instead of depending on a second copy; and
  the zero-upsert streak ops wanted to judge is a `GROUP BY` over the ledger, not eight
  shipped rows. `d2faac7` was reverted before the first real export, so the tracked
  snapshot never published the wide shape — it still carries the four nulls.

  **Rule for the next person who wants run history in the artifact: if someone proposes a
  run list again, the answer is a query, not a field.** The ledger is the record; the
  payload is a snapshot of the numbers the dashboard draws. Anything that has to be
  *interpreted* to be useful (a streak, a duration, a lag) belongs in the query that
  consumes it, because publishing it freezes our current reading of it as the only one.

  What survives from the widened round: the `finished_at` semantics entry above, which
  is about the ledger and stays true — the swept row's declaration time is a property of
  the row, not of any payload — and the gate's provenance assertion, which reads the
  top-level `generated_at` and was never coupled to `collector.exported_at`. The gate's
  hang discriminator is therefore unchanged. `validate_collector_state` went with the
  fields it checked; what remains of validation is that the block is an object when
  present, and that absence is not an error, because an older snapshot must still
  validate. Suite at 67.

- **The principle the withdrawn field was hiding, kept where it can still be read.** The
  `RECENT_RUN_LIMIT` guard protected a rule that outlives it: the published payload carries
  data plus minimal provenance; run history is a ledger query; **any widening of the payload
  comes back to ops before it lands.** That is a standing constraint on the artifact, not on
  one field, so it does not expire with `recent_runs`.

  Two things the removal taught that are worth more than the fields were. First, a test whose
  only job is to keep two copies of one value from diverging — `exported_at == generated_at`
  — is a test defending a mistake; it went with the field, and nothing was lost. Second, the
  reason to do an invisible change while it is invisible: today the tracked snapshot has no
  consumers, so the shape change costs nothing; a week from now the same edit is a public
  contract alteration. Cheap now, expensive later is the entire argument.

  **On how to read today's gate result.** The gate is green on one live assertion and three
  dormant ones. The freshness assertion (snapshot age against `collected_through`, max 10
  days) is genuinely live. The liveness assertion — the actual point of the ledger — is
  dormant until a run records itself: `035cf26` shipped the ledger at 07:43 on 2026-11-02,
  and the Monday collector run that produced the current snapshot had already happened at
  06:54, so `data/zap-applications.db` has no `zap_collector_runs` table yet and the gate
  takes its documented pre-ledger fallback. "The gate passes" overstates this week's green;
  "one live assertion and three dormant ones" is the honest sentence, and it is what belongs
  in the CI history next to the run.
