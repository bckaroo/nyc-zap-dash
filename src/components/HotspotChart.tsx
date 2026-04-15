"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface HotspotChartProps {
  data: { borough: string; community_district: string; count: number }[];
  title: string;
}

export default function HotspotChart({ data, title }: HotspotChartProps) {
  const chartData = data.slice(0, 15).map((d) => ({
    label: `${d.community_district} (${d.borough.slice(0, 1)})`,
    count: d.count,
  }));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Community districts with the most activity
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}