# Tasks — ZAP Newsletter

## Active

- [ ] ZAP-002 Monitor LLM timeout stability on cron lanes
  Priority: medium
  Notes: ~88s timeouts on cron-nested lanes, fallback to kimi-k2.6:cloud active

- [ ] ZAP-003 Confirm email delivery to recipients
  Priority: medium
  Notes: Draft saved at `zap-newsletter-draft-2026-05-04.html`. Ready to send to aruddock@vhb.com and abuck@vhb.com.

- [ ] ZAP-005 Resolve public dashboard scope gate
  Priority: high
  Notes: Internal prototype and consolidated MVP brief are complete. Decide host, identity/ownership, all-records vs newsletter-vetted coverage, and newsletter-cadence vs daily refresh. Recommended: approved existing static host, neutral “ZAP Dashboard” identity, all tracked active records, newsletter cadence.

- [ ] ZAP-006 Public dashboard final data/privacy/accessibility QA
  Priority: high
  Notes: Run allowlist-based export and final QA without deployment once the scope gate is resolved.

## Pending

_None_

## Blocked

- [ ] ZAP-004 Evaluate newsletter content quality and readership metrics
  Priority: low
  Notes: Waiting on: stable cron execution first

## Completed

- [x] ZAP-001 Verify ZAP newsletter cron running cleanly after Apr 30 model routing fix
  Priority: high
  Notes: Verified May 4 — 237 active projects queried, 19-project draft generated, Discord summary posted. Cron execution clean.

- [x] ZAP-000 Pipeline built and cron scheduled (2026-03)

- [x] ZAP-000 Apr 29 draft generated (2026-04-29)

- [x] ZAP-000 Discord cron routing fix applied — 16 jobs rerouted from lmstudio to ollama/glm-5.1:cloud (2026-04-30)

- [x] ZAP-000 May 4 draft generated — 19 projects, post-fix cron verified clean (2026-05-04)

- [x] ZAP-000 Public dashboard internal prototype and initial scope/readiness artifacts completed (2026-06-05)

- [x] ZAP-000 Public dashboard MVP scope gate consolidated (2026-08-16)
