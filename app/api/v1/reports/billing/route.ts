import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { requireSession } from "@/lib/rbac";
import { billingReportQuerySchema } from "@/lib/validation/report";
import { getBillingReport } from "@/services/ReportService";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const params = request.nextUrl.searchParams;
    const parsed = billingReportQuerySchema.safeParse({
      academicYearId: params.get("academicYearId") ?? undefined,
      classId: params.get("classId") ?? undefined,
      status: params.get("status") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Filter laporan tidak valid.", parsed.error.flatten());
    }

    const report = await getBillingReport(session, parsed.data);
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
