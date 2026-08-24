---
name: zap-newsletter
description: Generate the weekly ZAP newsletter in Crain's NY Business narrative style from fresh, self-built data. A deterministic collector script (zap-collector.py) resyncs the live ZAP API into a stable SQLite DB every Monday; a cloud LLM then writes the newsletter from that data.
---

# ZAP Newsletter Generator Skill

## Overview

This skill generates the weekly NYC Zoning Application Portal newsletter in **Crain's NY Business narrative style** — the format approved by bckaroo on 2026-04-14 ("this is very well done") and 2026-04-27 ("this is good").

## Architecture (two stages)

```
MON 7:00 AM  →  ZAP Collector   (qwen3.5-9b-mtp, deterministic, NO LLM)
                scripts/zap-collector.py
                  • resyncs active ZAP projects from the LIVE per-project API
                    (zap-api-production.herokuapp.com/projects/{id})
                  • upserts into zap-applications.db  (self-building stable store)
                  • emits zap-weekly-data.json (active + this-week projects)
                  • exits NON-ZERO if the API is unreachable (so no empty draft ships)

MON 7:30 AM  →  ZAP Newsletter Generator  (qwen3.5:397b-cloud)
                reads zap-weekly-data.json + this skill + gold template
                  → writes Crain's-style HTML draft
                  → quality gate
                  → posts summary to #newsroom
                  → AWAITS bckaroo approval (never auto-sends)
```

The SQLite DB is the stable, self-sufficient store. The collector keeps it current
every week; the generator only reads from it. No external/stale seed DB required.

## Prerequisites

1. **Fresh data**: `zap-collector.py` has run and produced `zap-weekly-data.json`
   (done automatically by the Monday 7 AM cron — do NOT run `zap-fetch-pipeline.py`).
2. **Gold standard template**: `/home/abuck/.openclaw/workspace/zap-newsletter-draft-2026-05-04.html` — the reference format

## Data Collection (Collector)

```bash
# Full weekly resync (what the cron runs) — ~10-15 min
python3 /home/abuck/.openclaw/workspace/dev/zap/scripts/zap-collector.py --verbose

# Limited test (fast smoke test)
python3 /home/abuck/.openclaw/workspace/dev/zap/scripts/zap-collector.py --scan-years 2026 --scan-range 12 --verbose

# Outputs:
#   /home/abuck/.openclaw/workspace/dev/zap/data/zap-applications.db  (stable store)
#   /home/abuck/.openclaw/workspace/dev/zap/data/zap-weekly-data.json
```

The collector is stdlib-only and resilient: it treats HTTP 404s as "project not
found" (not errors), tolerates malformed rows, self-heals its DB schema, and
fails loud (non-zero exit) if the live API is unreachable.

## Newsletter Generation Process

### Step 1: Select Projects

Read `zap-weekly-data.json` and select projects for the newsletter:

- Start from `week_projects` — projects active or changed in the current week (each has a `week_reasons` list telling you why it's newsworthy).
- If `week_projects` is thin, draw from `totals.active_tracked` / the DB itself (`zap-applications.db`) for additional context.
- **Priority**: Projects with milestone activity in the current week (certified, in public review, community board vote, borough president review), then newly filed/noticed, then significant dispositions.
- **Target**: 8–20 projects (not all ~100+). Quality over quantity.
- **Balance**: Aim for coverage across boroughs. Don't let one borough dominate.

### Step 2: Write the Newsletter

Use the Crain's NY Business narrative style:

**Template structure:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Weekly Zoning Watch — [Date Range]</title>
<style>
body { font-family: Georgia, 'Times New Roman', serif; background: #f5f5f5; margin: 0; padding: 20px; }
.container { max-width: 800px; background: white; padding: 40px; margin: 0 auto; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
h1 { font-size: 26px; font-weight: normal; color: #1a1a1a; margin-bottom: 4px; }
.subtitle { font-size: 14px; color: #666; font-style: italic; margin-bottom: 24px; }
h2 { font-size: 18px; color: #1a1a1a; border-left: 3px solid #c00; padding-left: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 32px; }
a { color: #065fd4; text-decoration: none; }
.stats { color: #555; font-size: 13px; margin-top: 2px; margin-bottom: 16px; }
.intro { font-size: 16px; color: #1a1a1a; line-height: 1.6; }
.closing { margin-top: 40px; font-size: 14px; color: #666; }
</style>
</head>
<body>
<div class="container">
<!-- Content -->
</div>
</body>
</html>
```

**Writing rules:**
1. **Intro paragraph**: 2-3 sentences summarizing the week's activity, naming the most notable projects
2. **Borough sections**: `<h2>` headers for each borough with projects
3. **Each project**: One paragraph telling the story
   - Lead with the **developer/applicant name**, not the project ID
   - Link the project name to `https://zap.planning.nyc.gov/projects/{id}`
   - Explain what the zoning change means for the neighborhood
   - Include milestone status if relevant (community board vote, borough president review, etc.)
   - End with a `<p class="stats">` line: units | square footage | zoning change | borough CD | status
4. **Closing line**: "Explore all active filings at [zap.planning.nyc.gov](https://zap.planning.nyc.gov)."

**Voice:**
- Authoritative, narrative journalism (Crain's NY Business)
- Developer/applicant named first
- What the zoning change means, not just what it is
- No jargon dumps, no bare ID lists
- Each project = 1 paragraph telling the story

### Step 3: Quality Gate

Before saving the draft, verify:

| Check | Rule |
|-------|------|
| Project count | 5–25 projects (not 50+, not <5 unless genuinely slow week) |
| No bare ID lists | Every project must have a narrative paragraph |
| Borough balance | At least 2 boroughs represented if possible |
| Stats lines | Every project has a `<p class="stats">` line |
| Links | Every project name links to `zap.planning.nyc.gov/projects/{id}` |
| Date range | Correct in title and subtitle |
| Intro paragraph | Present, not empty |

If any check fails, fix before saving.

### Step 4: Save and Send

```bash
# Save the draft
# File: /home/abuck/.openclaw/workspace/zap-newsletter-draft-YYYY-MM-DD.html

# Send (requires approval)
gog gmail send \
  --account abuck.bot@gmail.com \
  --to abuck@vhb.com \
  --cc aruddock@vhb.com \
  --subject "Weekly Zoning Watch — [Date Range]" \
  --body-html "$(cat /home/abuck/.openclaw/workspace/zap-newsletter-draft-YYYY-MM-DD.html)"
```

**⚠️ ALWAYS show the draft to bckaroo for approval before sending.**

## Cron Jobs (consolidated — 2026-07-13)

The old overlapping crons (Monday xiaoguo pipeline, Thursday xiaozhu pull, daily
zap-newsletter) were merged into two reliable jobs in the OpenClaw live store:

1. **ZAP Collector (Weekly Resync)** — `0 7 * * 1`, agent `xiaolu`, model
   `lmstudio/qwen3.5-9b-mtp`. Runs `zap-collector.py`, builds the DB + JSON.
   Fails loud (no draft) if the API is down.
2. **ZAP Newsletter Generator (397b)** — `30 7 * * 1`, agent `xiaozhu`, model
   `ollama/qwen3.5:397b-cloud`. Reads the JSON + this skill, writes the Crain's
   draft, posts summary to #newsroom, **awaits bckaroo approval** (never auto-sends).

The 7:30 run depends on the 7:00 collector having completed. The generator must
never be triggered if the collector failed.

## File Locations

| File | Purpose |
|------|---------|
| `scripts/zap-collector.py` | **Deterministic data collector** (replaces zap-fetch-pipeline.py) |
| `scripts/zap-cron-migrate.py` | One-time cron consolidation script |
| `data/zap-applications.db` | **Stable, self-building SQLite store** |
| `data/zap-weekly-data.json` | Weekly data output (read by generator) |
| `zap-newsletter-draft-YYYY-MM-DD.html` | Newsletter HTML drafts |
| `zap-newsletter-draft-2026-05-04.html` | Gold standard template |

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Collector exits non-zero, "API unreachable" | Live ZAP API down | No draft ships; check endpoint, retry when back |
| Too few projects in `week_projects` | Quiet week or DB stale | Run full `zap-collector.py --verbose`; draw from `totals.active_tracked` |
| "Not Started" milestones in output | ZAP returns empty milestone blocks | Expected — filtered by `is_active`/`week_reasons` |
| Generator ran but no draft | Collector failed earlier (7:00) | Check collector run log; re-run collector then generator |