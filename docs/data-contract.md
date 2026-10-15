# ZAP data contract

## Canonical collection outputs

`scripts/zap-collector.py` writes the following operational artifacts:

- `zap-applications.db` — persistent SQLite cache of observed projects,
  milestones, statuses, and collection metadata.
- `zap-weekly-data.json` — handoff document for the weekly draft generator.

Default paths point to the repository's gitignored `data/` directory. Any path
migration must change the collector, cron, dashboard export, and runbook
together.

## Public dashboard export

`scripts/export-public-dashboard-data.py` reads the canonical
`data/zap-applications.db` and writes
`data/public-dashboard-data.json`. `npm run build` invokes the exporter before
Next.js statically prerenders the dashboard. No manual JSON editing is part of
the build.

The public export is allowlisted. It excludes local file paths,
`newsletter_included`, drafts, recipients, and other operational metadata. It
adds only two derived fields: an official `source_url` and `activity_date`,
selected deterministically from milestone date, certification/referral date,
then first-seen date — a first-observed date never overrides a substantive
date. Export metadata identifies the source, export time, and latest
collection date.

When run with `--update-snapshot`, the exporter also writes the identical
payload to the tracked snapshot `src/data/public-dashboard-data.json`
(gitignore-exempted). With the canonical database absent, the exporter
copies that snapshot to the output path instead — clean-checkout and CI
builds therefore never need the operational database. Missing database and
snapshot is a hard, nonzero exit. An empty database yields a valid zero-record
payload, and the dashboard surfaces empty and stale datasets explicitly.

## Valid weekly JSON

A publishable handoff must include a current `generated_at`, correct weekly
bounds, nonzero collection evidence, totals, and a `week_projects` selection
with explicit `week_reasons`. An empty active set after a successful scan is
an invalid result, not a quiet week. A collector failure must exit nonzero and
must block draft generation.

## Source and freshness

The live `zap-api-production.herokuapp.com/projects/{id}` endpoint is the
weekly source of truth. The NYC OpenData SODA feed may enrich dashboard
analysis but cannot establish newsletter freshness. Each public export retains
NYC Planning source attribution, export time, and the latest collection date.

## Retention and safety

SQLite databases, generated weekly JSON, HTML drafts, and recipient data are
operational artifacts. Keep them out of Git and avoid exposing them through
the public dashboard unless an allowlisted export explicitly permits a field.
