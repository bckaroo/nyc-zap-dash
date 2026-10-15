"use client";

import { useMemo, useState } from "react";

import {
  APPLICANT_CAVEAT,
  COVERAGE_DISCLOSURE,
  SOURCE_ATTRIBUTION,
  buildOverview,
  computeApplicantLeaderboard,
  filterApplications,
  selectWeeklyHighlights,
  type DashboardPayload,
} from "../lib/dashboard-analytics";
import GeographyMap from "./GeographyMap";

function formatDate(value: string): string {
  if (!value) return "Not reported";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function weeklyRangeLabel(collectedThrough: string): string {
  const end = new Date(`${collectedThrough.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return "Collection date not reported";
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const short = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${short.format(start)}–${short.format(end)}, ${end.getUTCFullYear()}`;
}

function stalenessLabel(collectedThrough: string, generatedAt: string): string {
  const collected = new Date(`${collectedThrough.slice(0, 10)}T00:00:00Z`);
  const generated = new Date(`${generatedAt.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(collected.getTime()) || Number.isNaN(generated.getTime())) return "";
  const days = Math.round((generated.getTime() - collected.getTime()) / 86_400_000);
  if (days <= 0) return "";
  return `Collection is ${days} day${days === 1 ? "" : "s"} behind this export`;
}

function applicantPanelId(name: string): string {
  return `applicant-projects-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export default function DashboardExplorer({ payload }: { payload: DashboardPayload }) {
  const [search, setSearch] = useState("");
  const [borough, setBorough] = useState("");
  const [communityDistrict, setCommunityDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [expandedApplicant, setExpandedApplicant] = useState<string | null>(null);

  const overview = useMemo(() => buildOverview(payload.records), [payload.records]);
  const boroughs = useMemo(
    () => sortedUnique(payload.records.map((record) => record.borough)),
    [payload.records],
  );
  const communityDistricts = useMemo(
    () =>
      sortedUnique(
        payload.records
          .filter((record) => !borough || record.borough === borough)
          .map((record) => record.community_district),
      ),
    [borough, payload.records],
  );
  const statuses = useMemo(
    () => sortedUnique(payload.records.map((record) => record.public_status)),
    [payload.records],
  );
  const filteredRecords = useMemo(
    () =>
      filterApplications(payload.records, {
        search,
        borough,
        communityDistrict,
        status,
      }),
    [borough, communityDistrict, payload.records, search, status],
  );
  const leaderboard = useMemo(
    () => computeApplicantLeaderboard(payload.records, payload.collected_through),
    [payload.collected_through, payload.records],
  );
  const weeklyHighlights = useMemo(
    () => selectWeeklyHighlights(payload.records, payload.collected_through),
    [payload.collected_through, payload.records],
  );
  const staleness = stalenessLabel(payload.collected_through, payload.generated_at);

  function handleBoroughChange(value: string) {
    setBorough(value);
    setCommunityDistrict("");
  }

  function clearFilters() {
    setSearch("");
    setBorough("");
    setCommunityDistrict("");
    setStatus("");
  }

  return (
    <main>
      <header className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">NYC land-use application activity</p>
            <h1>ZapDash</h1>
            <p className="hero-copy">
              A searchable view of discretionary land-use applications tracked through New York City&apos;s
              Zoning Application Portal.
            </p>
          </div>
          <div className="freshness-card" aria-label="Data freshness">
            <span>Data collected through</span>
            <strong>{formatDate(payload.collected_through)}</strong>
            <small>Export generated {formatDate(payload.generated_at)}</small>
            {staleness && <small className="staleness-note">{staleness}</small>}
            {payload.records.length === 0 && (
              <small className="empty-snapshot-note">No applications are available in this public snapshot.</small>
            )}
          </div>
        </div>
      </header>

      <div className="shell dashboard-stack">
        <aside className="notice" aria-label="Source and coverage disclosure">
          <p>
            <strong>Unofficial tracker.</strong> Verify project details and current status with NYC Planning.
          </p>
          <p>{COVERAGE_DISCLOSURE}</p>
          <p>
            {SOURCE_ATTRIBUTION}{" "}
            <a href={payload.source.url} target="_blank" rel="noreferrer">
              Open the official ZAP portal
            </a>
            .
          </p>
        </aside>

        <section aria-labelledby="overview-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow ink">Citywide overview</p>
              <h2 id="overview-heading">Tracked application snapshot</h2>
            </div>
            <p>{payload.record_count.toLocaleString()} records in this export</p>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Tracked applications</span>
              <strong>{overview.trackedApplications.toLocaleString()}</strong>
              <small>All records in the canonical local feed</small>
            </article>
            <article className="metric-card">
              <span>In public review</span>
              <strong>{overview.inPublicReview.toLocaleString()}</strong>
              <small>Source status at collection</small>
            </article>
            <article className="metric-card">
              <span>Boroughs represented</span>
              <strong>{overview.boroughsCovered}</strong>
              <small>Coverage, not completeness</small>
            </article>
            <article className="metric-card accent">
              <span>Latest recorded activity</span>
              <strong className="date-metric">{formatDate(overview.latestActivityDate)}</strong>
              <small>Latest supported activity date</small>
            </article>
          </div>
        </section>

        <section className="panel" aria-labelledby="current-filings-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow ink">Current filings · {weeklyRangeLabel(payload.collected_through)}</p>
              <h2 id="current-filings-heading">Current filings and weekly highlights</h2>
            </div>
            <p>{weeklyHighlights.length} records with activity in this seven-day window</p>
          </div>
          {weeklyHighlights.length ? (
            <ul className="weekly-highlights">
              {weeklyHighlights.map((record) => (
                <li key={record.id}>
                  <div>
                    <strong>{record.project_name || "Unnamed application"}</strong>
                    <span>{record.borough || "Location not reported"} · {record.public_status || "Status not reported"}</span>
                  </div>
                  <div>
                    <time dateTime={record.activity_date}>{formatDate(record.activity_date)}</time>
                    <a href={record.source_url} target="_blank" rel="noreferrer">Official record</a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No recorded application activity falls within this collection week.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="geography-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow ink">Geography</p>
              <h2 id="geography-heading">Borough and Community District activity</h2>
            </div>
            <p>Counts use this ZAP snapshot; boundary files provide cartographic reference only.</p>
          </div>
          <div className="filter-row geography-filters">
            <label>
              Borough
              <select value={borough} onChange={(event) => handleBoroughChange(event.target.value)}>
                <option value="">All boroughs</option>
                {boroughs.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Community District
              <select value={communityDistrict} onChange={(event) => setCommunityDistrict(event.target.value)}>
                <option value="">All districts</option>
                {communityDistricts.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <GeographyMap
            mapData={payload.map}
            borough={borough}
            communityDistrict={communityDistrict}
            collectedThrough={payload.collected_through}
          />
        </section>

        <section className="panel applicant-panel" aria-labelledby="applicants-heading">
          <div>
            <p className="eyebrow ink">Trailing 12 months</p>
            <h2 id="applicants-heading">{APPLICANT_CAVEAT.heading}</h2>
            <p className="caveat">{APPLICANT_CAVEAT.body}</p>
          </div>
          <ol className="leaderboard">
            {leaderboard.map((applicant, index) => {
              const panelId = applicantPanelId(applicant.name);
              const isExpanded = expandedApplicant === applicant.name;
              return (
              <li key={applicant.name} className={isExpanded ? "expanded" : undefined}>
                <button
                  type="button"
                  className="applicant-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => setExpandedApplicant(isExpanded ? null : applicant.name)}
                >
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="applicant-name">{applicant.name}</span>
                  <strong aria-label={`${applicant.applicationCount} applications`}>{applicant.applicationCount}</strong>
                  <span className="applicant-affordance" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-label={`Projects counted for ${applicant.name}`}
                  hidden={!isExpanded}
                  className="applicant-projects"
                >
                  <p>{applicant.applicationCount} project{applicant.applicationCount === 1 ? "" : "s"} counted in the trailing 12 months:</p>
                  <ul>
                    {applicant.projects.map((project) => (
                      <li key={project.id}>
                        <a href={project.source_url} target="_blank" rel="noreferrer noopener">
                          {project.project_name || "Unnamed application"}
                        </a>
                        <span>{project.project_id} · {formatDate(project.activity_date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              );
            })}
          </ol>
        </section>

        <section className="panel" aria-labelledby="applications-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow ink">Project finder</p>
              <h2 id="applications-heading">Applications</h2>
            </div>
            <p aria-live="polite">{filteredRecords.length.toLocaleString()} matching records</p>
          </div>

          <div className="filter-grid">
            <label className="search-field">
              Search project, brief, applicant, ID, or CEQR number
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applications"
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <button className="clear-button" type="button" onClick={clearFilters}>Clear filters</button>
          </div>

          <div className="application-list">
            <div className="application-head" aria-hidden="true">
              <span>Application</span>
              <span>Location</span>
              <span>Status</span>
              <span>Activity</span>
            </div>
            {filteredRecords.map((record) => (
              <details className="application-row" key={record.id}>
                <summary>
                  <span className="project-cell">
                    <span className="mobile-field-label">Application</span>
                    <strong>{record.project_name || "Unnamed application"}</strong>
                    <small>{record.primary_applicant || "Applicant not reported"}</small>
                  </span>
                  <span><span className="mobile-field-label">Location</span>{record.borough || "Not reported"}<small>{record.community_district || "CD not reported"}</small></span>
                  <span><span className="mobile-field-label">Status</span><span className="status-pill">{record.public_status || "Not reported"}</span></span>
                  <span><span className="mobile-field-label">Activity</span>{formatDate(record.activity_date)}<small>{record.project_id}</small></span>
                  <span className="expand-affordance">View details <span aria-hidden="true">+</span></span>
                </summary>
                <div className="application-detail">
                  <div className="brief-block">
                    <h3>Project detail</h3>
                    <p>{record.project_brief || "No project brief was reported in the source feed."}</p>
                  </div>
                  <dl>
                    <div><dt>Named applicant</dt><dd>{record.primary_applicant || "Not reported"}</dd></div>
                    <div><dt>Review type</dt><dd>{record.ulurp_non || "Not reported"}</dd></div>
                    <div><dt>CEQR</dt><dd>{record.ceqr_number || "Not reported"}</dd></div>
                    <div><dt>CEQR type / document</dt><dd>{[record.ceqr_type, record.eas_eis].filter(Boolean).join(" · ") || "Not reported"}</dd></div>
                    <div><dt>Latest milestone date</dt><dd>{formatDate(record.milestone_date)}</dd></div>
                    <div><dt>Certified / referred</dt><dd>{formatDate(record.certified_referred)}</dd></div>
                    <div><dt>Flood-zone flags</dt><dd>{record.flood_zone_a || record.flood_zone_shadedx ? [record.flood_zone_a ? "Zone A" : "", record.flood_zone_shadedx ? "Shaded X" : ""].filter(Boolean).join(", ") : "None reported"}</dd></div>
                  </dl>
                  <a className="source-button" href={record.source_url} target="_blank" rel="noreferrer">
                    Official ZAP record <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </details>
            ))}
            {!filteredRecords.length && <p className="empty-state">No applications match these filters.</p>}
          </div>
        </section>

        <footer>
          <p>ZapDash is an independent reference tool and is not an official City of New York product.</p>
          <p>Freshness reflects the local collection run, not continuous monitoring.</p>
        </footer>
      </div>
    </main>
  );
}
