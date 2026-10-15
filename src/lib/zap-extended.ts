// ZapDash — Extended data layer for pipeline velocity, action types, hotspots, MIH

import { ZAPProject, groupByMonth } from "./zap";
import { formatActionCode } from "./action-codes";

// ─── Pipeline Velocity ───

export interface PipelineStage {
  stage: string;
  count: number;
  medianDays?: number;
}

export function computePipeline(projects: ZAPProject[]): PipelineStage[] {
  const filed = projects.filter((p) => p.app_filed_date);
  const certified = projects.filter((p) => p.certified_referred);
  const completed = projects.filter((p) => p.public_status === "Completed");
  const terminated = projects.filter((p) => p.project_status === "Terminated");

  // Compute median days between filing and certification
  const daysFiledToCert = projects
    .filter((p) => p.app_filed_date && p.certified_referred)
    .map((p) => {
      const d = new Date(p.certified_referred!).getTime() - new Date(p.app_filed_date!).getTime();
      return Math.round(d / (1000 * 60 * 60 * 24));
    })
    .filter((d) => d >= 0 && d < 5000);

  const medianDaysFiledToCert = median(daysFiledToCert);

  // Compute median days from certification to completion
  const daysCertToComplete = projects
    .filter((p) => p.certified_referred && p.current_milestone_date && (p.public_status === "Completed"))
    .map((p) => {
      const d = new Date(p.current_milestone_date!).getTime() - new Date(p.certified_referred!).getTime();
      return Math.round(d / (1000 * 60 * 60 * 24));
    })
    .filter((d) => d >= 0 && d < 5000);

  const medianDaysCertToComplete = median(daysCertToComplete);

  return [
    { stage: "Filed", count: filed.length },
    { stage: "Certified / Referred", count: certified.length, medianDays: medianDaysFiledToCert },
    { stage: "Completed", count: completed.length, medianDays: medianDaysCertToComplete },
    { stage: "Terminated", count: terminated.length },
  ];
}

function median(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── Filing Trends by Action Type ───

export interface ActionTypeTrend {
  action: string;
  monthly: { label: string; count: number }[];
}

export function groupByActionType(projects: ZAPProject[]): { action: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const p of projects) {
    if (!p.actions) continue;
    const actions = p.actions.split(",").map((a) => a.trim()).filter(Boolean);
    for (const raw of actions) {
      // Split on semicolons too — some entries are "ZM; ZR"
      const codes = raw.split(";").map((c) => c.trim()).filter(Boolean);
      for (const code of codes) {
        const label = formatActionCode(code);
        buckets[label] = (buckets[label] || 0) + 1;
      }
    }
  }
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b - a)
    .map(([action, count]) => ({ action, count }));
}

// Top N action types over time
export function actionTypeTrends(
  projects: ZAPProject[],
  topN = 6
): ActionTypeTrend[] {
  const actionCounts = groupByActionType(projects);
  const topActions = actionCounts.slice(0, topN).map((a) => a.action);

  return topActions.map((action) => {
    const matching = projects.filter(
      (p) => p.actions && p.actions.split(",").map((a) => a.trim()).flatMap((a) => a.split(";").map((c) => c.trim())).some((code) => formatActionCode(code) === action)
    );
    return {
      action,
      monthly: groupByMonth(matching, "app_filed_date"),
    };
  });
}

// ─── Hotspots (Borough + CD) ───

export interface HotspotData {
  borough: string;
  community_district: string;
  count: number;
}

export function computeHotspots(projects: ZAPProject[], minCount = 5): HotspotData[] {
  const buckets: Record<string, { borough: string; cd: string; count: number }> = {};
  for (const p of projects) {
    const b = p.borough || "Unknown";
    const cd = p.community_district || "Unknown";
    const key = `${b}|${cd}`;
    if (!buckets[key]) buckets[key] = { borough: b, cd, count: 0 };
    buckets[key].count++;
  }
  return Object.values(buckets)
    .filter((v) => v.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .map((v) => ({ borough: v.borough, community_district: v.cd, count: v.count }));
}

// Rolling 12-month hotspot comparison
export function recentHotspots(projects: ZAPProject[], months = 12): HotspotData[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const recent = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    return new Date(p.app_filed_date) >= cutoff;
  });
  return computeHotspots(recent, 1);
}

// ─── MIH Tracker ───

export interface MIHData {
  year: string;
  total: number;
  option1: number;
  option2: number;
  workforce: number;
  deepAffordability: number;
}

export function computeMIH(projects: ZAPProject[]): MIHData[] {
  const mihProjects = projects.filter((p) => p.mih_flag === "true" || p.mih_flag === "True");
  const buckets: Record<string, MIHData> = {};

  for (const p of mihProjects) {
    if (!p.app_filed_date) continue;
    const year = new Date(p.app_filed_date).getFullYear().toString();
    if (!buckets[year]) {
      buckets[year] = { year, total: 0, option1: 0, option2: 0, workforce: 0, deepAffordability: 0 };
    }
    const b = buckets[year];
    b.total++;
    if (p.mih_option1 === "true" || p.mih_option1 === "True") b.option1++;
    if (p.mih_option2 === "true" || p.mih_option2 === "True") b.option2++;
    if (p.mih_workforce === "true" || p.mih_workforce === "True") b.workforce++;
    if (p.mih_deepaffordability === "true" || p.mih_deepaffordability === "True") b.deepAffordability++;
  }

  return Object.values(buckets).sort((a, b) => a.year.localeCompare(b.year));
}

// ─── Success / Failure Rates ───

export interface OutcomeData {
  action: string;
  completed: number;
  terminated: number;
  total: number;
  successRate: number;
}

export function computeOutcomes(projects: ZAPProject[]): OutcomeData[] {
  const buckets: Record<string, { completed: number; terminated: number; total: number }> = {};

  for (const p of projects) {
    if (!p.actions) continue;
    const actions = p.actions.split(",").flatMap((a) => a.split(";").map((c) => c.trim())).filter(Boolean);
    for (const rawCode of actions) {
      const action = formatActionCode(rawCode);
      if (!buckets[action]) buckets[action] = { completed: 0, terminated: 0, total: 0 };
      buckets[action].total++;
      if (p.public_status === "Completed") buckets[action].completed++;
      if (p.project_status === "Terminated") buckets[action].terminated++;
    }
  }

  return Object.entries(buckets)
    .filter(([, v]) => v.total >= 10) // only show action types with enough data
    .map(([action, v]) => ({
      action,
      completed: v.completed,
      terminated: v.terminated,
      total: v.total,
      successRate: Math.round((v.completed / v.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

// ─── Cycle Comparison ───

export interface CycleComparison {
  period: string;
  count: number;
}

export function cycleComparison(projects: ZAPProject[]): {
  thisYear: number;
  lastYear: number;
  fiveYearAvg: number;
  monthly: { label: string; thisYear: number; lastYear: number; avg5y: number }[];
} {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const fiveYearsAgo = thisYear - 5;

  const thisYearCount = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    return new Date(p.app_filed_date).getFullYear() === thisYear;
  }).length;

  const lastYearCount = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    return new Date(p.app_filed_date).getFullYear() === lastYear;
  }).length;

  const fiveYearProjects = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    const y = new Date(p.app_filed_date).getFullYear();
    return y >= fiveYearsAgo && y < thisYear;
  }).length;

  const fiveYearAvg = Math.round(fiveYearProjects / 5);

  // Monthly comparison
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const monthly = months.map((m) => {
    const label = m;
    const ty = projects.filter((p) => {
      if (!p.app_filed_date) return false;
      const d = new Date(p.app_filed_date);
      return d.getFullYear() === thisYear && String(d.getMonth() + 1).padStart(2, "0") === m;
    }).length;
    const ly = projects.filter((p) => {
      if (!p.app_filed_date) return false;
      const d = new Date(p.app_filed_date);
      return d.getFullYear() === lastYear && String(d.getMonth() + 1).padStart(2, "0") === m;
    }).length;
    const avg5 = Math.round(
      projects.filter((p) => {
        if (!p.app_filed_date) return false;
        const d = new Date(p.app_filed_date);
        return (
          d.getFullYear() >= fiveYearsAgo &&
          d.getFullYear() < thisYear &&
          String(d.getMonth() + 1).padStart(2, "0") === m
        );
      }).length / 5
    );
    return { label, thisYear: ty, lastYear: ly, avg5y: avg5 };
  });

  return { thisYear: thisYearCount, lastYear: lastYearCount, fiveYearAvg, monthly };
}