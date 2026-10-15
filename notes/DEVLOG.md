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
