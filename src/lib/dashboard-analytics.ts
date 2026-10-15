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
  certified_referred: string;
  first_seen_date: string;
  last_updated_date: string;
  activity_date: string;
  source_url: string;
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
): { name: string; applicationCount: number }[] {
  const asOfDate = utcDateOnly(asOf);
  if (!asOfDate) return [];
  const cutoff = new Date(asOfDate);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);

  const counts = new Map<string, number>();
  for (const record of records) {
    const name = record.primary_applicant.trim();
    if (!name || name.toLocaleLowerCase() === "unknown" || !isValidDate(record.activity_date)) continue;
    const activityDate = utcDateOnly(record.activity_date);
    if (!activityDate) continue;
    if (activityDate < cutoff || activityDate > asOfDate) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || leftName.localeCompare(rightName),
    )
    .slice(0, limit)
    .map(([name, applicationCount]) => ({ name, applicationCount }));
}
