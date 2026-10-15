# ZapDash

ZapDash is the canonical application and data-pipeline repository for the NYC
Zoning Application Portal dashboard and its weekly **Weekly Zoning Watch**
newsletter. It is tracked in DevOS as `PROJ-002`.

## What it does

1. Collects current project records from the live ZAP per-project API into a
   SQLite cache and a weekly JSON handoff.
2. Produces a Crain's-style HTML draft covering material zoning activity.
3. Holds that draft for human approval; delivery is never automatic.
4. Publishes an analytical dashboard built from a privacy-safe export of the
   canonical store.

The live per-project ZAP API is the collector's source of truth. The older
NYC OpenData feed remains useful for dashboard context but is not reliable for
weekly newsletter freshness.

## Workflow and documentation

- [Architecture](docs/architecture.md)
- [Operational workflow](docs/workflow.md)
- [Data contract](docs/data-contract.md)
- [Historical newsroom records and dashboard scope](docs/source-history/)
- [Newsletter runbook](workflow/zap-newsletter-skill.md)

Operational databases, weekly JSON, generated dashboard JSON, and draft output
live under the repository's gitignored `data/` directory. They are local
artifacts and are not committed. The one exception is
`src/data/public-dashboard-data.json`, a tracked, privacy-safe snapshot of the
same allowlisted export that makes clean-checkout builds work without the
operational database.

## Data Source
- **NYC OpenData**: [ZAP Project Data (hgx4-8ukb)](https://data.cityofnewyork.us/Housing-Development/Zoning-Application-Portal-ZAP-Project-Data/hgx4-8ukb)
- **ZAP Portal**: https://zap.planning.nyc.gov/projects
- Updates: DCP refreshes regularly

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- Static, privacy-safe JSON generated from the canonical SQLite cache
- NYC Planning ZAP per-project API

## Development
```bash
npm run dev
```

The production build regenerates the public allowlisted feed automatically:

```bash
npm test
npm run lint
npm run build
```

`npm run build` runs `scripts/export-public-dashboard-data.py` before Next.js,
so the dashboard is always built from the canonical local SQLite feed without
hand-editing JSON.

The collector can be run manually for recovery or verification:

```bash
python3 scripts/zap-collector.py --verbose
```

It writes operational data to the established newsroom data directory by
default. See the data contract before changing paths or the cron sequence.

## Deployment

The build never requires the operational SQLite database. `npm run build` runs
`data:export` first: with the local canonical `data/zap-applications.db`
present it regenerates the feed **and** refreshes the tracked snapshot at
`src/data/public-dashboard-data.json`; without the database it falls back to
the tracked snapshot, and fails with a clear error only if neither exists.

Deployment contract:

1. Locally run `npm run data:export` after a collector run, review the snapshot
   diff, and commit `src/data/public-dashboard-data.json`.
2. CI/Vercel builds from the committed snapshot — data freshness is the
   snapshot's `generated_at`/`collected_through`, which the dashboard displays.
3. The operational SQLite database stays out of Git.

(Do not rely on Vercel auto-deploy until the tracked snapshot has actually
been committed; a clean checkout without it fails the build by design.)

### Running service

- Local: `http://127.0.0.1:9003`
- Tailnet: `https://vengeance.tail92bcba.ts.net:9003/`
- Service: `systemctl --user status zapdash.service`

The persistent service is loopback-bound and exposed only through Tailscale
Serve. Port 9003 is assigned in the central port registry; do not substitute a
different port on conflict.

## Phase 1 dashboard
- [x] Citywide tracked-application overview
- [x] Borough and Community District activity trends and filters
- [x] Searchable application detail with official source links
- [x] Trailing-12-month named-applicant activity leaderboard
- [x] Source, freshness, coverage, and unofficial-product disclosures
- [x] Responsive desktop/mobile presentation
- [x] Automated analytics, labeling, and export-contract tests
