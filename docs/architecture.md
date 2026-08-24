# ZapDash architecture

## Ownership

ZapDash (`PROJ-002`) is the canonical development repository. The existing
`projects/newsroom/zap-newsletter/` directory remains the operational archive
and holds generated drafts, the SQLite store, and weekly JSON output. This is
intentional: generated and potentially stale artifacts are not application
source.

## Components

```text
Live ZAP per-project API
        │
scripts/zap-collector.py ──► SQLite cache + zap-weekly-data.json
        │                                │
        │                                ├──► approval-gated HTML newsletter draft
        │                                └──► public dashboard data export
        │                                               │
        └──────────────────────────────────────► Next.js ZapDash dashboard
```

The collector is deterministic and intentionally contains no LLM dependency.
The newsletter writer may use an LLM only after collection succeeds. The
dashboard must expose a freshness timestamp and source provenance.

## Scheduled flow

The current operational schedule is Monday, in two dependent stages:

1. 07:00 ET — collector refreshes the stable store from the live API.
2. 07:30 ET — generator reads the canonical weekly JSON and saves a draft.

The second stage must not run after collection failure. Sending remains a
separate, explicitly approved action.

## Boundaries

- Source: live per-project ZAP API; do not silently fall back to stale feeds.
- Storage: SQLite and weekly JSON are operational artifacts, not Git inputs.
- Publication: public dashboard exports are allowlist-based and privacy-safe.
- Delivery: draft generation is automated; email delivery is human-gated.
