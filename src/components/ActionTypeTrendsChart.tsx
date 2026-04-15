"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface ActionTypeTrendsProps {
  data: { action: string; monthly: { label: string; count: number }[] }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ActionTypeTrendsChart({ data }: ActionTypeTrendsProps) {
  // Merge all monthly data into unified timeline
  const allLabels = new Set<string>();
  data.forEach((d) => d.monthly.forEach((m) => allLabels.add(m.label)));
  const sortedLabels = [...allLabels].sort();

  const merged = sortedLabels.slice(-36).map((label) => {
    const row: Record<string, string | number> = { label };
    data.forEach((d) => {
      const found = d.monthly.find((m) => m.label === label);
      row[d.action] = found ? found.count : 0;
    });
    return row;
  });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Filing Trends by Action Type
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Top action types filed over time — what the market is pursuing
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Legend />
          {data.map((d, i) => (
            <Line
              key={d.action}
              type="monotone"
              dataKey={d.action}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}