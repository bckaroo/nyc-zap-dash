# PLAN — ZapDash Dashboard Staleness & Pipeline Automation

**Status:** Draft — for review before build
**Date:** 2026-11-01
**Owner:** spec (planner) → builder (execution)
**Repo:** `/home/abuck/.openclaw/workspace/dev/zap` (DevOS PROJ-002, GitHub `bckaroo/nyc-zap-dash`, branch `main`)
**Source of asks:** @ops handoff (verified live 2026-11-01)

---

## Goal

Stop the public ZapDash dashboard from silently shipping stale data, and close the three
remaining pipeline gaps: (1) automate the snapshot refresh+commit that the Monday collector
never does, (2) make CI fail loudly when the committed snapshot is stale, (3) port parallel
collection from the legacy collector, and (4) retire the duplicate newsroom pipeline.

## Context (verified — do not re-derive)

- **Pipeline:** `scripts/zap-collector.py` (Monday cron `8fec9be85224`, `0 6 * * 1`, wrapper
  `~/.hermes/profiles/ops/scripts/zap-collector-run.sh`) → writes gitignored
  `data/zap-applications.db` + `data/zap-weekly-data.json`. `npm run build` =
  `data:export && next build`; `npm run data:export` =
  `python3 scripts/export-public-dashboard-data.py --update-snapshot`.
- **The trap:** `src/app/page.tsx:4` declares `export const dynamic = "force-static"`, so the
  dashboard is statically prerendered. GitHub Pages workflow (`deploy-pages.yml`) runs
  `npm run data:export && npm run build:pages` in CI — but CI has no `data/` DB, so the
  exporter's `fallback_from_snapshot()` copies the **committed** snapshot
  `src/data/public-dashboard-data.json` (gitignore-exempted at `.gitignore:49`). Result: a green
  deploy can ship a snapshot nobody refreshed. The 2026-10-15 deploy shipped 17-day-old data.
- **Freshness signal:** `collected_through` in the snapshot = `max(last_updated_date)` across
  records; `last_updated_date` is set to the collection date on every upsert. This is the correct
  field to gate on.
- **Two collector copies:** `dev/zap/scripts/zap-collector.py` (canonical, geography-aware,
  **serial-only**) and `workspace/scripts/zap-collector.py` (legacy, **has `--workers`
  ThreadPoolExecutor**, points at the retired newsroom path, no geography fields). The canonical
  version lost the parallel fetch when it gained geography enrichment.
- **DevOS:** parent task DEV-034 ("Publish and maintain the public ZapDash dashboard", REVIEW);
  DEV-043 already consolidated the repo but left `/mnt/e/OC_Projects/projects/newsroom/zap-newsletter/`
  as a stale "preserved operational store" (DEVLOG 2026-08-24). Highest existing id DEV-298.

## Approach

Four independent, low-risk changes. Items 2 and 3 are pure code (ship together). Items 1 and 4
involve automation/archive decisions that need Andrew's sign-off before the builder wires them.

### Item 1 — Automate the snapshot refresh+commit (the "link 2" gap)

**Decision (recommended): a separate job that opens a PR** — not the collector wrapper, not a
direct push to `main`.

- The collector wrapper stays single-purpose (collect → DB + weekly JSON), and does **not** touch
  git. Adding `--update-snapshot` there would leave the tracked snapshot dirty every Monday with
  no commit/push, which does nothing for the public site and creates merge noise.
- A **new Hermes cron** (Monday ~06:15, after the 06:00 collector) runs a wrapper
  `~/.hermes/profiles/ops/scripts/zap-snapshot-pr.sh`:
  1. `cd /home/abuck/.openclaw/workspace/dev/zap`
  2. `python3 scripts/export-public-dashboard-data.py --update-snapshot`
  3. `git diff --quiet -- src/data/public-dashboard-data.json` → unchanged ⇒ exit 0 (nothing to do)
  4. changed ⇒ `git add`, `git commit -m "DEV-###: refresh public dashboard snapshot through <collected_through>"`,
     push to a dated branch, `gh pr create` with a title/body citing `collected_through`.
- **Prerequisite to verify in build:** `gh` is authenticated for `bckaroo/nyc-zap-dash` on this
  host (the job runs headless under the ops profile). If not, the job must fail loudly, not
  silently skip. **Verified by ops 2026-11-01:** a clean non-login `gh auth status` under the ops
  profile returns bckaroo with `repo` + `workflow` scopes — the precondition holds today; keep the
  fail-loud guard anyway (tokens expire).
- **Run-verification nuance (ops):** if the job adds any "did CI succeed?" check via
  `gh run list`, match the run to the **PR head SHA** (`gh pr view --json headRefOid`), not merely
  "a run exists" — a stale run from a prior commit can masquerade as success. Note the Pages
  workflow only triggers on push to `main`/`workflow_dispatch`, so the PR branch itself won't
  produce a deploy run; treat head-SHA matching as the correctness rule wherever a run is asserted.
- **Decision (Andrew, 2026-11-01): auto-merge.** After opening the PR, enable auto-merge so it
  merges into `main` once satisfied (which triggers the Pages deploy). Note the Pages workflow
  currently triggers only on push to `main`/`workflow_dispatch`, so there is no PR-branch check to
  gate auto-merge on — the PR will merge promptly, and item 2's staleness gate on the `main` deploy
  is the real safety net. If a required-status-check gate on PRs is wanted later, that is a branch-
  protection change (repo settings), out of scope here.

### Item 2 — Make staleness loud in CI

Add a freshness gate to `.github/workflows/deploy-pages.yml`, run **before** `data:export` and
`build:pages`. Implement as a committed, testable script (not inline YAML):

- New `scripts/check-snapshot-freshness.py`:
  - Read `src/data/public-dashboard-data.json`, extract `collected_through`.
  - Compare `collected_through` against an **`--as-of YYYY-MM-DD` reference date** (default = `date.today()` for local/manual use).
  - Exit non-zero (with a clear message) if `collected_through` is missing or > `MAX_STALENESS_DAYS` behind the reference date (default 10).
  - `--max-days` override for testing.
- Wire into `deploy-pages.yml` after `setup-python`, before the build, passing the **commit/build date as the reference** — not the runtime wall clock — so a re-run of an old commit compares against when it was committed, not when it was re-run (ops refinement):
  `python3 scripts/check-snapshot-freshness.py --as-of "${{ github.event.head_commit.timestamp }}" --max-days 10`
  (derive a `YYYY-MM-DD`; `github.run_started_at` is an acceptable fallback). Without this, re-running an old workflow would falsely pass/fail against today's date.
- A non-zero exit fails the workflow → Pages does **not** deploy. This converts today's silent
  stale deploy into a red run.

### Item 3 — Port `--workers` into the canonical collector

Port the exact ThreadPoolExecutor pattern from `workspace/scripts/zap-collector.py` (the
`_fetch_one` / `_absorb` split + `if workers > 1:` block, refs around lines 322–367) into
`dev/zap/scripts/zap-collector.py`:

- Add `--workers` arg (type int, default 1) and thread `workers=max(1, args.workers)` through
  `run(...)`.
- Preserve the correctness properties of the legacy port:
  - fetches run on worker threads; **all DB writes (`upsert`) stay on the main thread** via
    `as_completed` iteration (SQLite single-connection safety).
  - pacing (`SLEEP_BETWEEN_CALLS`) applies only to successful bodies, not 404 misses.
  - the canonical `_absorb` must also handle the geography fields the legacy version lacks —
    keep the existing `extract_project_data`/`upsert` calls unchanged; only move the *fetch* off
    the main thread.
- Keep default serial (1); enabling `--workers 4` in the cron wrapper is a separate, optional
  follow-up (ops noted the 06:00→07:00 window has headroom — not urgent).

### Item 4 — Retire the duplicate newsroom pipeline

`/mnt/e/OC_Projects/projects/newsroom/zap-newsletter/` holds a stale `.db`/`.json` that nobody
should run (canonical is `dev/zap`, per `dev/zap/AGENTS.md` and DEV-043). **Decision (Andrew,
2026-11-01): archive.** Move the directory to
`/mnt/e/OC_Projects/projects/newsroom/_archived/zap-newsletter-<date>/` and add a `DEPRECATED.md`
pointing at `dev/zap`. Archive only — never delete. No code change; a documentation/cleanup task.

## Acceptance criteria

1. **Item 1:** After a Monday collector run that changes the DB, the export job refreshes
   `src/data/public-dashboard-data.json`, opens a PR, and enables auto-merge; an unchanged week
   produces no PR and no dirty working tree. Verified by a dry-run that reports "no change" vs
   "PR opened + auto-merge enabled" correctly.
2. **Item 2:** `python3 scripts/check-snapshot-freshness.py` exits non-zero when `collected_through`
   is > 10 days old (or missing), and zero when fresh; wired into CI so a stale snapshot fails the
   build before deploy. Verified by running it against a synthetic stale + fresh payload.
3. **Item 3:** `scripts/zap-collector.py --workers 4` collects correctly with DB writes serialized
   on the main thread; `--workers 1` behavior is byte-equivalent to today. Verified by a test run
   (dry/short scan) and existing `npm test` (Python unittest discover) still green.
4. **Item 4:** The stale newsroom directory is moved to an archive path with a `DEPRECATED.md`
   pointer, and `dev/zap` remains the only runnable pipeline.

## Artifact map

- `scripts/check-snapshot-freshness.py` (new) — CI staleness gate.
- `tests/test_check_snapshot_freshness.py` (new) — unit tests for the gate.
- `.github/workflows/deploy-pages.yml` (modify) — add the freshness step.
- `scripts/zap-collector.py` (modify) — port `--workers` ThreadPoolExecutor.
- `~/.hermes/profiles/ops/scripts/zap-snapshot-pr.sh` (new) — export + commit + PR job wrapper.
- Hermes cron job (new, Monday ~06:15) — invoke the wrapper.
- `/mnt/e/.../newsroom/_archived/zap-newsletter-<date>/` + `DEPRECATED.md` (item 4, gated).
- `notes/DEVLOG.md` — append a dated entry (repo convention).
- DevOS: file four tasks (find-before-create) under PROJ-002, cite `DEV-###` in commits.

## Steps (builder order)

1. **DevOS setup.** `devos doctor PROJ-002`; read latest `notes/DEVLOG.md`; find-before-create —
   file the four tasks (three code + one archive) and capture their `DEV-###` ids.
2. **Item 2 (staleness gate) first — it's the smallest, highest-value, zero-risk change.**
   Write `tests/test_check_snapshot_freshness.py` (TDD: stale ⇒ exit 1, fresh ⇒ 0, missing ⇒ 1,
   `--max-days` override), then `scripts/check-snapshot-freshness.py`, then wire the step into
   `deploy-pages.yml`. Run `python3 -m unittest discover -s tests -p "test_*.py" -v` and
   `npm test`. Commit.
3. **Item 3 (parallel collector).** Port the ThreadPoolExecutor pattern into the canonical
   collector with `--workers`, keeping DB writes on the main thread and geography fields intact.
   Add/keep a Python unittest that exercises `run()` in both serial and `--workers 2` mode against
   a fixture (or a short `--scan-range`). Run the Python test suite. Commit.
4. **Item 1 (snapshot PR job).** Write `zap-snapshot-pr.sh`; verify `gh auth status` for
   `bckaroo/nyc-zap-dash`; register the Hermes cron (Monday ~06:15) under the ops profile. Test
   with `--dry-run`/a manual invocation and confirm "no change ⇒ exit 0" and "change ⇒ branch +
   PR". Do **not** merge the test PR unless Andrew says so. Commit the script.
5. **Item 4 (archive).** Prepare the archive command + `DEPRECATED.md` content, present to Andrew;
   execute only after explicit approval.
6. **Docs + close.** Append a dated `notes/DEVLOG.md` entry; update the DevOS tasks with
   `implementationSummary`/`testResult`; report back to spec with what changed, verification
   output, and the two open decisions (PR auto-merge; archive go).

## Risks / open questions

1. **PR merge (item 1) — RESOLVED: auto-merge (Andrew, 2026-11-01).** The job opens the PR and
   enables auto-merge. Residual note: with no PR-branch status check, auto-merge fires promptly and
   the `main` deploy's staleness gate is the safety net; if that's ever deemed insufficient, add a
   branch-protection required check (repo-settings change, separate task).
2. **`gh` auth on the ops profile (item 1) — RESOLVED by ops (2026-11-01).** Verified in a clean
   non-login shell: `gh` is authenticated as bckaroo with `repo` + `workflow` scopes. The cron runs
   as the same user, so the headless job has working credentials today. Keep the fail-loud guard
   (tokens expire), but the precondition holds.
3. **Staleness threshold.** 10 days assumes a weekly cadence + 3-day grace. If the collector cadence
   or the "freshness" expectation changes, `MAX_STALENESS_DAYS` must move with it — make it a
   script default, not a hardcoded YAML literal.
4. **`collected_through` semantics.** It is `max(last_updated_date)` = the latest collection that
   touched any record, not necessarily "all records are ≤N days old." The gate is a proxy; that's
   acceptable for the stated goal (catch "nobody refreshed the snapshot"), but don't over-interpret
   it as full-coverage freshness.
5. **Item 4 — RESOLVED: archive (Andrew, 2026-11-01).** Move to `_archived/` + `DEPRECATED.md`;
   never delete. The builder may proceed with the archive move without further sign-off.

## Flags for ops (what I think is accurate, and one nuance)

- Confirmed accurate: the `force-static` trap, the CI no-DB → snapshot-fallback behavior, the
  "green ≠ fresh" failure mode, the legacy-vs-canonical collector split, and that nothing runs
  `data:export` after the Monday collector.
- One nuance worth surfacing: **item 1's "wrapper exports daily" option is insufficient on its own**
  — refreshing the tracked snapshot without committing/pushing it does nothing for GitHub Pages
  (deploy only fires on push to `main`). That's why the recommendation is a commit + PR, not a
  local export. If ops intended the wrapper to also commit+push, that's a direct-to-main variant
  worth an explicit Andrew sign-off (unattended writes to a public repo's default branch).
