"use client";

/**
 * Dimension-aware trailing-12-month stacked bar card for ZapDash.
 *
 * The card counts applications entering the ZAP review pipeline per calendar
 * month and stacks them by either the application's primary ZAP action type or
 * the (inferred) applicant type. The aggregation itself lives in
 * `src/lib/dashboard-analytics.ts` (`buildMonthlyTrend`); this component renders
 * whatever trend object it is handed and never fetches.
 *
 * The prop types below are a structural subset of the `MonthlyTrend` /
 * `TrendDimension` contract in PLAN.md §4, so the integrator can pass the
 * analytics output straight in without casts or adapters.
 *
 * NOTE on disclosure copy: this component owns the chart note (measure, stack
 * dimension, partial month, undated exclusions). The panel-level `.chart-note`
 * in DashboardExplorer must be dropped when this chart is wired in, otherwise
 * the copy renders twice.
 */

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  monthLabel,
  type MonthlyTrend,
  type MonthlyTrendCategory,
  type MonthlyTrendRow,
  type TrendDimension,
} from "../lib/dashboard-analytics";

/**
 * The card takes the analytics contract types directly so the integrator can
 * pass `buildMonthlyTrend()` output through without casts. Re-exported under the
 * names the chart and its fixtures use.
 */
export type { MonthlyTrend, MonthlyTrendCategory, MonthlyTrendRow, TrendDimension };
export type TrendCategory = MonthlyTrendCategory;
export type TrendRow = MonthlyTrendRow;
export type TrendData = MonthlyTrend;

interface TooltipEntry {
  value?: unknown;
  dataKey?: unknown;
  name?: unknown;
}

export interface TrendTooltipItem {
  code: string;
  label: string;
  color: string;
  count: number;
}

const DIMENSION_OPTIONS: ReadonlyArray<{ value: TrendDimension; label: string }> = [
  { value: "action", label: "Application type" },
  { value: "applicant", label: "Applicant type" },
];

/** Wording used in the chart's accessible name for each dimension. */
const DIMENSION_ARIA: Record<TrendDimension, string> = {
  action: "primary ZAP action type",
  applicant: "inferred applicant type",
};

const STACK_COPY: Record<TrendDimension, string> = {
  action:
    "Stacks are the application's primary ZAP action type — the same discretionary actions the map colours by. These are zoning actions, not construction permits issued by the Department of Buildings.",
  applicant:
    "Stacks infer the applicant type from the named applicant (private developer or owner, city agency, state agency, public authority, nonprofit, other). The classification is a best guess from the applicant's name: the named applicant is not necessarily the developer or owner.",
};

/**
 * Turn the recharts payload for one hovered month into sorted, zero-filtered
 * tooltip rows plus the monthly total. Pure so the tooltip arithmetic is
 * testable without a DOM.
 */
export function buildTooltipItems(
  payload: ReadonlyArray<TooltipEntry> | undefined,
  categories: ReadonlyArray<TrendCategory>,
): { total: number; items: TrendTooltipItem[] } {
  const byCode = new Map(categories.map((category) => [category.code, category]));
  const items = (payload ?? [])
    .map((entry) => {
      const code = String(entry.dataKey ?? entry.name ?? "");
      const category = byCode.get(code);
      return {
        code,
        label: category?.label ?? code,
        color: category?.color ?? "#6b7770",
        count: Number(entry.value) || 0,
      };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return { total: items.reduce((sum, item) => sum + item.count, 0), items };
}

/** Compact tooltip: monthly total first, then per-bucket counts largest first. */
function TrendTooltip({
  active,
  payload,
  label,
  categories,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  categories: ReadonlyArray<TrendCategory>;
}) {
  if (!active) return null;
  const { total, items } = buildTooltipItems(payload, categories);
  if (!total) {
    return (
      <div className="action-tooltip">
        <p className="action-tooltip-title">{label} · no reported applications</p>
      </div>
    );
  }
  return (
    <div className="action-tooltip">
      <p className="action-tooltip-title">
        {label} · {total} application{total === 1 ? "" : "s"}
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.code}>
            <i style={{ background: item.color }} />
            <span className="action-tooltip-count">{item.count}</span>
            <span className="action-tooltip-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Deterministic loading placeholder; heights never change between renders. */
const SKELETON_HEIGHTS = [42, 58, 35, 66, 50, 72, 44, 61, 38, 55, 47, 69];

function ChartSkeleton() {
  return (
    <div className="pipeline-chart-wrap" role="status" aria-label="Loading chart">
      <div className="chart-skeleton" aria-hidden="true">
        {SKELETON_HEIGHTS.map((height, index) => (
          <span key={index} className="chart-skeleton-bar" style={{ height: `${height}%` }} />
        ))}
      </div>
      <p className="chart-note">Loading applications per month…</p>
    </div>
  );
}

function TrendToggle({
  dimension,
  onDimensionChange,
}: {
  dimension: TrendDimension;
  onDimensionChange: (dimension: TrendDimension) => void;
}) {
  return (
    <div className="trend-toggle-row">
      <div className="trend-toggle" role="radiogroup" aria-label="Stack chart by">
        {DIMENSION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`trend-toggle-option${dimension === option.value ? " is-active" : ""}`}
          >
            <input
              type="radio"
              name="trend-dimension"
              value={option.value}
              checked={dimension === option.value}
              onChange={() => onDimensionChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <p className="trend-toggle-hint">
        Switch the stack between what kind of application it is and who is asking.
      </p>
    </div>
  );
}

/**
 * Screen-reader accessible version of the stacked data. The legend and tooltip
 * carry the labels visually; this table gives the same numbers as text so the
 * chart is never colour-only.
 */
function TrendDataTable({ trend, dimension }: { trend: TrendData; dimension: TrendDimension }) {
  const windowText = `${monthLabel(trend.windowStart)}–${monthLabel(trend.windowEnd)}`;
  return (
    <table className="visually-hidden">
      <caption>
        Applications entering the ZAP review pipeline per month, {windowText}, stacked by{" "}
        {DIMENSION_ARIA[dimension]}
      </caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          {trend.categories.map((category) => (
            <th key={category.code} scope="col">
              {category.label}
            </th>
          ))}
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {trend.rows.map((row) => (
          <tr key={row.month}>
            <th scope="row">{row.label}</th>
            {trend.categories.map((category) => (
              <td key={category.code}>{Number(row[category.code] ?? 0)}</td>
            ))}
            <td>{row.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartNote({ trend, dimension }: { trend: TrendData; dimension: TrendDimension }) {
  const incomplete =
    trend.partialMonth && trend.windowEnd
      ? ` ${monthLabel(trend.windowEnd)} is incomplete: it can still grow as ZAP publishes later milestones.`
      : "";
  const undated = trend.undatedCount
    ? ` ${trend.undatedCount} tracked record${trend.undatedCount === 1 ? "" : "s"} carr${
        trend.undatedCount === 1 ? "ies" : "y"
      } no milestone date and ${trend.undatedCount === 1 ? "is" : "are"} excluded.`
    : "";

  return (
    <p className="chart-note">
      Each application counts once, in the month ZAP records its first milestone — the point it
      entered review. {STACK_COPY[dimension]}
      {incomplete}
      {undated}
    </p>
  );
}

export default function MonthlyTrendChart({
  trend,
  dimension,
  onDimensionChange,
}: {
  trend: TrendData | null | undefined;
  dimension: TrendDimension;
  onDimensionChange: (dimension: TrendDimension) => void;
}) {
  if (!trend) return <ChartSkeleton />;

  const hasRows = trend.rows.length > 0;
  if (!hasRows) {
    return (
      <div className="pipeline-chart-wrap">
        <TrendToggle dimension={dimension} onDimensionChange={onDimensionChange} />
        <p className="empty-state">
          No collection date is available for this snapshot, so the trailing 12 months cannot be
          charted.
        </p>
      </div>
    );
  }

  const hasEntries = trend.rows.some((row) => row.total > 0);
  if (!hasEntries) {
    return (
      <div className="pipeline-chart-wrap">
        <TrendToggle dimension={dimension} onDimensionChange={onDimensionChange} />
        <p className="empty-state">
          No applications with a reported pipeline-entry date fall inside the trailing 12 months.
        </p>
      </div>
    );
  }

  const windowText = `${monthLabel(trend.windowStart)}–${monthLabel(trend.windowEnd)}`;

  return (
    <div className="pipeline-chart-wrap">
      <TrendToggle dimension={dimension} onDimensionChange={onDimensionChange} />
      <ChartNote trend={trend} dimension={dimension} />
      <div
        role="img"
        aria-label={`Stacked bar chart of applications entering the ZAP review pipeline per month, ${windowText}, stacked by ${DIMENSION_ARIA[dimension]}`}
      >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={trend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #ddd)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip
              cursor={{ fill: "rgba(10, 102, 64, 0.06)" }}
              content={<TrendTooltip categories={trend.categories} />}
            />
            <Legend
              verticalAlign="bottom"
              align="left"
              iconType="square"
              iconSize={9}
              height={46}
              wrapperStyle={{ overflowY: "auto", maxHeight: 50, paddingTop: 8 }}
              formatter={(value) => <span style={{ fontSize: 11, color: "inherit" }}>{value}</span>}
            />
            {trend.categories.map((category) => (
              <Bar
                key={category.code}
                dataKey={category.code}
                stackId="applications"
                fill={category.color}
                name={category.label}
                maxBarSize={44}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TrendDataTable trend={trend} dimension={dimension} />
    </div>
  );
}
