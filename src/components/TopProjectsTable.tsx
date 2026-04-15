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
            Largest and most complex projects filed in the last 12 months
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
      <div className="space-y-3">
        {filtered.map((p, i) => (
          <div
            key={p.projectId}
            className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-8 shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-white">{p.projectName}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{p.applicant}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">{p.borough}</span>
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {p.actionCount} {p.actionCount === 1 ? "action" : "actions"}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                p.status === "Complete" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                p.status === "Terminated" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}>
                {p.status}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500">
            No projects match this filter
          </div>
        )}
      </div>
    </div>
  );
}