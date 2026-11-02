/**
 * Mock `MonthlyTrend` payloads for the dimension-aware trend card.
 *
 * These mirror the contract in PLAN.md §4 exactly (12 zero-filled months,
 * per-row `total` equal to the sum of its buckets) so the frontend card can be
 * built and tested before `buildMonthlyTrend` lands. Rows and category totals
 * are computed from a sparse count matrix, which keeps the fixtures internally
 * consistent instead of hand-typed.
 */

import { monthLabel } from "../../src/lib/dashboard-analytics";
import type { TrendCategory, TrendData, TrendDimension, TrendRow } from "../../src/components/MonthlyTrendChart";

/** Dec '25 – Nov '26: the 12 months ending at the 2026-11-02 collection date. */
export const FIXTURE_MONTHS = [
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
];

export interface CategorySeed {
  code: string;
  label: string;
  color: string;
}

export interface MockTrendSpec {
  dimension: TrendDimension;
  categories: CategorySeed[];
  /** month key -> bucket code -> count. Months with no entry are zero-filled. */
  counts: Record<string, Record<string, number>>;
  priorWindowTotal?: number;
  undatedCount?: number;
  partialMonth?: boolean;
}

/** Build a contract-shaped trend object from a sparse count matrix. */
export function buildMockTrend(spec: MockTrendSpec): TrendData {
  const categoryTotals = new Map(spec.categories.map((category) => [category.code, 0]));

  const rows: TrendRow[] = FIXTURE_MONTHS.map((month) => {
    const row: TrendRow = { month, label: monthLabel(month), total: 0 };
    for (const category of spec.categories) row[category.code] = 0;
    let total = 0;
    for (const [code, count] of Object.entries(spec.counts[month] ?? {})) {
      if (!categoryTotals.has(code)) throw new Error(`unknown bucket ${code} in ${month}`);
      row[code] = count;
      total += count;
      categoryTotals.set(code, (categoryTotals.get(code) ?? 0) + count);
    }
    row.total = total;
    return row;
  });

  const categories: TrendCategory[] = spec.categories
    .map((category) => ({ ...category, total: categoryTotals.get(category.code) ?? 0 }))
    .sort((left, right) => right.total - left.total || left.code.localeCompare(right.code));

  const windowTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    dimension: spec.dimension,
    months: [...FIXTURE_MONTHS],
    rows,
    categories,
    groupedCodes: [],
    windowStart: FIXTURE_MONTHS[0],
    windowEnd: FIXTURE_MONTHS[FIXTURE_MONTHS.length - 1],
    windowTotal,
    priorWindowTotal: spec.priorWindowTotal ?? 101,
    changePct: spec.priorWindowTotal ? Math.round(((windowTotal - spec.priorWindowTotal) / spec.priorWindowTotal) * 100) : null,
    undatedCount: spec.undatedCount ?? 18,
    partialMonth: spec.partialMonth ?? true,
  };
}

const APPLICANT_CATEGORIES: CategorySeed[] = [
  { code: "DEVELOPER", label: "Private developer / owner", color: "#0a6640" },
  { code: "CITY_AGENCY", label: "City agency", color: "#1682a3" },
  { code: "STATE_AGENCY", label: "State agency", color: "#6f4c9b" },
  { code: "PUBLIC_AUTHORITY", label: "Public authority", color: "#e77728" },
  { code: "OTHER", label: "Other / not reported", color: "#6b7770" },
];

const ACTION_CATEGORIES: CategorySeed[] = [
  { code: "ZM", label: "Zoning Map Amendment", color: "#0a6640" },
  { code: "ZR", label: "Zoning Resolution Amendment", color: "#1682a3" },
  { code: "ZS", label: "Zoning Special Permit", color: "#6f4c9b" },
  { code: "OTHER_ACTIONS", label: "Other actions (2)", color: "#6b7770" },
];

/**
 * Many permit/applicant types, including two zero-count months (Jan '26,
 * Jun '26) and one bucket that only appears late (PUBLIC_AUTHORITY).
 */
export const manyTypesTrend = buildMockTrend({
  dimension: "applicant",
  categories: APPLICANT_CATEGORIES,
  priorWindowTotal: 101,
  undatedCount: 18,
  counts: {
    "2025-12": { DEVELOPER: 6, CITY_AGENCY: 2, OTHER: 1 },
    "2026-01": {},
    "2026-02": { DEVELOPER: 9, CITY_AGENCY: 3 },
    "2026-03": { DEVELOPER: 7, STATE_AGENCY: 2, OTHER: 2 },
    "2026-04": { DEVELOPER: 11, CITY_AGENCY: 4 },
    "2026-05": { DEVELOPER: 8, STATE_AGENCY: 3, OTHER: 1 },
    "2026-06": {},
    "2026-07": { DEVELOPER: 10, CITY_AGENCY: 2 },
    "2026-08": { DEVELOPER: 12, PUBLIC_AUTHORITY: 1 },
    "2026-09": { DEVELOPER: 9, CITY_AGENCY: 5, OTHER: 2 },
    "2026-10": { DEVELOPER: 7, STATE_AGENCY: 1, PUBLIC_AUTHORITY: 2 },
    "2026-11": { DEVELOPER: 3, CITY_AGENCY: 1 },
  },
});

/** Exactly one stack segment: the chart must still render a single-colour bar. */
export const singleTypeTrend = buildMockTrend({
  dimension: "action",
  categories: [{ code: "ZM", label: "Zoning Map Amendment", color: "#0a6640" }],
  priorWindowTotal: 0,
  undatedCount: 0,
  partialMonth: false,
  counts: {
    "2026-02": { ZM: 4 },
    "2026-05": { ZM: 2 },
    "2026-09": { ZM: 7 },
  },
});

/** Action dimension with a roll-up bucket, mirroring the shipped card. */
export const actionTrend = buildMockTrend({
  dimension: "action",
  categories: ACTION_CATEGORIES,
  counts: {
    "2025-12": { ZM: 3, ZR: 1 },
    "2026-02": { ZS: 2, OTHER_ACTIONS: 1 },
    "2026-05": { ZM: 5, ZR: 2 },
    "2026-08": { ZM: 4, ZS: 1 },
    "2026-11": { ZR: 2 },
  },
});

/** 12 months, but nothing entered review inside the window. */
export const emptyTrend = buildMockTrend({
  dimension: "action",
  categories: [],
  priorWindowTotal: 0,
  undatedCount: 3,
  partialMonth: false,
  counts: {},
});

/** Defensive path: the collection date was unusable, so there is no window. */
export const noWindowTrend: TrendData = {
  dimension: "action",
  months: [],
  rows: [],
  categories: [],
  groupedCodes: [],
  windowStart: "",
  windowEnd: "",
  windowTotal: 0,
  priorWindowTotal: 0,
  changePct: null,
  undatedCount: 0,
  partialMonth: false,
};
