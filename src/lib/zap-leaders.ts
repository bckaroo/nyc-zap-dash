// ZapDash — Top developers and top projects by magnitude

import { ZAPProject } from "./zap";

export interface TopDeveloper {
  name: string;
  projectCount: number;
  boroughs: string[];
  actionTypes: string[];
  recentProject?: string;
}

export interface TopProject {
  projectId: string;
  projectName: string;
  applicant: string;
  borough: string;
  communityDistrict: string;
  actionCount: number;
  filedDate: string | null;
  status: string;
  brief: string;
}

// Extract approximate size from project briefs (zsquare feet, units)
function extractMagnitude(brief: string): { zsft?: number; units?: number } {
  const result: { zsft?: number; units?: number } = {};
  // Match patterns like "146,800-zsf", "146,800 zsf", "146,800 gross square feet"
  const zsfMatch = brief.match(/([\d,]+)[\s-]*(?:zsf|gsf|gross\s*square\s*feet|square\s*feet)/i);
  if (zsfMatch) result.zsft = parseInt(zsfMatch[1].replace(/,/g, ""), 10);
  // Match patterns like "120 residences", "250 dwelling units", "300 units"
  const unitMatch = brief.match(/([\d,]+)\s*(?:residences|dwelling\s*units|units|apartments)/i);
  if (unitMatch) result.units = parseInt(unitMatch[1].replace(/,/g, ""), 10);
  return result;
}

export function computeTopDevelopers(projects: ZAPProject[], topN = 15): TopDeveloper[] {
  const devMap: Record<string, { count: number; boroughs: Set<string>; actions: Set<string>; recentProject?: string }> = {};

  for (const p of projects) {
    const name = p.primary_applicant;
    if (!name || name === "Unknown" || name === "DCP" || name === "DRP" || name === "HPD" || name === "LPC" || name === "DEP" || name === "DCAS" || name === "DOT" || name === "DPR" || name === "DSNY" || name === "HRA") continue;
    if (!devMap[name]) {
      devMap[name] = { count: 0, boroughs: new Set(), actions: new Set() };
    }
    devMap[name].count++;
    if (p.borough) devMap[name].boroughs.add(p.borough);
    if (p.actions) p.actions.split(";").map((a) => a.trim()).forEach((a) => devMap[name].actions.add(a));
    devMap[name].recentProject = p.project_name || devMap[name].recentProject;
  }

  return Object.entries(devMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, topN)
    .map(([name, d]) => ({
      name,
      projectCount: d.count,
      boroughs: [...d.boroughs],
      actionTypes: [...d.actions],
      recentProject: d.recentProject,
    }));
}

export function computeTopProjects(projects: ZAPProject[], topN = 15): TopProject[] {
  const scored = projects
    .filter((p) => p.project_name && p.primary_applicant && p.primary_applicant !== "Unknown")
    .map((p) => {
      // Score by: action count + brief magnitude (zsf/units) + recency bonus
      const actionCount = p.actions ? p.actions.split(";").map((a) => a.trim()).filter(Boolean).length : 0;
      let magnitudeScore = 0;
      if (p.project_brief) {
        const mag = extractMagnitude(p.project_brief);
        if (mag.zsft) magnitudeScore += mag.zsft / 10000; // 10k zsf = 1 point
        if (mag.units) magnitudeScore += mag.units / 10; // 10 units = 1 point
      }
      // Recency bonus: more recent = higher
      let recencyBonus = 0;
      if (p.app_filed_date) {
        const yearsAgo = (Date.now() - new Date(p.app_filed_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        recencyBonus = Math.max(0, 5 - yearsAgo); // up to 5 points for recent
      }
      const score = actionCount * 3 + magnitudeScore + recencyBonus;

      return {
        projectId: p.project_id,
        projectName: p.project_name!,
        applicant: p.primary_applicant!,
        borough: p.borough || "Unknown",
        communityDistrict: p.community_district || "Unknown",
        actionCount,
        filedDate: p.app_filed_date || null,
        status: p.project_status || "Unknown",
        brief: p.project_brief || "",
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored;
}