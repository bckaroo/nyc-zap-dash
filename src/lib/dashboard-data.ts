import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DashboardPayload } from "./dashboard-analytics";

const DASHBOARD_DATA_PATH = path.join(process.cwd(), "data", "public-dashboard-data.json");

export async function loadDashboardPayload(): Promise<DashboardPayload> {
  const raw = await readFile(DASHBOARD_DATA_PATH, "utf8");
  const payload = JSON.parse(raw) as DashboardPayload;
  if (!Array.isArray(payload.records) || payload.record_count !== payload.records.length) {
    throw new Error("Invalid public dashboard export: record count does not match records");
  }
  if (!payload.generated_at || !payload.collected_through || !payload.source?.url) {
    throw new Error("Invalid public dashboard export: required metadata is missing");
  }
  return payload;
}
