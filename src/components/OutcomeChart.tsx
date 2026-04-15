"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface OutcomeChartProps {
  data: { action: string; completed: number; terminated: number; total: number; successRate: number }[];
}

export default function OutcomeChart({ data }: OutcomeChartProps) {
  const chartData = data.slice(0, 12).map((d) => ({
    action: d.action,
    completed: d.completed,
    terminated: d.terminated,
    successRate: d.successRate,
  }));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Success / Failure Rates by Action Type
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Completed vs terminated projects — helps set realistic expectations
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey="action" type="category" tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
            formatter={(value, name) => [value, name]}
          />
          <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
          <Bar dataKey="terminated" stackId="a" fill="#ef4444" name="Terminated" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}