"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface CycleComparisonProps {
  thisYear: number;
  lastYear: number;
  fiveYearAvg: number;
  monthly: { label: string; thisYear: number; lastYear: number; avg5y: number }[];
}

export default function CycleComparisonChart({ thisYear, lastYear, fiveYearAvg, monthly }: CycleComparisonProps) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const data = monthly.map((m) => ({
    ...m,
    label: monthNames[parseInt(m.label) - 1] || m.label,
  }));

  const yoyChange = lastYear > 0 ? Math.round(((thisYear - lastYear) / lastYear) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Cycle Comparison
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        This year vs last year vs 5-year average — is the market heating up?
      </p>
      <div className="flex gap-6 mb-4">
        <div>
          <p className="text-xs text-slate-500">This Year</p>
          <p className="text-xl font-bold text-blue-500">{thisYear.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Last Year</p>
          <p className="text-xl font-bold text-emerald-500">{lastYear.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">5yr Avg</p>
          <p className="text-xl font-bold text-amber-500">{fiveYearAvg.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">YoY Change</p>
          <p className={`text-xl font-bold ${yoyChange >= 0 ? "text-green-500" : "text-red-500"}`}>
            {yoyChange >= 0 ? "+" : ""}{yoyChange}%
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="thisYear" stroke="#3b82f6" strokeWidth={2} name="This Year" />
          <Line type="monotone" dataKey="lastYear" stroke="#10b981" strokeWidth={2} name="Last Year" />
          <Line type="monotone" dataKey="avg5y" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="5yr Avg" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}