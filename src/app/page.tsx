import { fetchProjects, groupByMonth, groupByBorough, groupByStatus, groupByApplicantType } from "@/lib/zap";
import {
  computePipeline,
  actionTypeTrends,
  computeHotspots,
  recentHotspots,
  computeMIH,
  computeOutcomes,
  cycleComparison,
} from "@/lib/zap-extended";
import {
  pipelineInsight,
  cycleInsight,
  outcomeInsight,
  actionTrendInsight,
  hotspotInsight,
  mihInsight,
  filingsInsight,
  boroughInsight,
  statusInsight,
  applicantInsight,
} from "@/lib/zap-insights";
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
import InsightBlurb from "@/components/InsightBlurb";

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

  const filingsByMonth = groupByMonth(projects, "app_filed_date");
  const certificationsByMonth = groupByMonth(projects, "certified_referred");
  const boroughData = groupByBorough(projects);
  const statusData = groupByStatus(projects);
  const applicantData = groupByApplicantType(projects);

  const pipeline = computePipeline(projects);
  const actionTrends = actionTypeTrends(projects, 6);
  const hotspots = computeHotspots(projects);
  const recentHots = recentHotspots(projects);
  const mihData = computeMIH(projects);
  const outcomes = computeOutcomes(projects);
  const cycle = cycleComparison(projects);

  const pipelineText = pipelineInsight(pipeline);
  const cycleText = cycleInsight(cycle.thisYear, cycle.lastYear, cycle.fiveYearAvg);
  const outcomeText = outcomeInsight(outcomes);
  const actionTrendText = actionTrendInsight(actionTrends);
  const hotspotText = hotspotInsight(hotspots, recentHots);
  const mihText = mihInsight(mihData);
  const filingsText = filingsInsight(filingsByMonth);
  const boroughText = boroughInsight(boroughData);
  const statusText = statusInsight(statusData);
  const applicantText = applicantInsight(applicantData);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">ZapDash</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            NYC Zoning Application Portal — Permitting Trends & CEQR Intelligence
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Data: NYC OpenData (hgx4-8ukb) · {total.toLocaleString()} projects · Last refreshed: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          <StatCard title="Total Projects" value={total.toLocaleString()} subtitle="All time" />
          <StatCard title="Active Projects" value={active.toLocaleString()} subtitle="Currently in review" />
          <StatCard title="Completed" value={completed.toLocaleString()} subtitle="Approved, withdrawn, or terminated" />
          <StatCard title="Filings (Last 12mo)" value={recentFilings.toLocaleString()} subtitle="Applications filed" />
        </div>

        {/* ─── CEQR Intelligence ─── */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-1">CEQR Intelligence</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Pipeline velocity, outcomes, and cycle analysis</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <PipelineChart data={pipeline} />
              <InsightBlurb text={pipelineText} />
            </div>
            <div>
              <CycleComparisonChart
                thisYear={cycle.thisYear}
                lastYear={cycle.lastYear}
                fiveYearAvg={cycle.fiveYearAvg}
                monthly={cycle.monthly}
              />
              <InsightBlurb text={cycleText} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <OutcomeChart data={outcomes} />
              <InsightBlurb text={outcomeText} />
            </div>
            <div>
              <TimeSeriesChart data={certificationsByMonth} title="Certifications / Referrals Over Time" />
            </div>
          </div>
        </section>

        {/* ─── Market Trends ─── */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-1">Market Trends</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">What the market is pursuing and where</p>

          <div className="mb-10">
            <ActionTypeTrendsChart data={actionTrends} />
            <InsightBlurb text={actionTrendText} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <TimeSeriesChart data={filingsByMonth} title="Application Filings Over Time" />
              <InsightBlurb text={filingsText} />
            </div>
            <div>
              <BoroughChart data={boroughData} title="Projects by Borough" />
              <InsightBlurb text={boroughText} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <HotspotChart data={hotspots} title="All-Time Hotspots" />
            </div>
            <div>
              <HotspotChart data={recentHots} title="Recent Hotspots (12mo)" />
              <InsightBlurb text={hotspotText} />
            </div>
          </div>
        </section>

        {/* ─── MIH Tracker ─── */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-1">MIH Tracker</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Mandatory Inclusionary Housing trends</p>

          <div>
            <MIHChart data={mihData} />
            <InsightBlurb text={mihText} />
          </div>
        </section>

        {/* ─── Breakdowns ─── */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-1">Breakdowns</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Status, applicant type, and more</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <StatusChart data={statusData} title="Projects by Status" />
              <InsightBlurb text={statusText} />
            </div>
            <div>
              <ApplicantTypeChart data={applicantData} title="Projects by Applicant Type" />
              <InsightBlurb text={applicantText} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}