// ZapDash — Auto-generated narrative insights from chart data

import {
  PipelineStage,
  HotspotData,
  MIHData,
  OutcomeData,
} from "./zap-extended";

export function pipelineInsight(data: PipelineStage[]): string {
  const filed = data.find((d) => d.stage === "Filed")?.count || 0;
  const certified = data.find((d) => d.stage === "Certified / Referred")?.count || 0;
  const completed = data.find((d) => d.stage === "Completed")?.count || 0;
  const terminated = data.find((d) => d.stage === "Terminated")?.count || 0;
  const certRate = filed > 0 ? Math.round((certified / filed) * 100) : 0;
  const completionRate = certified > 0 ? Math.round((completed / certified) * 100) : 0;
  const terminationRate = filed > 0 ? Math.round((terminated / filed) * 100) : 0;
  const medianFiledToCert = data.find((d) => d.stage === "Certified / Referred")?.medianDays;
  const medianCertToComplete = data.find((d) => d.stage === "Completed")?.medianDays;

  let text = `${certRate}% of filed projects reach certification`;
  if (medianFiledToCert) text += `, taking a median of ${medianFiledToCert} days`;
  text += `. ${completionRate}% of certified projects go on to completion`;
  if (medianCertToComplete) text += ` (median ${medianCertToComplete} days from certification)`;
  text += `. ${terminationRate}% of all filed projects ultimately terminate — a key risk factor to weigh when advising clients on project viability.`;
  return text;
}

export function cycleInsight(thisYear: number, lastYear: number, fiveYearAvg: number): string {
  const yoy = lastYear > 0 ? Math.round(((thisYear - lastYear) / lastYear) * 100) : 0;
  const vsAvg = fiveYearAvg > 0 ? Math.round(((thisYear - fiveYearAvg) / fiveYearAvg) * 100) : 0;

  let text = `Filing volume this year (${thisYear.toLocaleString()}) is `;
  if (yoy > 0) text += `up ${yoy}% from last year (${lastYear.toLocaleString()})`;
  else if (yoy < 0) text += `down ${Math.abs(yoy)}% from last year (${lastYear.toLocaleString()})`;
  else text += `flat compared to last year`;
  text += ` and `;
  if (vsAvg > 5) text += `above the 5-year average (${fiveYearAvg.toLocaleString()}/yr), suggesting an active development cycle.`;
  else if (vsAvg < -5) text += `below the 5-year average (${fiveYearAvg.toLocaleString()}/yr), indicating a slower market.`;
  else text += `roughly in line with the 5-year average (${fiveYearAvg.toLocaleString()}/yr).`;
  return text;
}

export function outcomeInsight(data: OutcomeData[]): string {
  if (data.length === 0) return "Not enough data to assess outcomes.";
  const top = data[0];
  const highSuccess = data.filter((d) => d.successRate >= 80);
  const lowSuccess = data.filter((d) => d.successRate < 50);
  let text = `The most common action type is ${top.action} (${top.total.toLocaleString()} projects, ${top.successRate}% completion rate). `;
  if (highSuccess.length > 0) {
    text += `High-confidence actions: ${highSuccess.slice(0, 3).map((d) => `${d.action} (${d.successRate}%)`).join(", ")}. `;
  }
  if (lowSuccess.length > 0) {
    text += `Higher-risk actions: ${lowSuccess.slice(0, 3).map((d) => `${d.action} (${d.successRate}%)`).join(", ")}. `;
  }
  text += "Use these rates to set realistic timelines and risk expectations with clients.";
  return text;
}

export function actionTrendInsight(data: { action: string; monthly: { label: string; count: number }[] }[]): string {
  if (data.length === 0) return "No action type data available.";
  const top = data[0];
  const recentMonths = top.monthly.slice(-6);
  const recentTotal = recentMonths.reduce((s, m) => s + m.count, 0);
  const olderMonths = top.monthly.slice(-12, -6);
  const olderTotal = olderMonths.reduce((s, m) => s + m.count, 0);
  const trend = olderTotal > 0 ? Math.round(((recentTotal - olderTotal) / olderTotal) * 100) : 0;

  let text = `The dominant action type is ${top.action}. `;
  if (trend > 10) text += `It's trending up over the last 6 months (+${trend}% vs prior 6 months), suggesting increased demand for this type of approval.`;
  else if (trend < -10) text += `It's declined over the last 6 months (${trend}% vs prior 6 months), possibly reflecting a market shift.`;
  else text += `Filing volume has been relatively stable recently.`;
  text += ` Watch ${data[1]?.action || "secondary action types"} for emerging shifts in development strategy.`;
  return text;
}

export function hotspotInsight(allTime: HotspotData[], recent: HotspotData[]): string {
  const topAll = allTime[0];
  const topRecent = recent[0];
  if (!topAll || !topRecent) return "Not enough data for hotspot analysis.";

  const recentInAll = recent.slice(0, 5).map((r) => r.community_district);
  const allInRecent = allTime.slice(0, 5).map((a) => a.community_district);
  const overlap = recentInAll.filter((cd) => allInRecent.includes(cd));

  let text = `The most active community district overall is ${topAll.community_district} (${topAll.borough}, ${topAll.count.toLocaleString()} projects). `;
  text += `In the last 12 months, ${topRecent.community_district} (${topRecent.borough}) leads with ${topRecent.count.toLocaleString()} filings. `;
  if (overlap.length >= 3) {
    text += `There's strong overlap between all-time and recent hotspots, indicating sustained development pressure in these districts.`;
  } else {
    text += `The recent hotspots differ noticeably from all-time leaders, suggesting development pressure may be shifting to new areas.`;
  }
  return text;
}

export function mihInsight(data: MIHData[]): string {
  if (data.length === 0) return "No MIH projects found in the dataset.";
  const latest = data[data.length - 1];
  const prev = data.length >= 2 ? data[data.length - 2] : null;

  let text = `MIH projects have been tracked since ${data[0].year}. `;
  text += `In ${latest.year}, there were ${latest.total} MIH projects — `;
  if (latest.option1 > latest.option2) {
    text += `Option 1 (average affordability) leads with ${latest.option1} projects, followed by Option 2 (${latest.option2}). `;
  } else {
    text += `Option 2 (deep affordability) leads with ${latest.option2} projects, followed by Option 1 (${latest.option1}). `;
  }
  if (prev) {
    const change = prev.total > 0 ? Math.round(((latest.total - prev.total) / prev.total) * 100) : 0;
    if (change > 10) text += `That's up ${change}% from ${prev.year}, showing growing MIH uptake.`;
    else if (change < -10) text += `That's down ${Math.abs(change)}% from ${prev.year}.`;
    else text += `Roughly flat compared to ${prev.year}.`;
  }
  return text;
}

export function filingsInsight(monthly: { label: string; count: number }[]): string {
  if (monthly.length < 3) return "Not enough filing data for trend analysis.";
  const recent = monthly.slice(-6);
  const recentAvg = Math.round(recent.reduce((s, m) => s + m.count, 0) / recent.length);
  const older = monthly.slice(-12, -6);
  const olderAvg = older.length > 0 ? Math.round(older.reduce((s, m) => s + m.count, 0) / older.length) : 0;
  const trend = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

  let text = `Recent filing rate: ~${recentAvg}/month. `;
  if (trend > 15) text += `That's up ${trend}% from the prior 6-month average, indicating an active market.`;
  else if (trend < -15) text += `That's down ${Math.abs(trend)}% from the prior 6-month average — a cooling trend worth monitoring.`;
  else text += `Filing volume has been relatively stable.`;
  return text;
}

export function boroughInsight(data: { borough: string; count: number }[]): string {
  if (data.length === 0) return "No borough data.";
  const top = data[0];
  const total = data.reduce((s, d) => s + d.count, 0);
  const share = Math.round((top.count / total) * 100);
  return `${top.borough} leads with ${top.count.toLocaleString()} projects (${share}% of all filings). ${data.slice(1, 3).map((d) => `${d.borough} (${d.count.toLocaleString()})`).join(" and ")} follow. Borough distribution reflects where development pressure concentrates and where CEQR workload is heaviest.`;
}

export function statusInsight(data: { status: string; count: number }[]): string {
  if (data.length === 0) return "No status data.";
  const total = data.reduce((s, d) => s + d.count, 0);
  const active = data.find((d) => d.status === "Active")?.count || 0;
  const pct = Math.round((active / total) * 100);
  return `${active.toLocaleString()} projects (${pct}%) are currently active in the pipeline. ${data.filter((d) => d.status !== "Active").slice(0, 2).map((d) => `${d.status}: ${d.count.toLocaleString()}`).join(", ")}. The active pipeline represents the current CEQR and ULURP workload.`;
}

export function applicantInsight(data: { type: string; count: number }[]): string {
  if (data.length === 0) return "No applicant type data.";
  const top = data[0];
  const total = data.reduce((s, d) => s + d.count, 0);
  const share = Math.round((top.count / total) * 100);
  return `${top.type} is the most common applicant type (${share}% of filings). ${data.slice(1, 3).map((d) => `${d.type} (${d.count.toLocaleString()})`).join(" and ")} follow. This mix shapes the types of actions filed and the typical CEQR pathways needed.`;
}