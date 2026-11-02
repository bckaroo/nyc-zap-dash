# PLAN — "Permits per month" card (corrected scope: applications-per-month **dimension toggle**)

**Status:** Ready for build (one decision below needs Andrew ratification before the applicant-type dimension ships)
**Date:** 2026-11-01
**Owner:** spec → backend builder (t_8189238d) + frontend builder (t_54ee482e) → integrator (t_f4d30975)
**Repo:** `/home/abuck/.openclaw/workspace/dev/zap` (DevOS PROJ-002, GitHub `bckaroo/nyc-zap-dash`, branch `main`)

---

## ⚠️ Read this first — three grounding corrections

The task body says "permits per month by permit type." That is **not what this codebase can or should build**, and it partly **already exists**. Three facts, all verified in the repo:

1. **"Permits" is a misnomer — this is not a permit feed.** ZapDash ingests the NYC **Zoning Application Portal** discretionary land-use *application* feed. There is no DOB permit data anywhere in the pipeline. The repo's own shipped card and test/comment history explicitly forbid calling it "permits"/"DOB" ("this is the ZAP discretionary land-use application feed… a DOB permit layer would be a separate dataset"). The correct noun is **applications**.

2. **The base card is already built and live.** `buildMonthlyActionTrend` (`src/lib/dashboard-analytics.ts`) + `MonthlyPipelineChart` (`src/components/MonthlyPipelineChart.tsx`) render "Applications entering the pipeline per month," stacked by **primary ZAP action type**, over a trailing 12-month window, with a prior-12-month baseline. This is exactly the "stacked bar per month by type" card described — using *action type*, not "permit type."

3. **The actual net-new request is a dimension toggle.** The user (desktop, 2026-11-01) asked: *"make a toggle there where we can shift categories from application type to applicant type, highlighting if it's a developer, city agency, state agency, etc."* That toggle is the real deliverable. The "permit type" taxonomy in the task maps to **ZAP action type** (already implemented); the new dimension is **applicant type**.

**Consequence for the builders:** do not build a new "permits" endpoint/card from scratch. Generalize the *existing* aggregation and chart to support two stack dimensions, and add the toggle. A `buildMonthlyTrend(records, collectedThrough, dimension)` function is the "backend"; the existing `MonthlyPipelineChart` (or a thin wrapper) is the "frontend."

---

## Goal

Add a **two-position toggle** to the existing trailing-12-month stacked-bar card so a viewer can switch the stack dimension between **ZAP action type** (current behavior, unchanged) and **applicant type** (developer / city agency / state agency / …), with the applicant-type dimension derived because the source `applicant_type` field is unusable (see Findings).

---

## Context (verified — do not re-derive)

- **Pipeline:** ZAP per-project API (`https://zap-api-production.herokuapp.com/projects/{id}`) → `scripts/zap-collector.py` → `data/zap-applications.db` (`zap_applications`, 242 rows) → `scripts/export-public-dashboard-data.py` → `data/public-dashboard-data.json` / tracked snapshot `src/data/public-dashboard-data.json`. `npm run build` = `data:export && next build`.
- **Relevant record fields** (allowlisted in the public export): `pipeline_start_date` (earliest milestone = pipeline-entry date), `action_types: string[]`, `applicant_type`, `primary_applicant`, plus `collected_through` payload metadata.
- **Charting library:** recharts `^3.8.1` (stacked `Bar` with a shared `stackId`). Already used by `MonthlyPipelineChart`, `BoroughActionChart`, `PipelineChart`.
- **Aggregation location:** client-side only, `src/lib/dashboard-analytics.ts`, invoked via `useMemo` in `DashboardExplorer.tsx`. **There is no runtime HTTP API and no runtime SQLite query** — `src/app/page.tsx:4` is `force-static`, the whole dashboard is a static export. The "backend" builder's deliverable is a **TypeScript aggregation function + taxonomy + tests**, *not* an HTTP endpoint. "No N+1 queries" is satisfied trivially: one single pass over the in-memory `records` array.
- **Existing constants/functions to reuse:** `MONTHLY_TREND_MONTHS = 12`, `MONTHLY_TREND_TOP_CATEGORIES = 8`, `OTHER_ACTIONS_CODE = "OTHER_ACTIONS"`, `OTHER_ACTIONS_COLOR`, `UNDATED_ACTION_CODE = "UNREPORTED"`, `monthLabel()`, `shiftMonth()`, `pipelineEntryMonth()`, `primaryActionCode()`, `getActionStyle()` (`src/lib/map-data.ts`, the `ACTION_STYLES` map), `utcDateOnly()`.
- **Styles:** chart classes already in `src/app/globals.css` (`.pipeline-chart-wrap`, `.pipeline-metrics`, `.action-tooltip`, `.empty-state`, `.chart-note`, `.pipeline-panel`). Reuse them; add only a toggle-specific class.

---

## Findings (reachability — read before building)

1. **`applicant_type` is garbage in real data.** In `src/data/public-dashboard-data.json`, `applicant_type` holds `"717170002"`, `"717170001"`, `"717170000"`, or `""` — numeric-looking IDs, not "Developer"/"City Agency"/"State Agency". The test fixture (`tests/dashboard-analytics.test.tsx:30,82`) *assumes* values like `"Private"`/`"Public"`, which the collector never produces. **The `dcp-applicanttype` attribute mapped in `zap-collector.py:209` does not yield a meaningful type.** Therefore the toggle's applicant dimension **cannot** read `applicant_type` as-is.
2. **`primary_applicant` has real, usable names** — e.g. `"EDC - Economic Development Corporation for NYC"`, `"Azimuth Development Group"`, `"MJH Construction Corp."`, LLC/L.P. entities, individuals, law firms (`"Akerman LLP"`). No type is attached, but the name is the only available signal.
3. **No applicant-type classifier exists** in the codebase (`zap.ts`/`zap-leaders.ts` are a superseded legacy layer not wired into `DashboardExplorer`).

---

## Approach

Generalize the one existing trend builder to be dimension-parameterized, and add a dimension toggle to the existing chart. Two dimensions, one shape, one function, one chart. The applicant-type dimension is derived by a deterministic, testable name classifier because the source field is unusable (Decision D2 below; flagged for ratification).

Alternatives considered and rejected:
- **New "permits" endpoint/table.** Rejected: no permit data exists; violates the repo's naming discipline.
- **Read `applicant_type` directly.** Rejected: the field is numeric garbage (Finding 1).
- **Second, separate chart instead of a toggle.** Rejected: the user asked for a toggle on the existing card.

---

## 1. Source table/view and join/filter rules

- **Source object:** the exported records array (`DashboardRecord[]`) in `public-dashboard-data.json` — *not* a live SQLite query. The exporter already projects the needed fields; no exporter change is required for the action dimension.
- **Count unit:** one **application** = one record = one `project_id`. Each application is counted exactly once, in the month it entered review.
- **Entry-month rule (the "placed" date):** use `pipeline_start_date` (the collector's earliest real milestone). **Never** use `milestone_date` (latest movement) — that manufactures growth by sliding old projects into recent months. This is already the correct behavior in `pipelineEntryMonth()`; preserve it exactly.
- **Filter/join rules:** no joins. Apply in this order per record:
  1. Drop the record if `pipeline_start_date` is not a valid `YYYY-MM-DD` (increment `undatedCount`; exclude from every stack).
  2. Extract entry month = `pipeline_start_date.slice(0, 7)`.
  3. Keep only months inside the 12-month window (below); increment `priorWindowTotal` if in the prior window.
  4. Resolve the stack bucket via the active dimension (below).
- **Dimension selection:** `"action"` → `primaryActionCode(record)` (first non-empty `action_types[]` uppercased, else `"UNREPORTED"`). `"applicant"` → `classifyApplicantType(record.primary_applicant)` (new, Section 3).

## 2. Rolling 12-month window (exact definition)

- **Anchor:** `collected_through` = `max(last_updated_date)` across records (payload metadata, already computed by the exporter).
- **End month:** `endMonth = collected_through.slice(0, 7)` (`YYYY-MM`).
- **Start month:** `firstMonth = shiftMonth(endMonth, -(monthCount - 1))` with `monthCount = 12` ⇒ **current month + the 11 prior months, inclusive**.
- **Month keys:** `["YYYY-MM", …]`, exactly 12 entries, chronological, **zero-filled** even when a month has no data.
- **Partial month flag:** `partialMonth = (day-of-month of collected_through) < (last day of that month)` — the current month is disclosed as incomplete and can still grow.
- **Prior baseline:** the 12 months immediately before `firstMonth`, used for `priorWindowTotal` / `changePct`.
- **Year rollover:** `shiftMonth()` already handles `YYYY-01 → YYYY-12` via `Date.UTC`; do not hand-roll month arithmetic.
- This is identical to the existing `buildMonthlyActionTrend` window logic; the generalized function must reproduce it byte-for-byte.

## 3. Taxonomy and roll-up

### 3a. Action dimension (existing — preserve)
- Bucket = `primaryActionCode(record)` (uppercased ZAP action code), e.g. `ZM`, `ZR`, `ZS`.
- Label/color from `getActionStyle(code)` (`ACTION_STYLES`); unknown codes → gray fallback label `"Other ZAP action (<code>)"`; empty → `"Action not reported"`.
- **Roll-up:** rank buckets by window total desc (tiebreak code asc); keep top **8**; fold the remainder into `OTHER_ACTIONS` (`"Other actions (N)"`, color `#6b7770`). `UNDATED_ACTION_CODE = "UNREPORTED"` is a real bucket, not a roll-up.

### 3b. Applicant dimension (new)
**Taxonomy (6 buckets, fixed codes):**

| code | label | meaning |
|---|---|---|
| `DEVELOPER` | Private developer / owner | private LLC/L.P./corp, individuals, sponsors |
| `CITY_AGENCY` | City agency | NYC / DCP / HPD / EDC / Department of … |
| `STATE_AGENCY` | State agency | NYS / Empire State / HCR / New York State … |
| `PUBLIC_AUTHORITY` | Public authority | MTA / NYCHA / Port Authority / HDC … |
| `NONPROFIT` | Nonprofit / institution | HDFC / CDC / church / school / hospital / university / 501(c) … |
| `OTHER` | Other / not reported | unmatched names, empty/`"Unknown"` |

**Classification** (`classifyApplicantType(name: string): ApplicantTypeCode`) is a deterministic, ordered rule cascade over the uppercased, trimmed `primary_applicant` string — first match wins; empty/whitespace/`"UNKNOWN"` → `OTHER`. Seed rules (regex, case-insensitive, word-bounded where noted):

1. `CITY_AGENCY`: `\b(NYC|DCP|DEPARTMENT OF|EDC|ECONOMIC DEVELOPMENT|HPD|HOUSING PRESERVATION|CITY OF NEW YORK|CITY PLANNING)\b`
2. `STATE_AGENCY`: `\b(NYS|NEW YORK STATE|EMPIRE STATE|HCR|STATE OF NEW YORK)\b`
3. `PUBLIC_AUTHORITY`: `\b(MTA|NYCHA|PORT AUTHORITY|HDC|HOUSING DEVELOPMENT CORPORATION|TRANSIT AUTHORITY|BATTERY PARK CITY AUTHORITY)\b`
4. `NONPROFIT`: `\b(HDFC|HOUSING DEVELOPMENT FUND|CDC|COMMUNITY DEVELOPMENT CORP|CHURCH|SYNAGOGUE|NON-?PROFIT|UNIVERSITY|COLLEGE|SCHOOL|HOSPITAL|501|FOUNDATION)\b`
5. `DEVELOPER` (default for any remaining non-empty name): contains an entity/developer marker `\b(LLC|L\.?P\.?|LLP|INC|CORP|HOLDINGS|DEVELOPMENT|REALTY|GROUP|PROPERTIES|ASSOCIATES|VENTURES|PARTNERS|TRUST|ESTATE|CONDOMINIUM)\b` — otherwise also `DEVELOPER` (private individual/attorney names default here).
6. `OTHER` for everything else (empty, `"UNKNOWN"`, unmatched).

> **This classifier is the recommended default and is flagged for ratification (Decision D2).** It is a pragmatic name heuristic; it will misclassify some entities (e.g. an attorney appearing as the named applicant defaults to `DEVELOPER`). The firm contract is the *bucket set + roll-up semantics*; the *seed rules* are the initial implementation, isolated in one function so Andrew can tune the rules or swap in a real data field later without touching the chart.

**Colors** — add a parallel `APPLICANT_TYPE_STYLES` map (stable hex, distinct from `ACTION_STYLES`): `DEVELOPER #0a6640`, `CITY_AGENCY #1682a3`, `STATE_AGENCY #6f4c9b`, `PUBLIC_AUTHORITY #e77728`, `NONPROFIT #9c4f96`, `OTHER #6b7770`.

**Roll-up:** same top-N pattern as actions, but **top 5 + `OTHER` as the natural sixth bucket** (since `OTHER` is itself a taxonomy bucket, do not create a second "Other applicants" bucket; `OTHER` *is* the roll-up). Buckets with zero window total are omitted from `categories` (so the legend never shows empty types), but a zero-count month still renders a zero-height bar.

## 4. Aggregation query shape and response schema

**Shape:** one pure function; no SQL, no HTTP. Single pass over `records` (O(n)):

```ts
// src/lib/dashboard-analytics.ts

export type TrendDimension = "action" | "applicant";

export interface MonthlyTrendCategory {
  code: string;    // dimension-scoped stable code: "ZM" | "OTHER_ACTIONS" | "DEVELOPER" | "OTHER" | "UNREPORTED" …
  label: string;   // human label, e.g. "Zoning Map Amendment", "Other actions (3)", "Private developer / owner"
  color: string;   // hex, from ACTION_STYLES / APPLICANT_TYPE_STYLES / fallback
  total: number;   // window total for this bucket
}

export interface MonthlyTrendRow {
  month: string;                 // "YYYY-MM" key
  label: string;                 // "Nov '26" via monthLabel()
  total: number;                 // sum of all buckets this month (== count of applications)
  [code: string]: number | string; // one numeric property per category code, zero-filled
}

export interface MonthlyTrend {
  dimension: TrendDimension;
  months: string[];              // exactly 12 "YYYY-MM", chronological
  rows: MonthlyTrendRow[];       // exactly 12, zero-filled, chronological
  categories: MonthlyTrendCategory[]; // stable order (by total desc, tiebreak code asc)
  groupedCodes: string[];        // bucket codes folded into the roll-up bucket
  windowStart: string;           // first month key
  windowEnd: string;             // endMonth key
  windowTotal: number;           // applications in window (all buckets)
  priorWindowTotal: number;      // applications in the prior 12 months
  changePct: number | null;      // null when priorWindowTotal === 0
  undatedCount: number;          // records excluded for missing pipeline_start_date
  partialMonth: boolean;         // current month is incomplete
}

export function buildMonthlyTrend(
  records: DashboardRecord[],
  collectedThrough: string,
  dimension: TrendDimension,
  opts?: { monthCount?: number; topCategories?: number },
): MonthlyTrend;
```

**Backward-compat shim:** re-export the existing behavior unchanged so the current card and its tests keep passing:

```ts
export function buildMonthlyActionTrend(records, collectedThrough, monthCount?, topCategories?): MonthlyActionTrend {
  return buildMonthlyTrend(records, collectedThrough, "action", { monthCount, topCategories }) as MonthlyActionTrend;
}
```

(`MonthlyActionTrend` becomes a type alias or is kept as a narrower view of `MonthlyTrend`; do **not** change its existing public shape.)

**Key invariants (the contract the frontend and tests both rely on):**
- `rows.length === months.length === 12`, always (zero-filled months appear).
- For every row, `total === sum over categories of row[category.code]`.
- Sum over all rows of `row.total === windowTotal`.
- `windowTotal` is **identical** across both dimensions for the same input (each application contributes to exactly one bucket in each dimension).
- `categories` are ordered identically to `ACTION_STYLES`/`APPLICANT_TYPE_STYLES` roll-up order and are stable for a fixed snapshot.

**Serialization note:** nothing new is serialized to `public-dashboard-data.json`. The source fields (`pipeline_start_date`, `action_types`, `primary_applicant`, and the (broken) `applicant_type`) are already allowlisted. If Andrew later ratifies capturing a *real* applicant-type field (Decision D2 Option B), that is a separate collector + exporter + snapshot change, isolated from this card.

## 5. Frontend component contract

**Component:** generalize `MonthlyPipelineChart` into a dimension-aware chart (recommend renaming to `MonthlyTrendChart` and keeping a `MonthlyPipelineChart` alias), or keep it and wrap it. Props:

```ts
interface MonthlyTrendChartProps {
  trend: MonthlyTrend;
  dimension: TrendDimension;
  onDimensionChange: (dimension: TrendDimension) => void;
}
```

- **Toggle:** a two-option segmented control rendered as a radio group — `role="radiogroup"`, `aria-label="Stack chart by"`, each option a real `<input type="radio">` with a visible `<label>` ("Application type" / "Applicant type"). The active option carries `aria-checked` semantics via the native radio state; the group is keyboard-navigable (arrow keys) for free. Do not use a `<select>` (the user asked for a "toggle") and do not use two `<button>`s (radios give correct a11y and state for free).
- **x-axis:** 12 calendar months, chronological left→right, `dataKey="label"`, `interval={0}` (existing behavior).
- **y-axis:** number of applications, `allowDecimals={false}`.
- **Stacks:** one `<Bar>` per `trend.categories`, shared `stackId`, `fill={category.color}`, `name={category.label}`, `maxBarSize={44}`.
- **Legend + tooltip:** reuse the existing `PipelineTooltip` pattern (top = monthly total, then per-bucket counts sorted desc); render a `.chart-note` caption that changes with `dimension` and discloses: each application counts once, the month is its pipeline-entry month, and (in applicant mode) that applicant type is *inferred from the named applicant* and "is not necessarily the developer/owner." Keep the existing `partialMonth` + `undatedCount` disclosure.
- **Loading:** the payload is static (SSR-prerendered), so there is no client fetch in the current architecture; however the component **must** still render a deterministic skeleton (`role="status"`, `aria-label="Loading chart"`) if `trend` is null/undefined, and the integrator wires it to whatever async source the endpoint task introduces. Provide the skeleton now.
- **Empty:** if no application has a `pipeline_start_date` inside the window (i.e. `rows.every(r => r.total === 0)`), render the existing `.empty-state` text (mirror `MonthlyPipelineChart`'s current message) instead of the chart.
- **Error:** the aggregation is pure and cannot throw on valid input; if payload validation fails (`loadDashboardPayload` already throws), the dashboard falls back to its existing behavior. Add a defensive `try/catch`-free, null-guarded render path (no chart, empty-state text) when `trend.rows.length === 0`.
- **Accessibility:** wrap the chart in `role="img"` with an `aria-label` that includes the dimension and window (existing pattern): e.g. `"Stacked bar chart of applications entering the ZAP review pipeline per month, Dec '25–Nov '26, stacked by applicant type"`. Provide the toggle *outside* the `role="img"` element. Keep the legend as visible text; do not rely on color alone (labels are always present in tooltip + legend).
- **Responsive:** `ResponsiveContainer width="100%" height={360}` (existing); toggle wraps on narrow screens via existing utility classes.

**Wiring in `DashboardExplorer.tsx`:** add `const [trendDimension, setTrendDimension] = useState<TrendDimension>("action")`, compute `const trend = useMemo(() => buildMonthlyTrend(payload.records, payload.collected_through, trendDimension), […])`, and render `<MonthlyTrendChart trend={trend} dimension={trendDimension} onDimensionChange={setTrendDimension} />` inside the existing `pipeline-panel` section. The `.pipeline-metrics` (trailing / prior / change) block stays dimension-agnostic (it reads `windowTotal`, which is identical across dimensions).

## 6. Test cases

**Vitest (`tests/dashboard-analytics.test.tsx` or a new `tests/monthly-trend.test.ts`):**

1. **Window boundaries:** for a fixed `collectedThrough`, `months` is exactly the current month + 11 prior, chronological; a December anchor rolls the year correctly (`2026-12` → `["2026-01",…,"2026-12"]`); `windowStart`/`windowEnd` correct.
2. **Zero-fill:** a month with no records appears with `total === 0` and every bucket `0`; a bucket with no records is omitted from `categories` but a `0` column still renders in rows.
3. **Partial month:** `partialMonth` true when `collected_through` is mid-month, false on the last day.
4. **Grouping + roll-up (action):** >8 distinct codes → top 8 kept, remainder folded into `OTHER_ACTIONS` with `groupedCodes` listing them; totals reconcile.
5. **Grouping + roll-up (applicant):** >5 non-`OTHER` buckets → top 5 + `OTHER`; empty/`"Unknown"`/unmatched names land in `OTHER`.
6. **Classifier unit tests:** one per seed rule (a city-agency name, state-agency, authority, nonprofit, developer/LLC, individual defaulting to `DEVELOPER`, empty → `OTHER`), case-insensitive, and first-match precedence (e.g. a name matching both nonprofit and developer rules).
7. **Dimension invariance:** `buildMonthlyTrend(records, ct, "action").windowTotal === buildMonthlyTrend(records, ct, "applicant").windowTotal`; and per-row `total` equals the sum of that row's buckets for *both* dimensions.
8. **Undated exclusion:** records with empty/invalid `pipeline_start_date` are excluded from every stack and counted exactly once in `undatedCount`.
9. **Response shape:** the returned object matches the `MonthlyTrend` schema (12 months, 12 rows, categories ordered, numeric bucket props).
10. **Backward compat:** existing `buildMonthlyActionTrend` tests (already present) still pass unchanged after the generalization.
11. **Frontend render (vitest + `renderToStaticMarkup`, matching the existing test style):** toggle renders both options with correct `role="radiogroup"`/labels; `role="img"` aria-label reflects the active dimension; zero-row trend renders `.empty-state`; skeleton renders when `trend` is null.

**Python (only if Decision D2 Option B is ratified later):** add `tests/test_export_public_dashboard_data.py` cases for the new allowlisted field; no Python change is required for this card as specified.

---

## Acceptance criteria

1. A two-position toggle ("Application type" / "Applicant type") appears on the existing trailing-12-month stacked-bar card and switches the stack dimension in place; the action dimension renders identically to today's shipped card.
2. `buildMonthlyTrend(records, collectedThrough, "action")` reproduces `buildMonthlyActionTrend` byte-for-byte (existing tests green, unchanged).
3. The applicant dimension classifies every application into exactly one of the 6 buckets; empty/unknown names roll into `OTHER`; legend shows only non-empty buckets.
4. `windowTotal` is identical across dimensions; every row's `total` equals the sum of its buckets; all 12 months are present and zero-filled.
5. The response object matches the `MonthlyTrend` schema in Section 4 (no new serialized JSON, no runtime HTTP endpoint introduced).
6. Loading skeleton, empty state, and defensive no-data render path are present; `role="img"` aria-label includes the active dimension + window; toggle is a keyboard-accessible radio group.
7. `npm test` (Vitest + Python unittest) and `npm run lint` pass; no console errors.
8. PLAN.md remains the single source of truth the two builders read; no builder re-decides taxonomy, window, schema, or component props.

## Artifact map

- `src/lib/dashboard-analytics.ts` (modify) — add `TrendDimension`, `MonthlyTrend`, `buildMonthlyTrend`, `classifyApplicantType`, `APPLICANT_TYPE_STYLES`; keep `buildMonthlyActionTrend` as a shim.
- `src/lib/map-data.ts` (no change) — `ACTION_STYLES` / `getActionStyle` reused as-is.
- `src/components/MonthlyTrendChart.tsx` (new) or `MonthlyPipelineChart.tsx` (modify) — dimension-aware chart + toggle + states + a11y.
- `src/components/DashboardExplorer.tsx` (modify) — dimension state + memoized `buildMonthlyTrend` + wiring.
- `src/app/globals.css` (modify, small) — toggle control styles only.
- `tests/monthly-trend.test.ts` (new) + `tests/dashboard-analytics.test.tsx` (modify) — Section 6 cases.
- `notes/plans/20261101-permit-trend-toggle/PLAN.md` (copy this file into the repo, following the `notes/plans/` convention) + a dated `notes/DEVLOG.md` entry.
- DevOS: no new tasks needed for this card; cite the existing `DEV-###` root id in commits.

## Steps (builder order — backend and frontend proceed in parallel on the contract)

1. **Backend (t_8189238d):** implement `TrendDimension` + `MonthlyTrend` + `classifyApplicantType` + `APPLICANT_TYPE_STYLES` + `buildMonthlyTrend` in `dashboard-analytics.ts`; keep `buildMonthlyActionTrend` shim. Write `tests/monthly-trend.test.ts` (TDD, Section 6 cases 1–9 + 11). Run `npx vitest run`. Commit.
2. **Frontend (t_54ee482e):** implement `MonthlyTrendChart` (toggle + stacks + tooltip + legend + skeleton/empty + a11y) against mock fixtures that match the `MonthlyTrend` schema (do not fetch; do not wire to production). Write the render tests (case 11). Run `npm run lint` + vitest. Commit.
3. **Integrator (t_f4d30975):** wire `buildMonthlyTrend` + `MonthlyTrendChart` into `DashboardExplorer.tsx` with the dimension state; remove mocks; verify end-to-end against a seeded payload (window correct, stacks sum, legend matches, zero months render, tooltips accurate, responsive); run `npm test` + `npm run lint` + `npm run build`. Copy this PLAN.md to `notes/plans/20261101-permit-trend-toggle/PLAN.md`; append `notes/DEVLOG.md`. Commit; report back to spec.

## Risks / open questions

1. **D1 — terminology (RESOLVED by the repo, restated here).** "Permits" → "applications." Do not reintroduce "permits"/"DOB" wording in code, tests, or UI copy; the repo test/comment history treats it as incorrect.
2. **D2 — applicant-type data source (NEEDS ANDREW RATIFICATION before the applicant dimension is considered final).** `applicant_type` is numeric garbage. Recommended: **Option A** — ship the name-heuristic `classifyApplicantType` now (Section 3b), clearly disclosing in the chart note that applicant type is *inferred* and may misclassify. **Option B** — first investigate whether the ZAP API exposes a real applicant-type attribute elsewhere (collector + exporter + snapshot change, separate task), then replace the classifier. The card is structured so B can replace A's internals without touching the chart or schema. The action dimension and the toggle scaffolding are **not** blocked by this decision.
3. **D3 — classifier precision.** Name heuristics will misclassify attorneys/consultants named as applicant as `DEVELOPER`. Accepted for a first cut; the disclosure text is the mitigation, and `OTHER` absorbs true unknowns.
4. **Right-censoring** of the newest months (partial month) is already disclosed; preserve that copy in both dimensions.
5. **No runtime endpoint exists** in this static app. If the integrator expects to "wire to a live endpoint," that expectation is wrong for this architecture — the aggregation is a pure TS function over the prerendered payload; flag this to the backend builder explicitly.
