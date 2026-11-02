import { getActionStyle, type MapPayload } from "./map-data";

export interface DashboardRecord {
  id: string;
  project_id: string;
  project_name: string;
  project_brief: string;
  borough: string;
  community_district: string;
  public_status: string;
  ulurp_non: string;
  ceqr_number: string;
  ceqr_type: string;
  eas_eis: string;
  primary_applicant: string;
  applicant_type: string;
  flood_zone_a: number;
  flood_zone_shadedx: number;
  milestone_date: string;
  pipeline_start_date?: string;
  certified_referred: string;
  first_seen_date: string;
  last_updated_date: string;
  activity_date: string;
  source_url: string;
  action_types: string[];
  location_method: string;
  location_source: string;
}

export interface DashboardPayload {
  generated_at: string;
  collected_through: string;
  record_count: number;
  source: {
    name: string;
    url: string;
    api_url: string;
  };
  boundaries?: {
    boroughs: { dataset_id: string; name?: string; source_url?: string; file?: string; retrieved_at?: string };
    community_districts: { dataset_id: string; name?: string; source_url?: string; file?: string; retrieved_at?: string; scope?: string };
  };
  map?: MapPayload;
  records: DashboardRecord[];
}

export interface ApplicationFilters {
  search?: string;
  borough?: string;
  communityDistrict?: string;
  status?: string;
}

export const SOURCE_ATTRIBUTION =
  "Source: NYC Department of City Planning Zoning Application Portal (ZAP), collected from the public per-project API.";

export const COVERAGE_DISCLOSURE =
  "ZapDash covers discretionary land-use applications found by a bounded local collector, not all NYC development. Data may lag the official record and may omit or later revise applications and source fields.";

export const APPLICANT_CAVEAT = {
  heading: "Most active named applicants",
  body: "Application records with activity in the trailing 12 months. The primary applicant is the name reported by ZAP and is not necessarily the developer, owner, or project sponsor.",
} as const;

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function utcDateOnly(value: string): Date | null {
  if (!isValidDate(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildOverview(records: DashboardRecord[]) {
  const boroughs = new Set(records.map((record) => record.borough).filter(Boolean));
  const latestActivityDate = records
    .map((record) => record.activity_date)
    .filter(isValidDate)
    .sort()
    .at(-1) ?? "";

  return {
    trackedApplications: records.length,
    inPublicReview: records.filter((record) => record.public_status === "In Public Review").length,
    boroughsCovered: boroughs.size,
    latestActivityDate,
  };
}

export function filterApplications(
  records: DashboardRecord[],
  filters: ApplicationFilters,
): DashboardRecord[] {
  const searchTerms = (filters.search ?? "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return records.filter((record) => {
    if (filters.borough && record.borough !== filters.borough) return false;
    if (filters.communityDistrict && record.community_district !== filters.communityDistrict) return false;
    if (filters.status && record.public_status !== filters.status) return false;

    const haystack = [
      record.project_name,
      record.project_brief,
      record.primary_applicant,
      record.project_id,
      record.ceqr_number,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return searchTerms.every((term) => haystack.includes(term));
  });
}

export function monthlyActivityTrend(
  records: DashboardRecord[],
  filters: Pick<ApplicationFilters, "borough" | "communityDistrict"> = {},
  throughDate?: string,
  monthCount = 18,
): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  const endDate = throughDate ? utcDateOnly(throughDate) : null;
  if (endDate && monthCount > 0) {
    const month = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - monthCount + 1, 1));
    for (let index = 0; index < monthCount; index += 1) {
      counts.set(month.toISOString().slice(0, 7), 0);
      month.setUTCMonth(month.getUTCMonth() + 1);
    }
  }

  for (const record of filterApplications(records, filters)) {
    if (!isValidDate(record.activity_date)) continue;
    const month = record.activity_date.slice(0, 7);
    if (endDate && !counts.has(month)) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({ month, count }));
}

export const MONTHLY_TREND_MONTHS = 12;
export const MONTHLY_TREND_TOP_CATEGORIES = 8;
export const OTHER_ACTIONS_CODE = "OTHER_ACTIONS";
export const OTHER_ACTIONS_COLOR = "#6b7770";
export const UNDATED_ACTION_CODE = "UNREPORTED";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface MonthlyActionCategory {
  code: string;
  label: string;
  color: string;
  total: number;
}

export interface MonthlyActionRow {
  month: string;
  label: string;
  total: number;
  [key: string]: number | string;
}

export interface MonthlyActionTrend {
  months: string[];
  rows: MonthlyActionRow[];
  categories: MonthlyActionCategory[];
  groupedCodes: string[];
  windowStart: string;
  windowEnd: string;
  windowTotal: number;
  priorWindowTotal: number;
  changePct: number | null;
  undatedCount: number;
  partialMonth: boolean;
}

export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  const name = MONTH_NAMES[index - 1];
  if (!name || !Number.isFinite(year)) return month;
  return `${name} '${String(year).slice(2)}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * Month an application entered the review pipeline, from the collector's
 * earliest recorded ZAP milestone. milestone_date is deliberately NOT used:
 * it tracks the latest movement of an already-filed application, so counting
 * by it pushes old projects into recent months and invents growth.
 */
export function pipelineEntryMonth(record: DashboardRecord): string | null {
  const value = record.pipeline_start_date ?? "";
  return isValidDate(value) ? value.slice(0, 7) : null;
}

export function primaryActionCode(record: DashboardRecord): string {
  const code = record.action_types?.find((value) => Boolean(value?.trim()));
  return (code ?? UNDATED_ACTION_CODE).trim().toUpperCase();
}

/**
 * New applications entering the ZAP review pipeline per month, stacked by the
 * primary action type (the same first-listed code the map colours by). Each
 * application is counted exactly once, in its entry month, so the stack height
 * equals the number of applications that entered the pipeline that month.
 */
export function buildMonthlyActionTrend(
  records: DashboardRecord[],
  collectedThrough: string,
  monthCount = MONTHLY_TREND_MONTHS,
  topCategories = MONTHLY_TREND_TOP_CATEGORIES,
): MonthlyActionTrend {
  const end = utcDateOnly(collectedThrough);
  const empty: MonthlyActionTrend = {
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
  if (!end || monthCount <= 0) return empty;

  const endMonth = end.toISOString().slice(0, 7);
  const firstMonth = shiftMonth(endMonth, -(monthCount - 1));
  const months = Array.from({ length: monthCount }, (_, index) => shiftMonth(firstMonth, index));
  const windowMonths = new Set(months);
  const priorMonths = new Set(
    Array.from({ length: monthCount }, (_, index) => shiftMonth(firstMonth, index - monthCount)),
  );

  const windowByCode = new Map<string, number>();
  const monthByCode = new Map<string, Map<string, number>>();
  let windowTotal = 0;
  let priorWindowTotal = 0;
  let undatedCount = 0;

  for (const record of records) {
    const month = pipelineEntryMonth(record);
    if (!month) {
      undatedCount += 1;
      continue;
    }
    if (windowMonths.has(month)) {
      const code = primaryActionCode(record);
      windowTotal += 1;
      windowByCode.set(code, (windowByCode.get(code) ?? 0) + 1);
      const counts = monthByCode.get(month) ?? new Map<string, number>();
      counts.set(code, (counts.get(code) ?? 0) + 1);
      monthByCode.set(month, counts);
      continue;
    }
    if (priorMonths.has(month)) priorWindowTotal += 1;
  }

  const ranked = [...windowByCode.entries()].sort(
    ([leftCode, leftTotal], [rightCode, rightTotal]) =>
      rightTotal - leftTotal || leftCode.localeCompare(rightCode),
  );
  const kept = ranked.slice(0, Math.max(0, topCategories));
  const grouped = ranked.slice(kept.length);
  const keptCodes = new Set(kept.map(([code]) => code));

  const categories: MonthlyActionCategory[] = kept.map(([code, total]) => {
    const style = getActionStyle(code);
    return { code, label: style.label, color: style.color, total };
  });
  if (grouped.length) {
    categories.push({
      code: OTHER_ACTIONS_CODE,
      label: `Other actions (${grouped.length})`,
      color: OTHER_ACTIONS_COLOR,
      total: grouped.reduce((sum, [, total]) => sum + total, 0),
    });
  }

  const rows = months.map((month) => {
    const row: MonthlyActionRow = { month, label: monthLabel(month), total: 0 };
    for (const category of categories) row[category.code] = 0;
    let total = 0;
    for (const [code, count] of monthByCode.get(month) ?? []) {
      total += count;
      if (keptCodes.has(code)) {
        row[code] = (row[code] as number) + count;
      } else {
        row[OTHER_ACTIONS_CODE] = (row[OTHER_ACTIONS_CODE] as number) + count;
      }
    }
    row.total = total;
    return row;
  });

  const lastDayOfEndMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return {
    months,
    rows,
    categories,
    groupedCodes: grouped.map(([code]) => code),
    windowStart: months[0],
    windowEnd: endMonth,
    windowTotal,
    priorWindowTotal,
    changePct: priorWindowTotal > 0
      ? Math.round(((windowTotal - priorWindowTotal) / priorWindowTotal) * 100)
      : null,
    undatedCount,
    partialMonth: end.getUTCDate() < lastDayOfEndMonth,
  };
}

export function selectWeeklyHighlights(
  records: DashboardRecord[],
  collectedThrough: string,
): DashboardRecord[] {
  const endDate = utcDateOnly(collectedThrough);
  if (!endDate) return [];
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 6);

  return records
    .filter((record) => {
      const date = utcDateOnly(record.activity_date);
      return date !== null && date >= startDate && date <= endDate;
    })
    .sort((left, right) =>
      right.activity_date.localeCompare(left.activity_date)
      || left.project_name.localeCompare(right.project_name)
      || left.id.localeCompare(right.id),
    );
}

export function computeApplicantLeaderboard(
  records: DashboardRecord[],
  asOf: string,
  limit = 10,
): { name: string; applicationCount: number; projects: DashboardRecord[] }[] {
  const asOfDate = utcDateOnly(asOf);
  if (!asOfDate) return [];
  const cutoff = new Date(asOfDate);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);

  const projectsByApplicant = new Map<string, DashboardRecord[]>();
  for (const record of records) {
    const name = record.primary_applicant.trim();
    if (!name || name.toLocaleLowerCase() === "unknown" || !isValidDate(record.activity_date)) continue;
    const activityDate = utcDateOnly(record.activity_date);
    if (!activityDate) continue;
    if (activityDate < cutoff || activityDate > asOfDate) continue;
    const projects = projectsByApplicant.get(name) ?? [];
    projects.push(record);
    projectsByApplicant.set(name, projects);
  }

  return [...projectsByApplicant.entries()]
    .sort(([leftName, leftProjects], [rightName, rightProjects]) =>
      rightProjects.length - leftProjects.length || leftName.localeCompare(rightName),
    )
    .slice(0, limit)
    .map(([name, projects]) => ({
      name,
      applicationCount: projects.length,
      projects: [...projects].sort((left, right) =>
        right.activity_date.localeCompare(left.activity_date)
        || left.project_name.localeCompare(right.project_name)
        || left.id.localeCompare(right.id),
      ),
    }));
}
