# ZapDash DevOS migration — 2026-08-24

## What changed

- Confirmed ZapDash is DevOS project `PROJ-002` with canonical repository
  `apps/zapdash/`.
- Migrated the collector, dashboard export script, newsletter runbook,
  architecture, workflow, data contract, and source-history records to that
  repository.
- Preserved this project folder as the operational store for SQLite, weekly
  JSON, and generated newsletter drafts; no generated data was committed.
- Added and completed metadata for `DEV-032`, `DEV-033`, and `DEV-034`.

## Artifacts

- ZapDash commit: `a1df18c` (`DEV-032: migrate ZAP workflow into ZapDash`)
- Canonical docs: `apps/zapdash/docs/`
- Runbook: `apps/zapdash/workflow/zap-newsletter-skill.md`

## Verification

- `git diff --check` passed.
- Collector and export scripts passed Python compilation.
- The Next.js production build is pending dependency installation; this
  checkout did not contain the `next` executable.

## Next actions

- Rebuild and validate the canonical weekly collector handoff (`DEV-032`).
- Complete the quality-gated newsletter automation (`DEV-033`).
- Complete the public dashboard publishing work after scope approval
  (`DEV-034`).
