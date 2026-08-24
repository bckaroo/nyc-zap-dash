# Weekly Zoning Watch workflow

## Collector

Run the deterministic collector before any editorial work:

```bash
python3 scripts/zap-collector.py --verbose
```

It scans current candidate projects, requests live per-project records,
upserts the SQLite cache, and emits the weekly JSON handoff. It must fail
loudly when the API is unavailable or output cannot be trusted.

## Draft generation

The generator reads only a valid canonical handoff. It selects roughly 5–25
material projects, favors milestones and major filings, balances boroughs
where practical, and writes an HTML draft with a linked narrative and stats
line for every project. The detailed editorial runbook is
[`workflow/zap-newsletter-skill.md`](../workflow/zap-newsletter-skill.md).

## Review and sending

The draft is a review artifact. An explicit human approval is required before
any email is sent. Do not infer approval from a successful cron, a draft file,
or a dashboard update.

## Dashboard publication

The dashboard consumes a privacy-safe export. Before public release, confirm
host/ownership, record coverage, refresh cadence, privacy, and accessibility
requirements in the migrated scope documents.
