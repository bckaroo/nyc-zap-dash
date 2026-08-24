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

Operational databases, weekly JSON, and generated drafts remain outside this
repository in `projects/newsroom/zap-newsletter/`. They are not committed.

## Data Source
- **NYC OpenData**: [ZAP Project Data (hgx4-8ukb)](https://data.cityofnewyork.us/Housing-Development/Zoning-Application-Portal-ZAP-Project-Data/hgx4-8ukb)
- **ZAP Portal**: https://zap.planning.nyc.gov/projects
- Updates: DCP refreshes regularly

## Stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Recharts
- NYC OpenData SODA API

## Development
```bash
npm run dev
```

The collector can be run manually for recovery or verification:

```bash
python3 scripts/zap-collector.py --verbose
```

It writes operational data to the established newsroom data directory by
default. See the data contract before changing paths or the cron sequence.

## Deployment
Push to `main` → Vercel auto-deploys (or run `npm run build`)

## Features (v0)
- [x] Total / active / completed project counts
- [x] Application filings over time (monthly)
- [x] Certifications/referrals over time (monthly)
- [x] Projects by borough
- [x] Projects by status
- [x] Projects by applicant type
- [ ] MIH trends
- [ ] ULURP vs Non-ULURP breakdown
- [ ] Community District drill-down
- [ ] Search/filter by project
- [ ] Map view
