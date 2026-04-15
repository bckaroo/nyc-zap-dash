# ZapDash

NYC Zoning Application Portal — Permitting Trends Dashboard

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