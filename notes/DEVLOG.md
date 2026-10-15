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
