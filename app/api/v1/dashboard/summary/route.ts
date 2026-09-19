import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/rbac";
import { getDashboardSummary } from "@/services/DashboardService";

export async function GET() {
  try {
    // Read-only overview — any authenticated role, same convention as
    // every other GET endpoint since PHASE 5 (Bendahara operates, Yayasan
    // monitors, Admin oversees).
    const session = await requireSession();
    const summary = await getDashboardSummary(session);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
