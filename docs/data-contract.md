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
adds an official `source_url`; `activity_date`, selected deterministically from
milestone date, certification/referral date, then first-seen date; ZAP action
codes; and the location method/source used by the public map. A first-observed
date never overrides a substantive date. Export metadata identifies the source,
export time, and latest collection date.

## Geography enrichment and map contract

`scripts/zap-collector.py --enrich-geography-only` requests only the exact
application IDs already present in `zap_applications`. This mode does not run an
ID-range scan, add application rows, alter collection freshness, or introduce a
second activity dataset. It updates only the durable geography/action columns:

- `bbls_json` and `bbl_featurecollection_json`, directly from ZAP's
  `bbls` and `bbl-featurecollection` attributes;
- `action_codes_json`, from the actions included in the same ZAP response;
- `geography_location_method`, `geography_location_source`,
  `geography_enriched_at`, and `geography_status`.

`geography_status` is `located` when ZAP supplies at least one polygon,
`unmatched` when the application exists but supplies no usable polygon, and
`api_not_found` when the stored ID is not returned by the live endpoint. API
errors remain distinct and do not overwrite prior geometry.

The exporter converts each authoritative ZAP parcel polygon to a deterministic
point on that polygon for display. It never substitutes a Community District
centroid, borough centroid, address geocode, or inferred parcel. A project may
therefore produce more than one site point, while borough and Community
District choropleth values count distinct ZAP projects rather than points.
`map.located_project_count`, `map.site_point_count`, and
`map.unmatched_project_count` disclose this coverage explicitly.

The tracked files `public/data/nyc-boroughs.geojson` and
`public/data/nyc-community-districts.geojson` are simplified snapshots of NYC
Open Data datasets `gthc-hcne` and `5crt-au7u`. The Community District file
contains the 59 numbered districts and excludes joint-interest areas. These
polygons are cartographic reference only: they do not add, replace, or infer
application activity. The public map uses borough fills at low zoom, Community
District fills at borough scale, and ZAP-derived site points at high zoom. The
HTML geography table is the nonvisual equivalent of the choropleth counts.

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
Boundary metadata separately identifies each NYC Open Data dataset, retrieval
date, and local public file so map provenance is visible without conflating the
boundaries with the activity source.

## Retention and safety

SQLite databases, generated weekly JSON, HTML drafts, and recipient data are
operational artifacts. Keep them out of Git and avoid exposing them through
the public dashboard unless an allowlisted export explicitly permits a field.
