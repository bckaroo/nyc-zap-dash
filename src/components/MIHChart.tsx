"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface MIHChartProps {
  data: {
    year: string;
    total: number;
    option1: number;
    option2: number;
    workforce: number;
    deepAffordability: number;
  }[];
}

export default function MIHChart({ data }: MIHChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        MIH Tracker
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Mandatory Inclusionary Housing projects by year and option type
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Legend />
          <Bar dataKey="option1" stackId="a" fill="#3b82f6" name="Option 1" />
          <Bar dataKey="option2" stackId="a" fill="#10b981" name="Option 2" />
          <Bar dataKey="workforce" stackId="a" fill="#f59e0b" name="Workforce" />
          <Bar dataKey="deepAffordability" stackId="a" fill="#ef4444" name="Deep Affordability" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}