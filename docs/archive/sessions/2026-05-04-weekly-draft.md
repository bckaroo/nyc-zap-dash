# Session: ZAP Newsletter Weekly Draft — May 4, 2026

**Date:** 2026-05-04
**Source:** Cron (zap-newsletter-weekly-draft)
**Domain:** Newsroom
**Project:** ZAP Newsletter
**Status:** active

## Why We Started

Scheduled weekly draft run (cron ID `1b976353-5eb3-432f-b248-762db1fecd4a`). Pipeline was flagged as one of 6 errored crons during Apr 27 health check; Apr 30 model routing fix applied. This run serves as post-fix verification.

## What We Did

1. **NYC OpenData check:** Queried `hgx4-8ukb` for active projects (Filed, Noticed, In Public Review). Result: **237 active projects** — same count as in local DB, no new project IDs to enrich.

2. **SQLite database query:**
   - `zap_projects_enriched`: 237 rows
   - `zap_milestones`: 4,340 rows
   - Strict last-7-days (Apr 27–May 3) completed milestones: **1 project only** (`2022Q0449`, Borough President Referral, Apr 27)
   - Expanded to Apr 20–27 window: **19 projects** with completed milestones across all 5 boroughs

3. **ZAP API spot-check:** Queried `2024K0240` (289 Kent Avenue) to verify certification details. Confirmed certified and referred on Apr 22.

4. **Newsletter generation:** Crain's-style HTML draft written with:
   - Narrative intro paragraph (market context, velocity note)
   - Borough sections ordered by activity (Queens → Brooklyn → Manhattan → Bronx → Staten Island)
   - One-paragraph narratives per project with applicant, proposal, neighborhood significance, and stage
   - Unit counts / key stats in `.units` lines
   - All project names linked to `zap.planning.nyc.gov`

5. **Discord summary posted** to #zap with borough breakdown and notable projects.

## Decisions

- **Data window:** Used Apr 20–27 instead of strict last-7-days (Apr 27–May 3) because the latter produced only 1 project — too thin for a meaningful newsletter. Documented this in the intro and Discord summary for transparency.
- **No email sent:** Held per instruction — draft saved locally, awaiting bckaroo approval before distributing to `aruddock@vhb.com`.

## Files Created or Updated

- `zap-newsletter-draft-2026-05-04.html` — 19-project newsletter draft
- `projects/newsroom/zap-newsletter/narrative.md` — updated Last Updated date
- `projects/newsroom/zap-newsletter/tasks.md` — marked ZAP-001 verified, ZAP-003 pending approval

## Open Questions

- Should we tighten the data window logic in future runs? Strict 7-day misses light weeks; 14-day may be more robust.
- Need to confirm whether bckaroo wants this draft sent as email or archived.

## Next Actions

- [ ] Await bckaroo approval to send draft to `aruddock@vhb.com`
- [ ] If approved, send via `gog gmail send` from `abuck.bot@gmail.com`
- [ ] If rejected, archive draft and note reason for next cycle
