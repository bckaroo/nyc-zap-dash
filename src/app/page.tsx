import { fetchProjects, groupByMonth, groupByBorough, groupByStatus, groupByApplicantType } from "@/lib/zap";
import StatCard from "@/components/StatCard";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import BoroughChart from "@/components/BoroughChart";
import StatusChart from "@/components/StatusChart";
import ApplicantTypeChart from "@/components/ApplicantTypeChart";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // refresh data hourly

export default async function Dashboard() {
  const projects = await fetchProjects();
  const total = projects.length;
  const active = projects.filter((p) => p.public_status === "Active").length;
  const completed = projects.filter((p) => p.public_status === "Completed").length;

  // Recent filings (last 12 months)
  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const recentFilings = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    const d = new Date(p.app_filed_date);
    return d >= yearAgo;
  }).length;

  const filingsByMonth = groupByMonth(projects, "app_filed_date");
  const certificationsByMonth = groupByMonth(projects, "certified_referred");
  const boroughData = groupByBorough(projects);
  const statusData = groupByStatus(projects);
  const applicantData = groupByApplicantType(projects);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            ZapDash
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            NYC Zoning Application Portal — Permitting Trends Dashboard
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Data: NYC OpenData (hgx4-8ukb) · Last refreshed: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Projects" value={total.toLocaleString()} subtitle="All time" />
          <StatCard title="Active Projects" value={active.toLocaleString()} subtitle="Currently in review" />
          <StatCard title="Completed Projects" value={completed.toLocaleString()} subtitle="Approved, withdrawn, or terminated" />
          <StatCard title="Filings (Last 12mo)" value={recentFilings.toLocaleString()} subtitle="Applications filed" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TimeSeriesChart data={filingsByMonth} title="Applications Filed Over Time" />
          <TimeSeriesChart data={certificationsByMonth} title="Certifications / Referrals Over Time" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BoroughChart data={boroughData} title="Projects by Borough" />
          <StatusChart data={statusData} title="Projects by Status" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ApplicantTypeChart data={applicantData} title="Projects by Applicant Type" />
          {/* Placeholder for future: MIH trends, ULURP vs Non-ULURP, CD breakdown */}
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 flex items-center justify-center text-slate-400 dark:text-slate-500">
            More charts coming soon — MIH trends, ULURP breakdown, Community District drill-down
          </div>
        </div>
      </div>
    </main>
  );
}