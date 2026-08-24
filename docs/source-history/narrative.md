# ZAP Newsletter — Project Narrative

**Domain:** Newsroom  
**Project:** ZAP Newsletter  
**Status:** active  
**Last Updated:** 2026-08-16  

## What Is This

The ZAP Newsletter is a weekly automated email digest that tracks zoning and land-use changes across New York City, formatted in a Crain's-style professional format and delivered every Thursday morning. "ZAP" refers to the NYC Department of City Planning's Zoning Application Portal, the authoritative source for all land-use applications filed with the City.

The newsletter covers:

- New zoning applications filed in the past week
- Major project certifications and approvals
-ULURP (Uniform Land Use Review Procedure) actions
- BSA (Board of Standards and Appeals) decisions
- Notable changes to pending applications

Each edition is organized by borough (Manhattan, Brooklyn, Queens, Bronx, Staten Island) with clear section headers, application summaries, and links to the full ZAP records. The tone is professional and concise—modeled after Crain's New York Business coverage—providing subscribers with a quick scan of the week's land-use activity without the noise of minor filings.

## Why We're Doing It

NYC processes thousands of zoning applications annually, ranging from minor lot mergings to 1,000+ unit mixed-use developments. For planners, developers, attorneys, and engaged citizens, tracking this volume manually is impractical. The ZAP Newsletter solves this problem by automating the entire pipeline:

1. **Authoritative source.** NYC OpenData's ZAP API provides the official record of all zoning filings, updated daily. No manual data entry or news-scraping required.

2. **Professional formatting.** The Crain's-style HTML template presents information in a format that professionals expect—clean typography, clear hierarchy, scannable summaries, and working links to source documents.

3. **Consistent delivery.** Thursday 7:00 AM ET delivery captures mid-week filings and arrives before the weekend, when subscribers have time to review significant items.

4. **Persistent storage.** The SQLite database tracks all applications over time, enabling historical analysis and change detection.

This project reflects Andrew's interest in leveraging automation to stay informed about the built environment, and serves as a model for similar data-driven newsletters covering other municipal data streams.

## Timeline

### 2026-02 — Conceptualization
- Andrew conceptualized automated zoning newsletter using NYC OpenData
- Research into ZAP API availability and data structure

### 2026-03 — Pipeline Build
- **DEC-001:** NYC OpenData ZAP API confirmed as data source
- **DEC-002:** Crain's-style HTML formatting adopted
- **DEC-003:** Thursday 7:00 AM ET delivery time selected
- **DEC-004:** SQLite database architecture implemented
- Data pipeline built: NYC OpenData → ZAP API → SQLite → HTML → email
- First test delivery from `abuck.bot@gmail.com`
- Initial recipients: `aruddock@vhb.com`, `abuck@vhb.com`

### 2026-03-29 — First Automated Delivery
- Cron job successfully fired
- Newsletter delivered to subscribers
- Pipeline operational

### 2026-04-27 — Newsletter Active
- Weekly deliveries confirmed in priority queue
- Apr 29 draft saved: `zap-newsletter-draft-2026-04-29.html`
- Among 6 cron jobs experiencing errors (Apr 27 status)

### 2026-04-30 — Model Routing Fix
- ZAP newsletter cron identified as having routing errors
- Cause: LM Studio timeouts on cron-nested lanes
- Solution: Re-routed from `lmstudio/qwen/qwen3.5-9b` to `ollama/glm-5.1:cloud` with cloud fallbacks
- 16 Discord-delivered cron jobs updated as part of same operation

### 2026-08-16 — Public Dashboard Scope Gate Consolidated
- Confirmed that a functional internal static dashboard prototype and export path already exist.
- Consolidated audience, MVP, data, architecture, privacy, deployment, milestones, and risks in `files/public-dashboard-mvp-brief.md`.
- Recommended retaining the reversible SQLite-to-JSON static architecture for v1.
- Public launch remains gated on Andrew choosing host, identity/ownership, record coverage, and refresh cadence.

## Current Status

The newsletter pipeline is operational. A separate public-dashboard workstream now has an internal static prototype, JSON export path, publication-readiness checklist, and consolidated MVP brief. Nothing has been published. The dashboard is ready for an owner scope decision followed by final data/privacy/accessibility QA.

The newsletter runs as an OpenClaw cron job with the following characteristics:

- **Data source:** NYC OpenData ZAP API (daily CSV snapshot + API for descriptions)
- **Storage:** SQLite database at workspace path
- **HTML generation:** Jinja2 template with borough groupings
- **Email delivery:** SMTP via Gmail (`abuck.bot@gmail.com`)
- **Scheduling:** Thursday 7:00 AM ET weekly
- **Model routing:** `ollama/glm-5.1:cloud` (with kimi-k2.6:cloud fallback)

## Blockers

- LLM timeout issues on cron-nested lanes persist (approximately 88-second timeouts before fallback)
- Requires monitoring to ensure reliability after routing fix
- Database growth will need periodic maintenance as application history accumulates
- Public dashboard launch is blocked on host, identity/ownership, record coverage, and refresh-cadence decisions

## Next Actions

- [x] Verify ZAP newsletter cron executing cleanly post-Apr 30 fix (May 4 — verified)
- [ ] Monitor LLM timeout behavior on cron lanes (watch for fallback triggers)
- [ ] Consider database archiving strategy for applications older than 2 years
- [ ] Evaluate newsletter open rates and subscriber feedback
- [ ] Potentially expand recipient list for broader distribution
- [ ] Add automated detection of significant applications (projects >100 units, landmark actions)
- [ ] Andrew resolves the public-dashboard four-part scope gate in `files/public-dashboard-mvp-brief.md`
- [ ] Run allowlist-based export and accessibility/privacy QA after scope approval

## Key Files

- `projects/newsroom/zap-newsletter/zap-newsletter-draft-2026-04-29.html` — latest edition
- `projects/newsroom/zap-newsletter/decisions.md` — DEC-001 through DEC-004
- Pipeline code: `.apps/zap-pipeline/` or equivalent
- SQLite database: `zap-applications.db` in project directory
- Cron configuration: OpenClaw gateway crons

## Discord Channel

🏥zap (1489668169109864649)
