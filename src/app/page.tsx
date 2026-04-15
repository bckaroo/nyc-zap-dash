import { fetchProjects, groupByMonth, groupByBorough, groupByStatus, groupByApplicantType } from "@/lib/zap";
import {
  computePipeline,
  groupByActionType,
  actionTypeTrends,
  computeHotspots,
  recentHotspots,
  computeMIH,
  computeOutcomes,
  cycleComparison,
} from "@/lib/zap-extended";
import StatCard from "@/components/StatCard";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import BoroughChart from "@/components/BoroughChart";
import StatusChart from "@/components/StatusChart";
import ApplicantTypeChart from "@/components/ApplicantTypeChart";
import PipelineChart from "@/components/PipelineChart";
import ActionTypeTrendsChart from "@/components/ActionTypeTrendsChart";
import HotspotChart from "@/components/HotspotChart";
import MIHChart from "@/components/MIHChart";
import OutcomeChart from "@/components/OutcomeChart";
import CycleComparisonChart from "@/components/CycleComparisonChart";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function Dashboard() {
  const projects = await fetchProjects();

  const total = projects.length;
  const active = projects.filter((p) => p.public_status === "Active").length;
  const completed = projects.filter((p) => p.public_status === "Completed").length;
  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const recentFilings = projects.filter((p) => {
    if (!p.app_filed_date) return false;
    return new Date(p.app_filed_date) >= yearAgo;
  }).length;

  // Core charts
  const filingsByMonth = groupByMonth(projects, "app_filed_date");
  const certificationsByMonth = groupByMonth(projects, "certified_referred");
  const boroughData = groupByBorough(projects);
  const statusData = groupByStatus(projects);
  const applicantData = groupByApplicantType(projects);

  // Extended analytics
  const pipeline = computePipeline(projects);
  const actionTrends = actionTypeTrends(projects, 6);
  const hotspots = computeHotspots(projects);
  const recentHots = recentHotspots(projects);
  const mihData = computeMIH(projects);
  const outcomes = computeOutcomes(projects);
  const cycle = cycleComparison(projects);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">ZapDash</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            NYC Zoning Application Portal — Permitting Trends & CEQR Intelligence
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Data: NYC OpenData (hgx4-8ukb) · {total.toLocaleString()} projects · Last refreshed: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Projects" value={total.toLocaleString()} subtitle="All time" />
          <StatCard title="Active Projects" value={active.toLocaleString()} subtitle="Currently in review" />
          <StatCard title="Completed" value={completed.toLocaleString()} subtitle="Approved, withdrawn, or terminated" />
          <StatCard title="Filings (Last 12mo)" value={recentFilings.toLocaleString()} subtitle="Applications filed" />
        </div>

        {/* ─── CEQR Intelligence Section ─── */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">CEQR Intelligence</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pipeline velocity, outcomes, and cycle analysis</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PipelineChart data={pipeline} />
          <CycleComparisonChart
            thisYear={cycle.thisYear}
            lastYear={cycle.lastYear}
            fiveYearAvg={cycle.fiveYearAvg}
            monthly={cycle.monthly}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <OutcomeChart data={outcomes} />
          <TimeSeriesChart data={certificationsByMonth} title="Certifications / Referrals Over Time" />
        </div>

        {/* ─── Market Trends Section ─── */}
        <div className="mb-4 mt-12">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Market Trends</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">What the market is pursuing and where</p>
        </div>

        <div className="mb-8">
          <ActionTypeTrendsChart data={actionTrends} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TimeSeriesChart data={filingsByMonth} title="Application Filings Over Time" />
          <BoroughChart data={boroughData} title="Projects by Borough" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <HotspotChart data={hotspots} title="All-Time Hotspots" />
          <HotspotChart data={recentHots} title="Recent Hotspots (12mo)" />
        </div>

        {/* ─── MIH Section ─── */}
        <div className="mb-4 mt-12">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">MIH Tracker</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mandatory Inclusionary Housing trends</p>
        </div>

        <div className="mb-8">
          <MIHChart data={mihData} />
        </div>

        {/* ─── Breakdowns Section ─── */}
        <div className="mb-4 mt-12">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Breakdowns</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Status, applicant type, and more</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <StatusChart data={statusData} title="Projects by Status" />
          <ApplicantTypeChart data={applicantData} title="Projects by Applicant Type" />
        </div>
      </div>
    </main>
  );
}