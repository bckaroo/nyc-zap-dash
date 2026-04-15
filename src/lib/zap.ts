// ZapDash — Data layer for NYC ZAP OpenData
const ZAP_DATASET = "hgx4-8ukb";
const ZAP_BASE = `https://data.cityofnewyork.us/resource/${ZAP_DATASET}.json`;

export interface ZAPProject {
  project_id: string;
  project_name?: string;
  project_status?: string;
  public_status?: string;
  borough?: string;
  community_district?: string;
  app_filed_date?: string;
  certified_referred?: string;
  current_milestone_date?: string;
  current_milestone?: string;
  applicant_type?: string;
  primary_applicant?: string;
  actions?: string;
  ulurp_non?: string;
  ceqr_number?: string;
  mih_flag?: string;
  mih_option1?: string;
  mih_option2?: string;
  mih_workforce?: string;
  mih_deepaffordability?: string;
  project_brief?: string;
}

export interface TimeBucket {
  label: string;
  count: number;
}

// Fetch projects with optional filters — paginated for large dataset
export async function fetchProjects(params?: Record<string, string>): Promise<ZAPProject[]> {
  const limit = 10000;
  let offset = 0;
  let all: ZAPProject[] = [];
  let batch: ZAPProject[];
  do {
    const url = new URL(ZAP_BASE);
    url.searchParams.set("$limit", String(limit));
    url.searchParams.set("$offset", String(offset));
    url.searchParams.set("$order", "app_filed_date DESC");
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`ZAP fetch failed: ${res.status}`);
    batch = await res.json();
    all = all.concat(batch);
    offset += limit;
  } while (batch.length === limit);
  return all;
}

// Group filings by month
export function groupByMonth(projects: ZAPProject[], field: keyof ZAPProject = "app_filed_date"): TimeBucket[] {
  const buckets: Record<string, number> = {};
  for (const p of projects) {
    const raw = p[field];
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
}

// Group by borough
export function groupByBorough(projects: ZAPProject[]): { borough: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const p of projects) {
    const b = p.borough || "Unknown";
    buckets[b] = (buckets[b] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b - a)
    .map(([borough, count]) => ({ borough, count }));
}

// Group by status
export function groupByStatus(projects: ZAPProject[]): { status: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const p of projects) {
    const s = p.project_status || "Unknown";
    buckets[s] = (buckets[s] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({ status, count }));
}

// Group by applicant type
export function groupByApplicantType(projects: ZAPProject[]): { type: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const p of projects) {
    const t = p.applicant_type || "Unknown";
    buckets[t] = (buckets[t] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count }));
}