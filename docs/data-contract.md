# ZAP data contract

## Canonical collection outputs

`scripts/zap-collector.py` writes the following operational artifacts:

- `zap-applications.db` — persistent SQLite cache of observed projects,
  milestones, statuses, and collection metadata.
- `zap-weekly-data.json` — handoff document for the weekly draft generator.

Default paths point to `projects/newsroom/zap-newsletter/` to preserve the
existing running cron's storage contract. A future path migration must change
the collector, cron, dashboard export, and runbook together.

## Valid weekly JSON

A publishable handoff must include a current `generated_at`, correct weekly
bounds, nonzero collection evidence, totals, and a `week_projects` selection
with explicit `week_reasons`. An empty active set after a successful scan is
an invalid result, not a quiet week. A collector failure must exit nonzero and
must block draft generation.

## Source and freshness

The live `zap-api-production.herokuapp.com/projects/{id}` endpoint is the
weekly source of truth. The NYC OpenData SODA feed may enrich dashboard
analysis but cannot establish newsletter freshness. Each public export must
retain source attribution and the collection timestamp.

## Retention and safety

SQLite databases, generated weekly JSON, HTML drafts, and recipient data are
operational artifacts. Keep them out of Git and avoid exposing them through
the public dashboard unless an allowlisted export explicitly permits a field.
