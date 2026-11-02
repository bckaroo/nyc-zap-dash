import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DashboardExplorer from "../src/components/DashboardExplorer";

import {
  APPLICANT_CAVEAT,
  COVERAGE_DISCLOSURE,
  OTHER_ACTIONS_CODE,
  SOURCE_ATTRIBUTION,
  buildMonthlyActionTrend,
  buildOverview,
  computeApplicantLeaderboard,
  filterApplications,
  monthlyActivityTrend,
  selectWeeklyHighlights,
  type DashboardRecord,
} from "../src/lib/dashboard-analytics";

const records: DashboardRecord[] = [
  {
    id: "2026K0001",
    project_id: "2026K0001",
    project_name: "Atlantic Avenue Rezoning",
    project_brief: "A mixed-use proposal near Atlantic Avenue.",
    borough: "Brooklyn",
    community_district: "K08",
    public_status: "In Public Review",
    primary_applicant: "Example Holdings LLC",
    applicant_type: "Private",
    ulurp_non: "ULURP",
    ceqr_number: "26DCP001K",
    ceqr_type: "Unlisted",
    eas_eis: "EAS",
    flood_zone_a: 0,
    flood_zone_shadedx: 0,
    milestone_date: "2026-09-15",
    certified_referred: "2026-08-01",
    first_seen_date: "2026-07-01",
    last_updated_date: "2026-10-01",
    activity_date: "2026-09-15",
    source_url: "https://zap.planning.nyc.gov/projects/2026K0001",
    action_types: ["ZM"],
    location_method: "point_on_zap_bbl_polygon",
    location_source: "ZAP bbl-featurecollection",
  },
  {
    id: "2026K0002",
    project_id: "2026K0002",
    project_name: "Eastern Parkway Text Amendment",
    project_brief: "A text amendment in Crown Heights.",
    borough: "Brooklyn",
    community_district: "K08",
    public_status: "Filed",
    primary_applicant: "Example Holdings LLC",
    applicant_type: "Private",
    ulurp_non: "Non-ULURP",
    ceqr_number: "",
    ceqr_type: "",
    eas_eis: "",
    flood_zone_a: 1,
    flood_zone_shadedx: 0,
    milestone_date: "2025-11-20",
    certified_referred: "",
    first_seen_date: "2025-11-01",
    last_updated_date: "2026-10-01",
    activity_date: "2025-11-20",
    source_url: "https://zap.planning.nyc.gov/projects/2026K0002",
    action_types: ["ZR"],
    location_method: "point_on_zap_bbl_polygon",
    location_source: "ZAP bbl-featurecollection",
  },
  {
    id: "2026Q0001",
    project_id: "2026Q0001",
    project_name: "Queens Boulevard Application",
    project_brief: "A zoning application in Queens.",
    borough: "Queens",
    community_district: "Q04",
    public_status: "Noticed",
    primary_applicant: "Civic Applicant",
    applicant_type: "Public",
    ulurp_non: "ULURP",
    ceqr_number: "26DCP002Q",
    ceqr_type: "Type II",
    eas_eis: "",
    flood_zone_a: 0,
    flood_zone_shadedx: 1,
    milestone_date: "2026-09-30",
    certified_referred: "",
    first_seen_date: "2026-06-01",
    last_updated_date: "2026-10-01",
    activity_date: "2026-09-30",
    source_url: "https://zap.planning.nyc.gov/projects/2026Q0001",
    action_types: ["ZA"],
    location_method: "point_on_zap_bbl_polygon",
    location_source: "ZAP bbl-featurecollection",
  },
  {
    id: "2024M0001",
    project_id: "2024M0001",
    project_name: "Historic Manhattan Filing",
    project_brief: "An older application.",
    borough: "Manhattan",
    community_district: "M05",
    public_status: "Completed",
    primary_applicant: "Old Applicant",
    applicant_type: "Private",
    ulurp_non: "ULURP",
    ceqr_number: "",
    ceqr_type: "",
    eas_eis: "",
    flood_zone_a: 0,
    flood_zone_shadedx: 0,
    milestone_date: "2024-01-05",
    certified_referred: "2023-10-01",
    first_seen_date: "2023-08-01",
    last_updated_date: "2026-10-01",
    activity_date: "2024-01-05",
    source_url: "https://zap.planning.nyc.gov/projects/2024M0001",
    action_types: [],
    location_method: "",
    location_source: "",
  },
];

describe("dashboard analytics", () => {
  it("builds citywide overview metrics from the exported records", () => {
    expect(buildOverview(records)).toEqual({
      trackedApplications: 4,
      inPublicReview: 1,
      boroughsCovered: 3,
      latestActivityDate: "2026-09-30",
    });
  });

  it("builds zero-filled monthly trends for borough and Community District filters", () => {
    const boroughTrend = monthlyActivityTrend(records, { borough: "Brooklyn" }, "2026-10-01", 18);
    expect(boroughTrend).toHaveLength(18);
    expect(boroughTrend[0]).toEqual({ month: "2025-05", count: 0 });
    expect(boroughTrend.find(({ month }) => month === "2025-11")).toEqual({ month: "2025-11", count: 1 });
    expect(boroughTrend.find(({ month }) => month === "2026-08")).toEqual({ month: "2026-08", count: 0 });
    expect(boroughTrend.at(-1)).toEqual({ month: "2026-10", count: 0 });

    expect(monthlyActivityTrend(records, { communityDistrict: "K08" }, "2026-10-01", 18))
      .toEqual(boroughTrend);
  });

  it("filters the project table across supported exported fields", () => {
    expect(
      filterApplications(records, {
        search: "Atlantic example",
        borough: "Brooklyn",
        communityDistrict: "K08",
        status: "In Public Review",
      }).map((record) => record.id),
    ).toEqual(["2026K0001"]);
  });

  it("selects a dated seven-day current-filings window from canonical activity dates", () => {
    const boundaryRecord: DashboardRecord = {
      ...records[0],
      id: "2026K0007",
      project_id: "2026K0007",
      project_name: "Seven-day Boundary Filing",
      activity_date: "2026-09-25",
      source_url: "https://zap.planning.nyc.gov/projects/2026K0007",
    };
    const afterWindow: DashboardRecord = {
      ...records[0],
      id: "2026K0008",
      project_id: "2026K0008",
      project_name: "Future Filing",
      activity_date: "2026-10-02",
      source_url: "https://zap.planning.nyc.gov/projects/2026K0008",
    };

    expect(
      selectWeeklyHighlights([...records, boundaryRecord, afterWindow], "2026-10-01")
        .map((record) => record.id),
    ).toEqual(["2026Q0001", "2026K0007"]);
  });

  it("ranks named applicants using activity in the trailing 12 months", () => {
    const boundaryRecord: DashboardRecord = {
      ...records[0],
      id: "2025K0003",
      project_id: "2025K0003",
      project_name: "Inclusive Boundary Filing",
      primary_applicant: "Boundary Applicant",
      activity_date: "2025-10-01",
      source_url: "https://zap.planning.nyc.gov/projects/2025K0003",
    };

    expect(computeApplicantLeaderboard([...records, boundaryRecord], "2026-10-01T23:59:59Z")).toEqual([
      { name: "Example Holdings LLC", applicationCount: 2, projects: [records[0], records[1]] },
      { name: "Boundary Applicant", applicationCount: 1, projects: [boundaryRecord] },
      { name: "Civic Applicant", applicationCount: 1, projects: [records[2]] },
    ]);
  });

  it("returns exactly the projects counted for each applicant leaderboard row", () => {
    const leaderboard = computeApplicantLeaderboard(records, "2026-10-01");
    for (const applicant of leaderboard) {
      expect(applicant.projects).toHaveLength(applicant.applicationCount);
      expect(applicant.projects.every((project) => project.primary_applicant === applicant.name)).toBe(true);
    }
    expect(leaderboard[0].projects.map((project) => project.id)).toEqual(["2026K0001", "2026K0002"]);
  });
});

describe("monthly pipeline-entry trend", () => {
  function recordWith(overrides: Partial<DashboardRecord>): DashboardRecord {
    return { ...records[0], ...overrides };
  }

  it("zero-fills the trailing 12 months anchored to the collection date", () => {
    const trend = buildMonthlyActionTrend(
      [
        recordWith({ id: "A", pipeline_start_date: "2025-12-20", action_types: ["ZS"] }),
        recordWith({ id: "B", pipeline_start_date: "2026-10-14", action_types: ["ZM"] }),
        recordWith({ id: "C", pipeline_start_date: "2026-10-02", action_types: ["ZR"] }),
      ],
      "2026-11-02",
    );

    expect(trend.months).toHaveLength(12);
    expect(trend.months[0]).toBe("2025-12");
    expect(trend.months.at(-1)).toBe("2026-11");
    expect(trend.rows.map((row) => row.total)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0]);
    expect(trend.rows.at(-1)?.label).toBe("Nov '26");
    expect(trend.windowTotal).toBe(3);
    expect(trend.undatedCount).toBe(0);
    expect(trend.partialMonth).toBe(true);
  });

  it("counts an application in its pipeline-entry month, never by latest milestone", () => {
    const trend = buildMonthlyActionTrend(
      [
        recordWith({
          id: "A",
          pipeline_start_date: "2025-12-20",
          // Latest ZAP movement is nearly a year later; it must not move the bar.
          milestone_date: "2026-10-30",
          activity_date: "2026-10-30",
          action_types: ["ZM"],
        }),
      ],
      "2026-11-02",
    );

    expect(trend.rows[0]).toMatchObject({ month: "2025-12", total: 1, ZM: 1 });
    expect(trend.rows.find((row) => row.month === "2026-10")?.total).toBe(0);
  });

  it("excludes records with no pipeline-entry date and reports them separately", () => {
    const trend = buildMonthlyActionTrend(
      [recordWith({ id: "A", pipeline_start_date: "", action_types: ["ZM"] })],
      "2026-11-02",
    );

    expect(trend.windowTotal).toBe(0);
    expect(trend.undatedCount).toBe(1);
    expect(trend.categories).toEqual([]);
  });

  it("stacks by primary action type and folds the tail into one other bucket", () => {
    const codes = [
      ...Array.from({ length: 5 }, () => "ZM"),
      ...Array.from({ length: 4 }, () => "ZR"),
      ...Array.from({ length: 3 }, () => "ZS"),
      ...Array.from({ length: 2 }, () => "ZA"),
      ...Array.from({ length: 1 }, () => "MM"),
    ];
    const trend = buildMonthlyActionTrend(
      codes.map((code, index) =>
        recordWith({ id: `R${index}`, pipeline_start_date: "2026-05-10", action_types: [code] }),
      ),
      "2026-11-02",
      12,
      3,
    );

    expect(trend.categories.map((category) => category.code)).toEqual(["ZM", "ZR", "ZS", OTHER_ACTIONS_CODE]);
    expect(trend.categories.at(-1)?.total).toBe(3);
    expect(trend.groupedCodes).toEqual(["ZA", "MM"]);
    const may = trend.rows.find((row) => row.month === "2026-05");
    expect(may).toMatchObject({ total: 15, ZM: 5, ZR: 4, ZS: 3, [OTHER_ACTIONS_CODE]: 3 });
  });

  it("compares the window with the 12 months before it", () => {
    const trend = buildMonthlyActionTrend(
      [
        ...Array.from({ length: 4 }, (_, index) =>
          recordWith({ id: `cur${index}`, pipeline_start_date: "2026-06-15", action_types: ["ZM"] }),
        ),
        ...Array.from({ length: 2 }, (_, index) =>
          recordWith({ id: `prev${index}`, pipeline_start_date: "2025-06-15", action_types: ["ZM"] }),
        ),
        // Older than either window: counted in neither.
        recordWith({ id: "old", pipeline_start_date: "2024-06-15", action_types: ["ZM"] }),
      ],
      "2026-11-02",
    );

    expect(trend.windowTotal).toBe(4);
    expect(trend.priorWindowTotal).toBe(2);
    expect(trend.changePct).toBe(100);
  });

  it("returns an empty trend when the collection date is unusable", () => {
    const trend = buildMonthlyActionTrend(records, "");
    expect(trend.rows).toEqual([]);
    expect(trend.windowTotal).toBe(0);
    expect(trend.changePct).toBeNull();
  });
});

describe("public labels and disclosures", () => {
  it("renders explicit empty and stale dataset states", () => {
    const html = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          generated_at: "2026-10-20T15:00:00Z",
          collected_through: "2026-10-01",
          record_count: 0,
          source: {
            name: "NYC Department of City Planning Zoning Application Portal",
            url: "https://zap.planning.nyc.gov/projects",
            api_url: "https://zap-api-production.herokuapp.com/projects",
          },
          records: [],
        }}
      />,
    );

    expect(html).toContain("No applications are available in this public snapshot.");
    expect(html).toContain("Collection is 19 days behind this export");
  });

  it("uses the approved applicant label and caveat", () => {
    expect(APPLICANT_CAVEAT.heading).toBe("Most active named applicants");
    expect(APPLICANT_CAVEAT.body).toContain("not necessarily the developer");
    expect(APPLICANT_CAVEAT.body).toContain("trailing 12 months");
  });

  it("discloses source, freshness boundary, and coverage limits", () => {
    expect(SOURCE_ATTRIBUTION).toContain("NYC Department of City Planning");
    expect(COVERAGE_DISCLOSURE).toContain("discretionary land-use applications");
    expect(COVERAGE_DISCLOSURE).toContain("not all NYC development");
    expect(COVERAGE_DISCLOSURE).toContain("may lag");
  });

  it("renders the approved public labels without a developer leaderboard", () => {
    const html = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          generated_at: "2026-10-02T12:00:00Z",
          collected_through: "2026-10-01",
          record_count: records.length,
          source: {
            name: "NYC Department of City Planning Zoning Application Portal",
            url: "https://zap.planning.nyc.gov/projects",
            api_url: "https://zap-api-production.herokuapp.com/projects",
          },
          records,
        }}
      />,
    );
    expect(html).toContain("Most active named applicants");
    expect(html).toContain("Current filings and weekly highlights");
    expect(html).toContain("Sep 25–Oct 1, 2026");
    expect(html).toContain("Queens Boulevard Application");
    expect(html).toContain("not necessarily the developer");
    expect(html).toContain("Data collected through");
    expect(html).toContain("Official ZAP record");
    expect(html).toContain("ZAP application activity map");
    expect(html).toContain("Zoom 9–10: Community Districts");
    expect(html).toContain("Borough activity by ZAP action type");
    expect(html).toContain("mobile-field-label\">Location");
    expect(html).toContain("expand-affordance\">View details");
    expect(html).not.toMatch(/Top Developers|Developer leaderboard/i);
    expect(html).not.toMatch(/DOB permits?|building permits?/i);
  });

  it("renders the trailing-12-month pipeline card with its measure disclosed", () => {
    const datedRecords: DashboardRecord[] = [
      { ...records[0], pipeline_start_date: "2026-07-08" },
      { ...records[2], pipeline_start_date: "2026-08-19" },
      { ...records[1], pipeline_start_date: "" },
    ];
    const html = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          generated_at: "2026-11-02T12:00:00Z",
          collected_through: "2026-11-02",
          record_count: datedRecords.length,
          source: {
            name: "NYC Department of City Planning Zoning Application Portal",
            url: "https://zap.planning.nyc.gov/projects",
            api_url: "https://zap-api-production.herokuapp.com/projects",
          },
          records: datedRecords,
        }}
      />,
    );

    expect(html).toContain("Applications entering the pipeline per month");
    expect(html).toContain("Trailing 12 months · market trend");
    expect(html).toContain("Prior 12 months");
    expect(html).toContain("Each application counts once");
    expect(html).toMatch(/Dec\s*(?:&#x27;|')25/);
    expect(html).not.toMatch(/permits per month/i);
  });

  it("renders applicant rows as keyboard-operable ARIA accordions with exact official project links", () => {
    const html = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          generated_at: "2026-10-02T12:00:00Z",
          collected_through: "2026-10-01",
          record_count: records.length,
          source: {
            name: "NYC Department of City Planning Zoning Application Portal",
            url: "https://zap.planning.nyc.gov/projects",
            api_url: "https://zap-api-production.herokuapp.com/projects",
          },
          records,
        }}
      />,
    );

    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("aria-controls=\"applicant-projects-example-holdings-llc\"");
    expect(html).toContain("role=\"region\"");
    expect(html).toContain("href=\"https://zap.planning.nyc.gov/projects/2026K0001\"");
    expect(html).toContain("href=\"https://zap.planning.nyc.gov/projects/2026K0002\"");
    expect(html).toContain("target=\"_blank\" rel=\"noreferrer noopener\"");
  });

  it("anchors the trailing-year view to the collection date, not export time", () => {
    const boundaryRecord: DashboardRecord = {
      ...records[0],
      id: "2025K0003",
      project_id: "2025K0003",
      project_name: "Inclusive Boundary Filing",
      primary_applicant: "Boundary Applicant",
      activity_date: "2025-10-01",
      source_url: "https://zap.planning.nyc.gov/projects/2025K0003",
    };
    const html = renderToStaticMarkup(
      <DashboardExplorer
        payload={{
          generated_at: "2026-12-15T23:59:59Z",
          collected_through: "2026-10-01T19:42:00-04:00",
          record_count: records.length + 1,
          source: {
            name: "NYC Department of City Planning Zoning Application Portal",
            url: "https://zap.planning.nyc.gov/projects",
            api_url: "https://zap-api-production.herokuapp.com/projects",
          },
          records: [...records, boundaryRecord],
        }}
      />,
    );

    expect(html).toContain("Boundary Applicant");
    expect(html).toContain("aria-controls=\"applicant-projects-boundary-applicant\"");
    expect(html).toContain("href=\"https://zap.planning.nyc.gov/projects/2025K0003\"");
  });
});
