import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Bar } from "recharts";
import { describe, expect, it } from "vitest";

import MonthlyTrendChart, {
  buildTooltipItems,
  type TrendCategory,
  type TrendData,
} from "../src/components/MonthlyTrendChart";

import {
  FIXTURE_MONTHS,
  actionTrend,
  buildMockTrend,
  emptyTrend,
  manyTypesTrend,
  noWindowTrend,
  singleTypeTrend,
} from "./fixtures/monthly-trend";

const noop = () => {};

function render(trend: TrendData | null, dimension: TrendData["dimension"] = trend?.dimension ?? "action"): string {
  return renderToStaticMarkup(
    <MonthlyTrendChart trend={trend} dimension={dimension} onDimensionChange={noop} />,
  );
}

/**
 * Render the component to its element tree (invoking the function directly, so
 * nested chart/inputs are visible to the walkers below).
 */
function chartTree(
  trend: TrendData,
  dimension: TrendData["dimension"],
  onDimensionChange: (dimension: TrendData["dimension"]) => void = noop,
) {
  return MonthlyTrendChart({ trend, dimension, onDimensionChange });
}

/** Collect every recharts `<Bar>` element from the chart's element tree. */
function findBars(node: unknown, found: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) findBars(child, found);
    return found;
  }
  if (node && typeof node === "object" && "props" in (node as object)) {
    const element = node as ReactElement<Record<string, unknown>>;
    if (element.type === Bar) found.push(element);
    const children = (element.props as { children?: unknown })?.children;
    if (children) findBars(children, found);
  }
  return found;
}

/** Numeric column sum for a bucket code across the fixture rows. */
function columnSum(trend: TrendData, code: string): number {
  return trend.rows.reduce((sum, row) => sum + Number(row[code] ?? 0), 0);
}

describe("monthly trend fixtures", () => {
  const fixtures = { manyTypesTrend, singleTypeTrend, actionTrend, emptyTrend };

  it("cover 12 zero-filled chronological months ending in Nov '26", () => {
    for (const trend of Object.values(fixtures)) {
      expect(trend.months).toEqual(FIXTURE_MONTHS);
      expect(trend.rows.map((row) => row.month)).toEqual(FIXTURE_MONTHS);
      expect(trend.windowStart).toBe("2025-12");
      expect(trend.windowEnd).toBe("2026-11");
    }
  });

  it("keep every row total equal to the sum of its buckets", () => {
    for (const trend of Object.values(fixtures)) {
      for (const row of trend.rows) {
        const bucketSum = trend.categories.reduce(
          (sum, category) => sum + Number(row[category.code] ?? 0),
          0,
        );
        expect(row.total).toBe(bucketSum);
      }
      expect(trend.windowTotal).toBe(trend.rows.reduce((sum, row) => sum + row.total, 0));
    }
  });

  it("report category totals that reconcile with the row columns", () => {
    for (const trend of Object.values(fixtures)) {
      for (const category of trend.categories) {
        expect(category.total).toBe(columnSum(trend, category.code));
      }
      expect(trend.categories.reduce((sum, category) => sum + category.total, 0)).toBe(trend.windowTotal);
    }
  });

  it("include zero-count months and a late-appearing bucket", () => {
    const zeroMonths = manyTypesTrend.rows.filter((row) => row.total === 0).map((row) => row.month);
    expect(zeroMonths).toEqual(["2026-01", "2026-06"]);
    expect(manyTypesTrend.categories.map((category) => category.code)).toContain("PUBLIC_AUTHORITY");
    expect(manyTypesTrend.categories.find((category) => category.code === "PUBLIC_AUTHORITY")?.total).toBe(3);
  });
});

describe("MonthlyTrendChart states", () => {
  it("renders a deterministic loading skeleton when the trend is not available", () => {
    const html = render(null);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading chart"');
    expect(html).toContain("chart-skeleton");
    expect(html).not.toContain('role="img"');
  });

  it("renders the empty state when no application falls inside the window", () => {
    const html = render(emptyTrend);
    expect(html).toContain("empty-state");
    expect(html).toContain("No applications with a reported pipeline-entry date fall inside the trailing 12 months.");
    expect(html).not.toContain('role="img"');
    // The toggle stays available so a viewer can still switch dimensions.
    expect(html).toContain('role="radiogroup"');
  });

  it("renders a defensive no-window message when the collection date is unusable", () => {
    const html = render(noWindowTrend);
    expect(html).toContain("empty-state");
    expect(html).toContain("No collection date is available for this snapshot");
    expect(html).not.toContain('role="img"');
  });

  it("does not render a chart when the trend has categories but no rows", () => {
    const trend: TrendData = { ...emptyTrend, categories: actionTrend.categories, rows: [], windowTotal: 0 };
    const html = render(trend);
    expect(html).toContain("No collection date is available for this snapshot");
    expect(html).not.toContain('role="img"');
  });
});

describe("MonthlyTrendChart stacking", () => {
  it("renders the chart with an accessible name that names the window and the active dimension", () => {
    const action = render(actionTrend, "action");
    expect(action).toContain('role="img"');
    expect(action).toContain("Dec &#x27;25–Nov &#x27;26");
    expect(action).toContain("stacked by primary ZAP action type");
    expect(action).toContain("Stacks are the application&#x27;s primary ZAP action type");

    const applicant = render(manyTypesTrend, "applicant");
    expect(applicant).toContain("stacked by inferred applicant type");
    expect(applicant).toContain("not necessarily the developer or owner");
  });

  it("emits one shared-stack segment per category, coloured from the contract", () => {
    const bars = findBars(chartTree(manyTypesTrend, "applicant"));
    expect(bars).toHaveLength(manyTypesTrend.categories.length);
    expect(new Set(bars.map((bar) => bar.props.stackId))).toEqual(new Set(["applications"]));
    expect(bars.map((bar) => bar.props.dataKey)).toEqual(
      manyTypesTrend.categories.map((category) => category.code),
    );
    expect(bars.map((bar) => bar.props.fill)).toEqual(
      manyTypesTrend.categories.map((category) => category.color),
    );
    expect(bars.map((bar) => bar.props.name)).toEqual(
      manyTypesTrend.categories.map((category) => category.label),
    );
    expect(bars.every((bar) => bar.props.maxBarSize === 44)).toBe(true);
  });

  it("renders a single-colour stack when only one type exists", () => {
    const bars = findBars(chartTree(singleTypeTrend, "action"));
    expect(bars).toHaveLength(1);
    expect(bars[0].props.dataKey).toBe("ZM");
    expect(bars[0].props.fill).toBe("#0a6640");
  });

  it("renders no segments when only zero-count months exist", () => {
    const bars = findBars(chartTree(emptyTrend, "action"));
    expect(bars).toHaveLength(0);
  });

  it("publishes the stacked numbers as text so the chart is not colour-only", () => {
    const html = render(manyTypesTrend, "applicant");
    expect(html).toContain("<caption>");
    expect(html).toContain("Private developer / owner");
    expect(html).toContain("<th scope=\"row\">Jan &#x27;26</th><td>0</td>");
    expect(html).toContain("<td>9</td>");
  });
});

describe("MonthlyTrendChart toggle", () => {
  it("is a native radio group with both dimensions and the active one checked", () => {
    const html = render(manyTypesTrend, "applicant");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Stack chart by"');
    expect(html).toContain('type="radio"');
    expect(html).toContain("Application type");
    expect(html).toContain("Applicant type");
    expect(html).toContain('checked="" value="applicant"');
    expect(html).not.toContain('checked="" value="action"');
  });

  it("marks the action option active when the action dimension is selected", () => {
    const html = render(actionTrend, "action");
    expect(html).toContain('checked="" value="action"');
    expect(html).toContain("trend-toggle-option is-active");
  });

  it("exposes a change handler for each option", () => {
    const calls: string[] = [];
    const tree = chartTree(manyTypesTrend, "action", (dimension) => calls.push(dimension));
    const inputs = collectInputs(tree);
    expect(inputs).toHaveLength(2);
    (inputs[1].props as { onChange: () => void }).onChange();
    expect(calls).toEqual(["applicant"]);
  });
});

/** Collect the toggle's `<input type="radio">` elements from the element tree. */
function collectInputs(node: unknown, found: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) collectInputs(child, found);
    return found;
  }
  if (node && typeof node === "object" && "props" in (node as object)) {
    const element = node as ReactElement<Record<string, unknown>>;
    // Only the local toggle component is safe to invoke eagerly: it holds no hooks.
    if (typeof element.type === "function" && (element.type as { name?: string }).name === "TrendToggle") {
      collectInputs(
        (element.type as (props: unknown) => unknown)(element.props),
        found,
      );
      return found;
    }
    const props = element.props as { type?: string; children?: unknown };
    if (element.type === "input" && props.type === "radio") found.push(element);
    if (props.children) collectInputs(props.children, found);
  }
  return found;
}

describe("monthly trend tooltip", () => {
  const categories: TrendCategory[] = manyTypesTrend.categories;

  function payloadFor(trend: TrendData, month: string) {
    const row = trend.rows.find((candidate) => candidate.month === month);
    if (!row) throw new Error(`missing fixture month ${month}`);
    return categories.map((category) => ({
      dataKey: category.code,
      name: category.label,
      value: Number(row[category.code] ?? 0),
    }));
  }

  it("reports the monthly total and per-type counts, largest first", () => {
    const { total, items } = buildTooltipItems(payloadFor(manyTypesTrend, "2026-09"), categories);
    expect(total).toBe(16);
    expect(total).toBe(manyTypesTrend.rows.find((row) => row.month === "2026-09")?.total);
    expect(items.map((item) => [item.code, item.count])).toEqual([
      ["DEVELOPER", 9],
      ["CITY_AGENCY", 5],
      ["OTHER", 2],
    ]);
    expect(items.every((item) => item.count > 0)).toBe(true);
    expect(items.every((item) => Boolean(item.color) && Boolean(item.label))).toBe(true);
  });

  it("renders a zero-count month as an explicit no-applications row", () => {
    const { total, items } = buildTooltipItems(payloadFor(manyTypesTrend, "2026-06"), categories);
    expect(total).toBe(0);
    expect(items).toEqual([]);
  });

  it("copes with an undefined payload and unknown bucket codes", () => {
    expect(buildTooltipItems(undefined, categories)).toEqual({ total: 0, items: [] });
    const { total, items } = buildTooltipItems(
      [{ dataKey: "MYSTERY", value: 2 }, { dataKey: "DEVELOPER", value: "1" }],
      categories,
    );
    expect(total).toBe(3);
    expect(items.map((item) => item.code)).toEqual(["MYSTERY", "DEVELOPER"]);
    expect(items[0]).toMatchObject({ label: "MYSTERY", color: "#6b7770", count: 2 });
  });

  it("totals a single-type month correctly", () => {
    const categoriesForSingle = singleTypeTrend.categories;
    const { total, items } = buildTooltipItems(
      [{ dataKey: "ZM", value: 7 }],
      categoriesForSingle,
    );
    expect(total).toBe(7);
    expect(items).toEqual([{ code: "ZM", label: "Zoning Map Amendment", color: "#0a6640", count: 7 }]);
  });
});

describe("MonthlyTrendChart copy discipline", () => {
  it("never calls the feed permits or DOB data", () => {
    const html = [
      render(manyTypesTrend, "applicant"),
      render(actionTrend, "action"),
      render(emptyTrend),
    ].join("");
    expect(html).not.toMatch(/DOB permits?|building permits?|permits per month/i);
    expect(html).toContain("applications entering the ZAP review pipeline");
  });

  it("discloses the partial month and undated exclusions", () => {
    const html = render(manyTypesTrend, "applicant");
    expect(html).toContain("Nov &#x27;26 is incomplete");
    expect(html).toContain("18 tracked records carry no milestone date and are excluded.");
  });

  it("drops the partial-month disclosure when the window ends on a complete month", () => {
    const complete = buildMockTrend({
      dimension: "action",
      categories: [{ code: "ZM", label: "Zoning Map Amendment", color: "#0a6640" }],
      counts: { "2026-05": { ZM: 2 } },
      priorWindowTotal: 0,
      undatedCount: 0,
      partialMonth: false,
    });
    const html = render(complete);
    expect(html).not.toContain("is incomplete");
    expect(html).not.toContain("carry no milestone date");
  });
});
