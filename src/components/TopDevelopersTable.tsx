"use client";

import { TopDeveloper } from "@/lib/zap-leaders";

interface TopDevelopersTableProps {
  data: TopDeveloper[];
}

export default function TopDevelopersTable({ data }: TopDevelopersTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Top Private Developers
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Most active private applicants by project count (excludes public agencies)
      </p>
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