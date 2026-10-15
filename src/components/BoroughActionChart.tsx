"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getActionStyle, type MapPayload } from "../lib/map-data";

export interface BoroughActionRow { borough: string; [actionCode: string]: string | number }

interface TooltipItem { value?: unknown; dataKey?: unknown; name?: unknown }

/** Compact tooltip: sorted largest first, counts column, no giant chrome. */
function BoroughActionTooltip(props: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipItem>;
  label?: string | number;
}) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;
  const items = [...payload]
    .filter((entry) => Number(entry.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  const total = items.reduce((sum, entry) => sum + Number(entry.value), 0);
  return (
    <div className="action-tooltip">
      <p className="action-tooltip-title">{label} · {total} projects</p>
      <ul>
        {items.map((entry) => {
          const style = getActionStyle(String(entry.dataKey ?? entry.name));
          return (
            <li key={String(entry.dataKey)}>
              <i style={{ background: style.color }} />
              <span className="action-tooltip-count">{String(entry.value)}</span>
              <span className="action-tooltip-label">{style.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Distinct projects per borough per action type. A multisite project appears
 * once per (borough, action) pair it actually has, so citywide choropleth
 * counts stay distinct-project counts.
 */
export function buildBoroughActionRows(
  projectSites: MapPayload["project_sites"],
): BoroughActionRow[] {
  const pairs = new Map<string, Map<string, Set<string>>>();
  for (const feature of projectSites.features) {
    const { borough, project_id: projectId, primary_action_type: action } = feature.properties;
    if (!borough) continue;
    const byProject = pairs.get(borough) ?? new Map<string, Set<string>>();
    const actions = byProject.get(projectId) ?? new Set<string>();
    actions.add(String(action ?? "UNREPORTED"));
    byProject.set(projectId, actions);
    pairs.set(borough, byProject);
  }
  return [...pairs.entries()]
    .map(([borough, byProject]) => {
      const row: BoroughActionRow = { borough };
      for (const actions of byProject.values()) {
        for (const action of actions) row[action] = ((row[action] as number) ?? 0) + 1;
      }
      return row;
    })
    .sort((a, b) => a.borough.localeCompare(b.borough));
}

export default function BoroughActionChart({ mapData }: { mapData: MapPayload }) {
  const rows = buildBoroughActionRows(mapData.project_sites);
  const codes = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k !== "borough")))].sort();
  return (
    <div className="map-chart-wrap" aria-label="Borough activity by ZAP action type">
      <p className="chart-note">
        Distinct ZAP projects per borough, stacked by action type. A project with several action
        types counts once under each; borough totals use the same distinct-project rule as the map.
      </p>
      {rows.length ? (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 12, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #ddd)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="borough" width={92} tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(10, 102, 64, 0.06)" }}
              content={BoroughActionTooltip}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={64}
              wrapperStyle={{ overflowY: "auto", maxHeight: 68, paddingRight: 8 }}
              formatter={(value) => (
                <span style={{ fontSize: 11, color: "inherit" }}>{getActionStyle(String(value)).label}</span>
              )}
            />
            {codes.map((code) => (
              <Bar key={code} dataKey={code} stackId="projects" fill={getActionStyle(code).color} name={code} maxBarSize={30} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty-state">No located projects in this snapshot yet.</p>
      )}
      <p className="legend-note">Unreported actions appear as “Action not reported.”</p>
    </div>
  );
}