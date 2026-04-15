"use client";

import { useState } from "react";
import { TopProject } from "@/lib/zap-leaders";

interface TopProjectsTableProps {
  data: TopProject[];
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "complete", label: "Complete" },
  { key: "terminated", label: "Terminated" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export default function TopProjectsTable({ data }: TopProjectsTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = statusFilter === "all"
    ? data
    : data.filter((p) => p.status.toLowerCase() === statusFilter);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            Top Projects by Magnitude
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Largest and most complex projects ranked by action count, size, and recency
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">#</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">Project</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">Applicant</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">Borough</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">Actions</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.projectId} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <td className="py-2.5 pr-3 text-slate-400">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-slate-900 dark:text-white">{p.projectName}</div>
                  {p.brief && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{p.brief.slice(0, 120)}…</div>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{p.applicant}</td>
                <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">{p.borough}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{p.actionCount}</td>
                <td className="py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === "Complete" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    p.status === "Terminated" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                  No projects match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}