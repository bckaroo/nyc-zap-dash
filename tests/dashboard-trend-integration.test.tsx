/**
 * Integration tests: the dimension-aware trend card wired into the real
 * dashboard layout (`DashboardExplorer`).
 *
 * These are the "no mocks" checks — the dashboard renders whatever
 * `buildMonthlyTrend()` computes from the payload records, so every number
 * asserted below is compared against the analytics output for the same seeded
 * fixture rather than against a hand-typed expectation.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DashboardExplorer from "../src/components/DashboardExplorer";
import {
  buildMonthlyTrend,
  monthLabel,
  type DashboardPayload,
  type DashboardRecord,
} from "../src/lib/dashboard-analytics";

const COLLECTED_THROUGH = "2026-11-02";

/** Minimal record factory; only the fields the trend card reads are seeded. */
function record(
  id: string,
  pipelineStartDate: string | undefined,
  actionTypes: string[],
  primaryApplicant = "Example Holdings LLC",
): DashboardRecord {
  return {
    id,
    project_id: id,
    project_name: `Application ${id}`,
    project_brief: "Seeded application for the trend card integration test.",
    borough: "Brooklyn",
    community_district: "K08",
    public_status: "In Public Review",
    ulurp_non: "ULURP",
    ceqr_number: "",
    ceqr_type: "",
    eas_eis: "",
    primary_applicant: primaryApplicant,
    applicant_type: "717170002",
    flood_zone_a: 0,
    flood_zone_shadedx: 0,
    milestone_date: "2026-11-01",
    pipeline_start_date: pipelineStartDate,
    certified_referred: "",
    first_seen_date: "2025-11-01",
    last_updated_date: "2026-11-02",
    activity_date: "2026-11-01",
    source_url: `https://zap.planning.nyc.gov/projects/${id}`,
    action_types: actionTypes,
    location_method: "point_on_zap_bbl_polygon",
    location_source: "ZAP bbl-featurecollection",
  };
}

/**
 * Seeded fixture: 3 + 1 + 1 applications inside the window (with Jan '26
 * deliberately empty, so a zero month is in play), 1 in the prior window, and
 * one record with no dated milestone.
 */
const SEEDED_RECORDS: DashboardRecord[] = [
  record("2025K0900", "2025-11-14", ["ZM"]), // prior window
  record("2025K0901", "2025-12-04", ["ZM"]),
  record("2025K0902", "2025-12-19", ["ZM"]),
  record("2025K0903", "2025-12-28", ["ZR"]),
  record("2026K0904", "2026-02-11", ["ZS"]),
  record("2026K0905", "2026-03-02", ["ZM"]),
  record("2026K0906", undefined, ["ZM"]), // undated -> excluded, counted once
];

const SEEDED_PAYLOAD: DashboardPayload = {
  generated_at: "2026-11-02T12:00:00Z",
  collected_through: COLLECTED_THROUGH,
  record_count: SEEDED_RECORDS.length,
  source: {
    name: "NYC Department of City Planning Zoning Application Portal",
    url: "https://zap.planning.nyc.gov/projects",
    api_url: "https://zap-api-production.herokuapp.com/projects",
  },
  records: SEEDED_RECORDS,
};

const actionTrend = buildMonthlyTrend(SEEDED_RECORDS, COLLECTED_THROUGH, "action");
const html = renderToStaticMarkup(<DashboardExplorer payload={SEEDED_PAYLOAD} />);

/** React escapes apostrophes in text and attribute values; mirror that. */
function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
}

/** Undo the escaping for values read back out of the markup. */
function unesc(value: string): string {
  return value
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

const WINDOW_TEXT = `${monthLabel(actionTrend.windowStart)}–${monthLabel(actionTrend.windowEnd)}`;

/** Pull the screen-reader data table out of the rendered markup and parse it. */
function parseTrendTable(markup: string) {
  const tableStart = markup.indexOf("<table>");
  expect(tableStart).toBeGreaterThan(-1);
  const tableEnd = markup.indexOf("</table>", tableStart);
  const table = markup.slice(tableStart, tableEnd);

  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) =>
      unesc(cell.replace(/<[^>]+>/g, "").trim()),
    ),
  );

  const header = rows[0];
  const body = rows.slice(1).map((cells) => ({
    month: cells[0],
    values: cells.slice(1, -1).map(Number),
    total: Number(cells[cells.length - 1]),
  }));
  return { header, body };
}

describe("dashboard trend card integration", () => {
  it("sends the API categories to the legend and the screen-reader table", () => {
    const { header } = parseTrendTable(html);
    const categoryLabels = actionTrend.categories.map((category) => category.label);

    expect(header.slice(1, -1)).toEqual(categoryLabels);
    expect(header[header.length - 1]).toBe("Total");
    for (const label of categoryLabels) expect(html).toContain(label);
  });

  it("renders exactly the rolling 12-month window the aggregation reports", () => {
    const { body } = parseTrendTable(html);

    expect(body).toHaveLength(12);
    expect(body.map((row) => row.month)).toEqual(actionTrend.rows.map((row) => row.label));
    expect(body[0].month).toBe(monthLabel(actionTrend.windowStart));
    expect(body[body.length - 1].month).toBe(monthLabel(actionTrend.windowEnd));
    // Dec '25 .. Nov '26 for a 2026-11-02 collection date.
    expect(actionTrend.windowStart).toBe("2025-12");
    expect(actionTrend.windowEnd).toBe("2026-11");
  });

  it("keeps every row's stack summing to that month's total", () => {
    const { body } = parseTrendTable(html);

    for (const [index, row] of body.entries()) {
      expect(row.values.reduce((sum, value) => sum + value, 0)).toBe(row.total);
      expect(row.total).toBe(actionTrend.rows[index].total);
    }
    expect(body.reduce((sum, row) => sum + row.total, 0)).toBe(actionTrend.windowTotal);
    expect(actionTrend.windowTotal).toBe(5);
  });

  it("renders the empty month as zeroes, not a missing row", () => {
    const { body } = parseTrendTable(html);
    const january = body.find((row) => row.month === monthLabel("2026-01"));

    expect(january).toBeDefined();
    expect(january?.total).toBe(0);
    expect(january?.values.every((value) => value === 0)).toBe(true);
  });

  it("shows the window, total and prior-year comparison from the API", () => {
    expect(html).toContain(esc(WINDOW_TEXT));
    expect(html).toContain(`${actionTrend.windowTotal} applications entered the review pipeline`);
    expect(html).toContain(`<span>Prior 12 months</span><strong>${actionTrend.priorWindowTotal}</strong>`);
    expect(html).toContain(`+${actionTrend.changePct}%`);
  });

  it("renders the dimension toggle as a radio group outside the chart image", () => {
    expect(html).toContain('role="radiogroup" aria-label="Stack chart by"');
    expect(html).toMatch(
      /<input type="radio" name="trend-dimension" checked="" value="action"\/>/,
    );
    expect(html).toMatch(/<input type="radio" name="trend-dimension" value="applicant"\/>/);
    expect(html).toContain("Application type");
    expect(html).toContain("Applicant type");
    expect(html.indexOf('role="radiogroup"')).toBeLessThan(html.indexOf('role="img"'));
  });

  it("names the chart by the active dimension and window", () => {
    expect(html).toContain(
      `aria-label="Stacked bar chart of applications entering the ZAP review pipeline per month, ${esc(WINDOW_TEXT)}, stacked by primary ZAP action type"`,
    );
  });

  it("owns the chart note once, instead of duplicating the panel copy", () => {
    const noteMentions = html.split("Each application counts once").length - 1;

    expect(noteMentions).toBe(1);
    expect(html).toContain("not construction permits issued by the Department of Buildings");
    expect(html).toContain(
      `${actionTrend.undatedCount} tracked record${
        actionTrend.undatedCount === 1 ? " carries" : " carry"
      } no milestone date`,
    );
    expect(html).toContain(`${esc(monthLabel(actionTrend.windowEnd))} is incomplete`);
  });

  it("still discloses the measure for an empty snapshot without a broken chart", () => {
    const emptyHtml = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          ...SEEDED_PAYLOAD,
          record_count: 0,
          records: [],
        }}
      />,
    );

    expect(emptyHtml).toContain(
      "No applications with a reported pipeline-entry date fall inside the trailing 12 months.",
    );
    expect(emptyHtml).toContain("0 applications entered the review pipeline");
    expect(emptyHtml).not.toContain('role="img"');
  });
});
