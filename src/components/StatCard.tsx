"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export default function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}