import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPLICANT_TYPE_STYLES,
  MONTHLY_TREND_MONTHS,
  MONTHLY_TREND_TOP_APPLICANT_CATEGORIES,
  MONTHLY_TREND_TOP_CATEGORIES,
  OTHER_ACTIONS_CODE,
  UNDATED_ACTION_CODE,
  buildMonthlyActionTrend,
  buildMonthlyTrend,
  classifyApplicantType,
  type DashboardRecord,
  type MonthlyTrend,
} from "../src/lib/dashboard-analytics";

/**
 * Contract tests for `buildMonthlyTrend` (PLAN.md §4/§6).
 *
 * The aggregation is a pure function over the prerendered payload — there is no
 * HTTP endpoint and no SQL, so "no N+1" here means: exactly one pass over
 * `records`, with month + bucket resolved from already-loaded fields. These
 * tests pin the response contract the chart and the integrator rely on.
 */

const baseRecord: DashboardRecord = {
  id: "2026K0001",
  project_id: "2026K0001",
  project_name: "Atlantic Avenue Rezoning",
  project_brief: "A mixed-use proposal near Atlantic Avenue.",
  borough: "Brooklyn",
  community_district: "K08",
  public_status: "In Public Review",
  primary_applicant: "Example Holdings LLC",
  applicant_type: "717170002",
  ulurp_non: "ULURP",
  ceqr_number: "26DCP001K",
  ceqr_type: "Unlisted",
  eas_eis: "EAS",
  flood_zone_a: 0,
  flood_zone_shadedx: 0,
  milestone_date: "2026-09-15",
  pipeline_start_date: "2026-09-15",
  certified_referred: "2026-08-01",
  first_seen_date: "2026-07-01",
  last_updated_date: "2026-11-02",
  activity_date: "2026-09-15",
  source_url: "https://zap.planning.nyc.gov/projects/2026K0001",
  action_types: ["ZM"],
  location_method: "point_on_zap_bbl_polygon",
  location_source: "ZAP bbl-featurecollection",
};

let sequence = 0;

function recordWith(overrides: Partial<DashboardRecord> = {}): DashboardRecord {
  sequence += 1;
  return { ...baseRecord, id: `R${sequence}`, project_id: `R${sequence}`, ...overrides };
}

/** The 12 months a Nov-2026 anchor must cover, chronological, zero-filled. */
const WINDOW_ENDING_2026_11 = [
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

function rowFor(trend: MonthlyTrend, month: string) {
  const row = trend.rows.find((candidate) => candidate.month === month);
  if (!row) throw new Error(`no row for ${month}`);
  return row;
}

function bucketTotal(row: Record<string, number | string>, categoryCodes: string[]): number {
  return categoryCodes.reduce((sum, code) => sum + Number(row[code] ?? 0), 0);
}

describe("buildMonthlyTrend — window boundaries", () => {
  it("returns exactly the anchor month plus the 11 prior months, chronological", () => {
    const trend = buildMonthlyTrend([], "2026-11-02", "action");

    expect(trend.months).toEqual(WINDOW_ENDING_2026_11);
    expect(trend.months).toHaveLength(MONTHLY_TREND_MONTHS);
    expect(trend.rows.map((row) => row.month)).toEqual(WINDOW_ENDING_2026_11);
    expect(trend.windowStart).toBe("2025-12");
    expect(trend.windowEnd).toBe("2026-11");
  });

  it("rolls the year over for a December anchor", () => {
    const trend = buildMonthlyTrend([], "2026-12-31", "action");

    expect(trend.months).toEqual([
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
      "2026-12",
    ]);
    expect(trend.windowStart).toBe("2026-01");
    expect(trend.windowEnd).toBe("2026-12");
  });

  it("keeps the window edges inclusive and excludes the months just outside it", () => {
    const trend = buildMonthlyTrend(
      [
        recordWith({ pipeline_start_date: "2025-11-30", action_types: ["ZM"] }), // one month before the window
        recordWith({ pipeline_start_date: "2025-12-01", action_types: ["ZM"] }), // first month
        recordWith({ pipeline_start_date: "2026-11-01", action_types: ["ZM"] }), // last month
        recordWith({ pipeline_start_date: "2026-12-01", action_types: ["ZM"] }), // one month after the anchor
      ],
      "2026-11-30",
      "action",
    );

    expect(trend.windowTotal).toBe(2);
    expect(rowFor(trend, "2025-12").total).toBe(1);
    expect(rowFor(trend, "2026-11").total).toBe(1);
    // 2025-11 is in the prior baseline window; 2026-12 is in neither.
    expect(trend.priorWindowTotal).toBe(1);
  });

  it("anchors on the collection date, not on the latest record date", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-11-01", last_updated_date: "2027-03-01" })],
      "2026-11-15",
      "action",
    );

    expect(trend.windowEnd).toBe("2026-11");
    expect(trend.windowStart).toBe("2025-12");
  });

  it("honours a custom monthCount", () => {
    const trend = buildMonthlyTrend([], "2026-11-02", "action", { monthCount: 3 });
    expect(trend.months).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(trend.rows).toHaveLength(3);
  });

  it("returns an empty trend for an unusable collection date", () => {
    const trend = buildMonthlyTrend([recordWith()], "", "action");
    expect(trend.months).toEqual([]);
    expect(trend.rows).toEqual([]);
    expect(trend.windowTotal).toBe(0);
    expect(trend.changePct).toBeNull();
  });
});

describe("buildMonthlyTrend — zero-fill", () => {
  it("emits every month even when it holds no applications", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-10-14", action_types: ["ZM"] })],
      "2026-11-02",
      "action",
    );

    expect(trend.rows).toHaveLength(12);
    expect(trend.rows.map((row) => row.total)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
    ]);

    const emptyMonth = rowFor(trend, "2026-03");
    expect(emptyMonth.total).toBe(0);
    for (const category of trend.categories) {
      expect(emptyMonth[category.code]).toBe(0);
    }
  });

  it("zero-fills a kept bucket in months where it has no applications", () => {
    const trend = buildMonthlyTrend(
      [
        recordWith({ pipeline_start_date: "2026-10-01", action_types: ["ZM"] }),
        recordWith({ pipeline_start_date: "2026-11-01", action_types: ["ZR"] }),
      ],
      "2026-11-02",
      "action",
    );

    const october = rowFor(trend, "2026-10");
    expect(october).toMatchObject({ total: 1, ZM: 1, ZR: 0 });
    expect(rowFor(trend, "2026-11")).toMatchObject({ total: 1, ZM: 0, ZR: 1 });
  });

  it("omits a bucket with no window applications from categories", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-10-01", action_types: ["ZM"] })],
      "2026-11-02",
      "action",
    );

    expect(trend.categories.map((category) => category.code)).toEqual(["ZM"]);
    expect(trend.categories.find((category) => category.code === "ZR")).toBeUndefined();
  });
});

describe("buildMonthlyTrend — partial month disclosure", () => {
  it("flags a mid-month anchor as partial", () => {
    expect(buildMonthlyTrend([], "2026-11-02", "action").partialMonth).toBe(true);
    expect(buildMonthlyTrend([], "2026-11-15", "action").partialMonth).toBe(true);
  });

  it("does not flag the last day of the anchor month", () => {
    expect(buildMonthlyTrend([], "2026-11-30", "action").partialMonth).toBe(false);
    expect(buildMonthlyTrend([], "2026-02-28", "action").partialMonth).toBe(false);
    expect(buildMonthlyTrend([], "2026-12-31", "action").partialMonth).toBe(false);
  });
});

describe("buildMonthlyTrend — action dimension grouping and roll-up", () => {
  const codes = [
    ...Array.from({ length: 9 }, () => "ZM"),
    ...Array.from({ length: 8 }, () => "ZR"),
    ...Array.from({ length: 7 }, () => "ZS"),
    ...Array.from({ length: 6 }, () => "ZA"),
    ...Array.from({ length: 5 }, () => "MM"),
    ...Array.from({ length: 4 }, () => "PQ"),
    ...Array.from({ length: 3 }, () => "RS"),
    ...Array.from({ length: 2 }, () => "TS"),
    ...Array.from({ length: 1 }, () => "HA"),
    ...Array.from({ length: 1 }, () => "LD"),
  ];

  const records = codes.map((code) =>
    recordWith({ pipeline_start_date: "2026-05-10", action_types: [code] }),
  );

  it("keeps the top 8 codes and folds the remainder into OTHER_ACTIONS", () => {
    const trend = buildMonthlyTrend(records, "2026-11-02", "action");

    expect(trend.categories.map((category) => category.code)).toEqual([
      "ZM",
      "ZR",
      "ZS",
      "ZA",
      "MM",
      "PQ",
      "RS",
      "TS",
      OTHER_ACTIONS_CODE,
    ]);
    expect(trend.categories.at(-1)?.total).toBe(2);
    expect(trend.groupedCodes).toEqual(["HA", "LD"]);

    const may = rowFor(trend, "2026-05");
    expect(may.total).toBe(46);
    expect(may[OTHER_ACTIONS_CODE]).toBe(2);
    expect(bucketTotal(may, trend.categories.map((category) => category.code))).toBe(46);
  });

  it("rolls up to exactly topCategories when the caller narrows it", () => {
    const trend = buildMonthlyTrend(records, "2026-11-02", "action", { topCategories: 3 });

    expect(trend.categories.map((category) => category.code)).toEqual([
      "ZM",
      "ZR",
      "ZS",
      OTHER_ACTIONS_CODE,
    ]);
    expect(trend.categories.at(-1)?.label).toBe("Other actions (7)");
    expect(trend.groupedCodes).toEqual(["ZA", "MM", "PQ", "RS", "TS", "HA", "LD"]);
  });

  it("defaults to MONTHLY_TREND_TOP_CATEGORIES for actions", () => {
    expect(MONTHLY_TREND_TOP_CATEGORIES).toBe(8);
    const trend = buildMonthlyTrend(records, "2026-11-02", "action");
    expect(trend.categories.filter((category) => category.code !== OTHER_ACTIONS_CODE)).toHaveLength(8);
  });

  it("puts an application with no action type in the UNREPORTED bucket", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-10-01", action_types: [] })],
      "2026-11-02",
      "action",
    );

    expect(trend.categories.map((category) => category.code)).toEqual([UNDATED_ACTION_CODE]);
    expect(trend.categories[0].label).toBe("Other ZAP action (UNREPORTED)");
    expect(rowFor(trend, "2026-10")).toMatchObject({ total: 1, [UNDATED_ACTION_CODE]: 1 });
  });

  it("keeps unknown action codes as their own labelled bucket", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-10-01", action_types: ["zz"] })],
      "2026-11-02",
      "action",
    );

    expect(trend.categories[0]).toMatchObject({ code: "ZZ", label: "Other ZAP action (ZZ)" });
  });
});

describe("classifyApplicantType", () => {
  it("classifies a city agency name", () => {
    expect(classifyApplicantType("EDC - Economic Development Corporation for NYC")).toBe("CITY_AGENCY");
    expect(classifyApplicantType("NYC Department of Housing Preservation and Development")).toBe(
      "CITY_AGENCY",
    );
    expect(classifyApplicantType("HPD")).toBe("CITY_AGENCY");
  });

  it("classifies a state agency name", () => {
    expect(classifyApplicantType("New York State Homes and Community Renewal")).toBe("STATE_AGENCY");
    expect(classifyApplicantType("Empire State Development")).toBe("STATE_AGENCY");
  });

  it("classifies a public authority name", () => {
    expect(classifyApplicantType("MTA New York City Transit")).toBe("PUBLIC_AUTHORITY");
    expect(classifyApplicantType("NYCHA")).toBe("PUBLIC_AUTHORITY");
    expect(classifyApplicantType("Port Authority of NY and NJ")).toBe("PUBLIC_AUTHORITY");
  });

  it("classifies a nonprofit or institution name", () => {
    expect(classifyApplicantType("Bronx HDFC")).toBe("NONPROFIT");
    expect(classifyApplicantType("St. Mary's Church")).toBe("NONPROFIT");
    expect(classifyApplicantType("Columbia University")).toBe("NONPROFIT");
  });

  it("classifies a private developer entity", () => {
    expect(classifyApplicantType("Example Holdings LLC")).toBe("DEVELOPER");
    expect(classifyApplicantType("Azimuth Development Group")).toBe("DEVELOPER");
    expect(classifyApplicantType("MJH Construction Corp.")).toBe("DEVELOPER");
  });

  it("defaults an individual or attorney name to DEVELOPER", () => {
    expect(classifyApplicantType("Jane Q. Smith")).toBe("DEVELOPER");
    expect(classifyApplicantType("Akerman LLP")).toBe("DEVELOPER");
  });

  it("returns OTHER for blank, whitespace, null, and Unknown", () => {
    expect(classifyApplicantType("")).toBe("OTHER");
    expect(classifyApplicantType("   ")).toBe("OTHER");
    expect(classifyApplicantType(null)).toBe("OTHER");
    expect(classifyApplicantType(undefined)).toBe("OTHER");
    expect(classifyApplicantType("Unknown")).toBe("OTHER");
    expect(classifyApplicantType("UNKNOWN")).toBe("OTHER");
  });

  it("is case-insensitive", () => {
    expect(classifyApplicantType("mta new york city transit")).toBe("PUBLIC_AUTHORITY");
    expect(classifyApplicantType("nyc department of parks")).toBe("CITY_AGENCY");
  });

  it("applies first-match precedence when a name matches several rules", () => {
    // "Economic Development" (city) wins over "Development" (developer marker),
    // and "Housing Development Fund" (nonprofit) is only reachable once the
    // authority/city/state rules have not matched.
    expect(classifyApplicantType("NYC Economic Development Corporation")).toBe("CITY_AGENCY");
    expect(classifyApplicantType("Housing Development Fund Corporation")).toBe("NONPROFIT");
    expect(classifyApplicantType("NYC HDFC")).toBe("CITY_AGENCY");
  });

  it("ignores the unusable numeric applicant_type field", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "2026-10-01", applicant_type: "717170002", primary_applicant: "MTA" })],
      "2026-11-02",
      "applicant",
    );
    expect(trend.categories.map((category) => category.code)).toEqual(["PUBLIC_AUTHORITY"]);
  });
});

describe("buildMonthlyTrend — applicant dimension grouping and roll-up", () => {
  function applicantRecord(name: string, month = "2026-05") {
    return recordWith({ pipeline_start_date: `${month}-10`, primary_applicant: name });
  }

  it("defaults to the top-5 applicant buckets plus the natural OTHER bucket", () => {
    expect(MONTHLY_TREND_TOP_APPLICANT_CATEGORIES).toBe(5);

    const trend = buildMonthlyTrend(
      [
        applicantRecord("Example Holdings LLC"),
        applicantRecord("Example Holdings LLC"),
        applicantRecord("NYC Department of Parks and Recreation"),
        applicantRecord("MTA New York City Transit"),
        applicantRecord("Bronx HDFC"),
        applicantRecord("Empire State Development"),
        applicantRecord(""),
      ],
      "2026-11-02",
      "applicant",
    );

    expect(trend.categories.map((category) => category.code)).toEqual([
      "DEVELOPER",
      "CITY_AGENCY",
      "NONPROFIT",
      "PUBLIC_AUTHORITY",
      "STATE_AGENCY",
      "OTHER",
    ]);
    expect(trend.categories.at(-1)).toMatchObject({ code: "OTHER", total: 1 });
    expect(trend.groupedCodes).toEqual([]);
    expect(rowFor(trend, "2026-05").total).toBe(7);
  });

  it("omits empty buckets and keeps the legend to non-empty ones", () => {
    const trend = buildMonthlyTrend(
      [applicantRecord("Example Holdings LLC"), applicantRecord("Unknown")],
      "2026-11-02",
      "applicant",
    );

    expect(trend.categories.map((category) => category.code)).toEqual(["DEVELOPER", "OTHER"]);
    expect(trend.categories.map((category) => category.label)).toEqual([
      APPLICANT_TYPE_STYLES.DEVELOPER.label,
      APPLICANT_TYPE_STYLES.OTHER.label,
    ]);
  });

  it("folds buckets past topCategories into OTHER, summing with the natural OTHER bucket", () => {
    const trend = buildMonthlyTrend(
      [
        applicantRecord("Example Holdings LLC"),
        applicantRecord("Example Holdings LLC"),
        applicantRecord("NYC Department of Parks and Recreation"),
        applicantRecord("MTA New York City Transit"),
        applicantRecord("Bronx HDFC"),
        applicantRecord("Empire State Development"),
        applicantRecord(""),
      ],
      "2026-11-02",
      "applicant",
      { topCategories: 2 },
    );

    expect(trend.categories.map((category) => category.code)).toEqual([
      "DEVELOPER",
      "CITY_AGENCY",
      "OTHER",
    ]);
    expect(trend.groupedCodes).toEqual(["NONPROFIT", "PUBLIC_AUTHORITY", "STATE_AGENCY"]);
    // 1 natural OTHER (blank name) + 3 folded buckets.
    expect(trend.categories.at(-1)?.total).toBe(4);

    const may = rowFor(trend, "2026-05");
    expect(may.total).toBe(7);
    expect(may.OTHER).toBe(4);
    expect(bucketTotal(may, trend.categories.map((category) => category.code))).toBe(7);
  });

  it("keeps a single OTHER bucket when every applicant is unknown", () => {
    const trend = buildMonthlyTrend(
      [applicantRecord(""), applicantRecord("Unknown")],
      "2026-11-02",
      "applicant",
    );

    expect(trend.categories.map((category) => category.code)).toEqual(["OTHER"]);
    expect(trend.groupedCodes).toEqual([]);
  });
});

describe("buildMonthlyTrend — invariants across dimensions", () => {
  const mixed = [
    recordWith({ pipeline_start_date: "2025-12-20", action_types: ["ZM"], primary_applicant: "Example Holdings LLC" }),
    recordWith({ pipeline_start_date: "2026-02-05", action_types: ["ZR"], primary_applicant: "NYC Department of Parks" }),
    recordWith({ pipeline_start_date: "2026-05-15", action_types: ["ZS"], primary_applicant: "MTA" }),
    recordWith({ pipeline_start_date: "2026-05-20", action_types: ["ZA"], primary_applicant: "Bronx HDFC" }),
    recordWith({ pipeline_start_date: "2026-09-30", action_types: ["MM"], primary_applicant: "" }),
    recordWith({ pipeline_start_date: "2026-11-01", action_types: [], primary_applicant: "Jane Q. Smith" }),
    recordWith({ pipeline_start_date: "2025-06-10", action_types: ["ZM"], primary_applicant: "Example Holdings LLC" }),
    recordWith({ pipeline_start_date: "", action_types: ["ZM"], primary_applicant: "Example Holdings LLC" }),
  ];

  it("reports the same windowTotal for both dimensions", () => {
    const action = buildMonthlyTrend(mixed, "2026-11-02", "action");
    const applicant = buildMonthlyTrend(mixed, "2026-11-02", "applicant");

    expect(action.windowTotal).toBe(6);
    expect(applicant.windowTotal).toBe(action.windowTotal);
    expect(applicant.priorWindowTotal).toBe(action.priorWindowTotal);
    expect(applicant.undatedCount).toBe(action.undatedCount);
  });

  it("makes every row total equal the sum of its buckets, in both dimensions", () => {
    for (const dimension of ["action", "applicant"] as const) {
      const trend = buildMonthlyTrend(mixed, "2026-11-02", dimension);
      const codes = trend.categories.map((category) => category.code);
      for (const row of trend.rows) {
        expect(bucketTotal(row, codes)).toBe(row.total);
      }
      expect(trend.rows.reduce((sum, row) => sum + row.total, 0)).toBe(trend.windowTotal);
    }
  });

  it("counts each application exactly once per dimension", () => {
    const applicant = buildMonthlyTrend(mixed, "2026-11-02", "applicant");
    const developer = applicant.categories.find((category) => category.code === "DEVELOPER");
    // Example Holdings LLC (Dec, and the prior-window June record is out of window),
    // plus Jane Q. Smith in the November anchor month.
    expect(developer?.total).toBe(2);
  });
});

describe("buildMonthlyTrend — undated exclusion", () => {
  it("excludes records with a missing or invalid pipeline start date, counting each once", () => {
    const trend = buildMonthlyTrend(
      [
        recordWith({ pipeline_start_date: "" }),
        recordWith({ pipeline_start_date: undefined }),
        recordWith({ pipeline_start_date: "not-a-date" }),
        recordWith({ pipeline_start_date: "2026-13-01" }),
        recordWith({ pipeline_start_date: "2026-10-01", action_types: ["ZM"] }),
      ],
      "2026-11-02",
      "action",
    );

    expect(trend.undatedCount).toBe(4);
    expect(trend.windowTotal).toBe(1);
    expect(trend.priorWindowTotal).toBe(0);
    expect(trend.rows.reduce((sum, row) => sum + row.total, 0)).toBe(1);
  });

  it("counts undated records once in the applicant dimension too", () => {
    const trend = buildMonthlyTrend(
      [recordWith({ pipeline_start_date: "" }), recordWith({ pipeline_start_date: "bad" })],
      "2026-11-02",
      "applicant",
    );
    expect(trend.undatedCount).toBe(2);
    expect(trend.windowTotal).toBe(0);
    expect(trend.categories).toEqual([]);
  });
});

describe("buildMonthlyTrend — response shape", () => {
  const records = [
    recordWith({ pipeline_start_date: "2026-10-10", action_types: ["ZM"], primary_applicant: "Example Holdings LLC" }),
    recordWith({ pipeline_start_date: "2026-10-11", action_types: ["ZR"], primary_applicant: "MTA" }),
    recordWith({ pipeline_start_date: "2026-09-11", action_types: ["ZM"], primary_applicant: "Bronx HDFC" }),
  ];

  it("matches the MonthlyTrend contract", () => {
    const trend = buildMonthlyTrend(records, "2026-11-02", "action");

    expect(Object.keys(trend).sort()).toEqual(
      [
        "categories",
        "changePct",
        "dimension",
        "groupedCodes",
        "months",
        "partialMonth",
        "priorWindowTotal",
        "rows",
        "undatedCount",
        "windowEnd",
        "windowStart",
        "windowTotal",
      ].sort(),
    );
    expect(trend.dimension).toBe("action");
    expect(Array.isArray(trend.months)).toBe(true);
    expect(trend.months).toHaveLength(12);
    expect(trend.rows).toHaveLength(12);
    expect(trend.windowStart).toBe(trend.months[0]);
    expect(trend.windowEnd).toBe(trend.months.at(-1));
    expect(typeof trend.windowTotal).toBe("number");
    expect(typeof trend.priorWindowTotal).toBe("number");
    expect(typeof trend.undatedCount).toBe("number");
    expect(typeof trend.partialMonth).toBe("boolean");
  });

  it("gives each row month/label/total plus one numeric property per category", () => {
    const trend = buildMonthlyTrend(records, "2026-11-02", "applicant");
    const codes = trend.categories.map((category) => category.code);

    for (const row of trend.rows) {
      expect(typeof row.month).toBe("string");
      expect(row.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof row.label).toBe("string");
      expect(typeof row.total).toBe("number");
      for (const code of codes) {
        expect(typeof row[code]).toBe("number");
      }
    }
    expect(trend.rows.at(-1)?.label).toBe("Nov '26");
  });

  it("orders categories by window total desc, tie-breaking on code asc", () => {
    const trend = buildMonthlyTrend(
      [
        recordWith({ pipeline_start_date: "2026-10-01", action_types: ["ZR"] }),
        recordWith({ pipeline_start_date: "2026-10-02", action_types: ["ZR"] }),
        recordWith({ pipeline_start_date: "2026-10-03", action_types: ["ZM"] }),
        recordWith({ pipeline_start_date: "2026-10-04", action_types: ["ZA"] }),
      ],
      "2026-11-02",
      "action",
    );

    expect(trend.categories.map((category) => category.code)).toEqual(["ZR", "ZA", "ZM"]);
    expect(trend.categories.every((category) => category.color.startsWith("#"))).toBe(true);
    expect(trend.categories.every((category) => category.label.length > 0)).toBe(true);
  });

  it("is stable for a fixed snapshot", () => {
    const first = buildMonthlyTrend(records, "2026-11-02", "applicant");
    const second = buildMonthlyTrend(records, "2026-11-02", "applicant");
    expect(second).toEqual(first);
  });

  it("does not mutate the input records", () => {
    const snapshot = JSON.parse(JSON.stringify(records));
    buildMonthlyTrend(records, "2026-11-02", "applicant");
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
  });
});

describe("buildMonthlyActionTrend backward compatibility", () => {
  const records = [
    recordWith({ pipeline_start_date: "2026-10-01", action_types: ["ZM"] }),
    recordWith({ pipeline_start_date: "2026-10-02", action_types: ["ZR"] }),
    recordWith({ pipeline_start_date: "2026-09-02", action_types: ["ZM"] }),
  ];

  it("reproduces buildMonthlyTrend(..., 'action') exactly", () => {
    expect(buildMonthlyActionTrend(records, "2026-11-02")).toEqual(
      buildMonthlyTrend(records, "2026-11-02", "action"),
    );
  });

  it("keeps its positional monthCount/topCategories arguments", () => {
    const trend = buildMonthlyActionTrend(records, "2026-11-02", 3, 1);
    expect(trend.months).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(trend.categories.map((category) => category.code)).toEqual(["ZM", OTHER_ACTIONS_CODE]);
    expect(trend.groupedCodes).toEqual(["ZR"]);
  });
});

describe("buildMonthlyTrend — integration against the tracked public snapshot", () => {
  const payload = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "public-dashboard-data.json"), "utf8"),
  ) as { collected_through: string; record_count: number; records: DashboardRecord[] };

  const trend = buildMonthlyTrend(payload.records, payload.collected_through, "action");
  const applicantTrend = buildMonthlyTrend(payload.records, payload.collected_through, "applicant");

  /** Independent oracle: count records by raw month key, with no shared helper. */
  function expectedWindowCounts(): Map<string, number> {
    const months = new Set(trend.months);
    const counts = new Map<string, number>(trend.months.map((month) => [month, 0]));
    for (const record of payload.records) {
      const value = record.pipeline_start_date ?? "";
      if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value))) continue;
      const month = value.slice(0, 7);
      if (!months.has(month)) continue;
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return counts;
  }

  it("anchors the window on the export's collected_through month", () => {
    expect(trend.windowEnd).toBe(payload.collected_through.slice(0, 7));
    expect(trend.months).toHaveLength(12);
    expect(trend.rows).toHaveLength(12);
  });

  it("matches an independent recount of the snapshot, month by month", () => {
    const expected = expectedWindowCounts();
    for (const month of trend.months) {
      expect(rowFor(trend, month).total).toBe(expected.get(month));
    }
    const expectedTotal = [...expected.values()].reduce((sum, count) => sum + count, 0);
    expect(trend.windowTotal).toBe(expectedTotal);
  });

  it("keeps the same window total in both dimensions and reconciles every row", () => {
    expect(applicantTrend.windowTotal).toBe(trend.windowTotal);
    for (const candidate of [trend, applicantTrend]) {
      const codes = candidate.categories.map((category) => category.code);
      for (const row of candidate.rows) {
        expect(bucketTotal(row, codes)).toBe(row.total);
      }
    }
  });

  it("classifies every snapshot application into exactly one taxonomy bucket", () => {
    const allowed = new Set(Object.keys(APPLICANT_TYPE_STYLES));
    for (const category of applicantTrend.categories) {
      expect(allowed.has(category.code)).toBe(true);
    }
    expect(applicantTrend.windowTotal).toBe(
      applicantTrend.categories.reduce((sum, category) => sum + category.total, 0),
    );
  });
});
