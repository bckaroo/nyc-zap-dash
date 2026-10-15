"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface PipelineChartProps {
  data: { stage: string; count: number; medianDays?: number }[];
}

export default function PipelineChart({ data }: PipelineChartProps) {
  const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Pipeline Velocity
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        How many projects reach each stage, and median days between key milestones
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
            formatter={(value, name, props) => {
              const d = props.payload;
              if (d.medianDays !== undefined) {
                return [`${value} projects · median ${d.medianDays}d`, "Stage"];
              }
              return [`${value} projects`, "Stage"];
            }}
          />
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
          <Bar dataKey="count" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}