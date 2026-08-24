const DATA_URL = "../public-dashboard-data.json";

const state = {
  records: [],
  filtered: [],
};

const elements = {
  generatedAt: document.querySelector("#generatedAt"),
  totalRecords: document.querySelector("#totalRecords"),
  activeStatuses: document.querySelector("#activeStatuses"),
  latestMilestone: document.querySelector("#latestMilestone"),
  floodCount: document.querySelector("#floodCount"),
  boroughCount: document.querySelector("#boroughCount"),
  boroughBreakdown: document.querySelector("#boroughBreakdown"),
  statusBreakdown: document.querySelector("#statusBreakdown"),
  resultCount: document.querySelector("#resultCount"),
  tbody: document.querySelector("#applicationsBody"),
  emptyState: document.querySelector("#emptyState"),
  boroughFilter: document.querySelector("#boroughFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  districtFilter: document.querySelector("#districtFilter"),
  applicantFilter: document.querySelector("#applicantFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  floodFilter: document.querySelector("#floodFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  drawer: document.querySelector("#detailDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  closeDrawer: document.querySelector("#closeDrawer"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerSubtitle: document.querySelector("#drawerSubtitle"),
  drawerBrief: document.querySelector("#drawerBrief"),
  drawerGrid: document.querySelector("#drawerGrid"),
  drawerZapLink: document.querySelector("#drawerZapLink"),
};

const formatDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const escapeText = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const display = (value) => value || "Unknown";

const statusClass = (status) => {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("review")) return "review";
  if (normalized.includes("filed")) return "filed";
  if (normalized.includes("noticed")) return "noticed";
  return "";
};

const uniqueSorted = (field) =>
  [...new Set(state.records.map((record) => record[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

function fillSelect(select, values, label) {
  select.innerHTML = `<option value="">${label}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderBars(target, rows) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  target.innerHTML = rows
    .map(
      (row) => `
        <div class="bar-row">
          <span>${escapeText(row.name)}</span>
          <div class="bar" aria-hidden="true"><span class="bar-fill" style="width:${(row.count / max) * 100}%"></span></div>
          <strong>${row.count}</strong>
        </div>
      `
    )
    .join("");
}

function renderMetrics(data) {
  elements.generatedAt.textContent = `Data export: ${formatDate(data.meta.generated_at)}`;
  elements.totalRecords.textContent = data.summary.total_records;
  elements.activeStatuses.textContent = data.summary.status_count;
  elements.latestMilestone.textContent = formatDate(data.summary.latest_milestone_date);
  elements.floodCount.textContent = data.summary.flood_zone_flagged_count;
  elements.boroughCount.textContent = data.summary.borough_count;
  renderBars(elements.boroughBreakdown, data.summary.by_borough);
  renderBars(elements.statusBreakdown, data.summary.by_status);
}

function recordMatches(record) {
  const borough = elements.boroughFilter.value;
  const status = elements.statusFilter.value;
  const district = elements.districtFilter.value.trim().toLowerCase();
  const applicant = elements.applicantFilter.value.trim().toLowerCase();
  const search = elements.searchFilter.value.trim().toLowerCase();

  if (borough && record.borough !== borough) return false;
  if (status && record.public_status !== status) return false;
  if (elements.floodFilter.checked && !record.flood_zone_any) return false;
  if (district && !(record.community_district || "").toLowerCase().includes(district)) return false;
  if (applicant && !(record.primary_applicant || "").toLowerCase().includes(applicant)) return false;
  if (search) {
    const haystack = [
      record.project_name,
      record.project_brief,
      record.project_id,
      record.ceqr_number,
      record.primary_applicant,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

function renderTable() {
  state.filtered = state.records.filter(recordMatches);
  elements.resultCount.textContent = `${state.filtered.length} of ${state.records.length} applications`;
  elements.emptyState.hidden = state.filtered.length > 0;

  elements.tbody.innerHTML = state.filtered
    .map(
      (record) => `
        <tr data-id="${escapeText(record.id)}">
          <td class="project-cell">
            <strong>${escapeText(display(record.project_name))}</strong>
            <span>${escapeText(display(record.project_brief))}</span>
          </td>
          <td>${escapeText(display(record.borough))}</td>
          <td>${escapeText(display(record.community_district))}</td>
          <td><span class="pill ${statusClass(record.public_status)}">${escapeText(display(record.public_status))}</span></td>
          <td>${formatDate(record.milestone_date)}</td>
          <td>${escapeText(display(record.primary_applicant))}</td>
          <td>${escapeText(display(record.ceqr_number))}<br><span class="muted">${escapeText(display(record.ceqr_type))}</span></td>
          <td>${record.flood_zone_a ? '<span class="flag">A</span>' : "-"} / ${record.flood_zone_shadedx ? '<span class="flag">Shaded X</span>' : "-"}</td>
          <td><a href="${escapeText(record.official_zap_url)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">ZAP</a></td>
        </tr>
      `
    )
    .join("");
}

function openDrawer(record) {
  elements.drawerTitle.textContent = display(record.project_name);
  elements.drawerSubtitle.textContent = `${display(record.borough)} ${display(record.community_district)} | ${display(record.public_status)}`;
  elements.drawerBrief.textContent = display(record.project_brief);
  elements.drawerZapLink.href = record.official_zap_url;

  const details = [
    ["Project ID", record.project_id],
    ["Applicant", record.primary_applicant],
    ["Applicant Type", record.applicant_type],
    ["Action Type", record.ulurp_non],
    ["CEQR Number", record.ceqr_number],
    ["CEQR Type", record.ceqr_type],
    ["EAS/EIS", record.eas_eis],
    ["Milestone Date", formatDate(record.milestone_date)],
    ["Certified/Referred", formatDate(record.certified_referred)],
    ["First Seen", formatDate(record.first_seen_date)],
    ["Last Updated", formatDate(record.last_updated_date)],
    ["Flood Zone", record.flood_zone_any ? `${record.flood_zone_a ? "A" : ""}${record.flood_zone_a && record.flood_zone_shadedx ? " and " : ""}${record.flood_zone_shadedx ? "Shaded X" : ""}` : "No flag"],
  ];

  elements.drawerGrid.innerHTML = details
    .map(
      ([label, value]) => `
        <div class="detail-item">
          <span>${escapeText(label)}</span>
          <strong>${escapeText(display(value))}</strong>
        </div>
      `
    )
    .join("");

  elements.drawer.classList.add("open");
  elements.drawerBackdrop.classList.add("open");
  elements.closeDrawer.focus();
}

function closeDrawer() {
  elements.drawer.classList.remove("open");
  elements.drawerBackdrop.classList.remove("open");
}

function attachEvents() {
  [
    elements.boroughFilter,
    elements.statusFilter,
    elements.districtFilter,
    elements.applicantFilter,
    elements.searchFilter,
    elements.floodFilter,
  ].forEach((input) => input.addEventListener("input", renderTable));

  elements.resetFilters.addEventListener("click", () => {
    elements.boroughFilter.value = "";
    elements.statusFilter.value = "";
    elements.districtFilter.value = "";
    elements.applicantFilter.value = "";
    elements.searchFilter.value = "";
    elements.floodFilter.checked = false;
    renderTable();
  });

  elements.tbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    const record = state.records.find((candidate) => candidate.id === row.dataset.id);
    if (record) openDrawer(record);
  });

  elements.closeDrawer.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
}

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
  const data = await response.json();

  state.records = data.records;
  fillSelect(elements.boroughFilter, uniqueSorted("borough"), "All boroughs");
  fillSelect(elements.statusFilter, uniqueSorted("public_status"), "All statuses");
  renderMetrics(data);
  renderTable();
  attachEvents();
}

init().catch((error) => {
  elements.emptyState.hidden = false;
  elements.emptyState.textContent = `Dashboard data could not be loaded: ${error.message}`;
});
