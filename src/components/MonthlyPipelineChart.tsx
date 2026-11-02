"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  monthLabel,
  type MonthlyActionCategory,
  type MonthlyActionTrend,
} from "../lib/dashboard-analytics";

interface TooltipEntry {
  value?: unknown;
  dataKey?: unknown;
  name?: unknown;
}

function formatShortDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Compact tooltip: largest category first, count column, no default chrome. */
function PipelineTooltip({
  active,
  payload,
  label,
  categories,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  categories: MonthlyActionCategory[];
}) {
  if (!active || !payload?.length) return null;
  const colors = new Map(categories.map((category) => [category.code, category]));
  const items = [...payload]
    .filter((entry) => Number(entry.value) > 0)
    .sort((left, right) => Number(right.value) - Number(left.value));
  const total = items.reduce((sum, entry) => sum + Number(entry.value), 0);
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
        {items.map((entry) => {
          const code = String(entry.dataKey ?? entry.name);
          const category = colors.get(code);
          return (
            <li key={code}>
              <i style={{ background: category?.color ?? "#6b7770" }} />
              <span className="action-tooltip-count">{String(entry.value)}</span>
              <span className="action-tooltip-label">{category?.label ?? code}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function MonthlyPipelineChart({
  trend,
  collectedThrough,
}: {
  trend: MonthlyActionTrend;
  collectedThrough: string;
}) {
  if (!trend.rows.some((row) => row.total > 0)) {
    return (
      <p className="empty-state">
        No applications with a reported pipeline-entry date fall inside the trailing 12 months.
      </p>
    );
  }

  const windowText = `${monthLabel(trend.windowStart)}–${monthLabel(trend.windowEnd)}`;
  const lastMonth = trend.rows.at(-1);

  return (
    <div
      className="pipeline-chart-wrap"
      role="img"
      aria-label={`Stacked bar chart of applications entering the ZAP review pipeline per month, ${windowText}, split by primary ZAP action type`}
    >
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={trend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #ddd)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
          <Tooltip cursor={{ fill: "rgba(10, 102, 64, 0.06)" }} content={<PipelineTooltip categories={trend.categories} />} />
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
      {lastMonth?.total === 0 && (
        <p className="chart-note">
          {monthLabel(trend.windowEnd)} shows no entries yet — collection through{" "}
          {formatShortDate(collectedThrough)} is inside that month.
        </p>
      )}
    </div>
  );
}
