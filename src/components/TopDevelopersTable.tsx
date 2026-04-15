"use client";

import { useState } from "react";
import { TopDeveloper } from "@/lib/zap-leaders";

interface TopDevelopersTableProps {
  privateData: TopDeveloper[];
  publicData: TopDeveloper[];
}

export default function TopDevelopersTable({ privateData, publicData }: TopDevelopersTableProps) {
  const [sector, setSector] = useState<"private" | "public">("private");
  const data = sector === "private" ? privateData : publicData;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            Top {sector === "private" ? "Private" : "Public"} Developers
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Most active {sector} applicants by project count
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <button
            onClick={() => setSector("private")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              sector === "private"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Private
          </button>
          <button
            onClick={() => setSector("public")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              sector === "public"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Public
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">#</th>
              <th className="text-left py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">Applicant</th>
              <th className="text-right py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">Projects</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Boroughs</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.name} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <td className="py-2.5 pr-4 text-slate-400">{i + 1}</td>
                <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">{d.name}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-blue-600 dark:text-blue-400 font-semibold">{d.projectCount}</td>
                <td className="py-2.5 text-slate-500 dark:text-slate-400 text-xs">{d.boroughs.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}