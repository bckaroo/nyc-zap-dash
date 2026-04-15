"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StatusChartProps {
  data: { status: string; count: number }[];
  title: string;
}

export default function StatusChart({ data, title }: StatusChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey="status" type="category" tick={{ fontSize: 12 }} width={120} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}