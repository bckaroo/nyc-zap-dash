import DashboardExplorer from "@/components/DashboardExplorer";
import { loadDashboardPayload } from "@/lib/dashboard-data";

export const dynamic = "force-static";

export default async function DashboardPage() {
  const payload = await loadDashboardPayload();
  return <DashboardExplorer payload={payload} />;
}
