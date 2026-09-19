import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { requireSession } from "@/lib/rbac";
import { financialReportQuerySchema } from "@/lib/validation/report";
import { getFinancialReport } from "@/services/ReportService";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();

    const parsed = financialReportQuerySchema.safeParse({
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
    });
    if (!parsed.success) {
      throw new ValidationError("Rentang tanggal tidak valid.", parsed.error.flatten());
    }

    // `to` in the query is the last inclusive day; the service takes an
    // exclusive upper bound (see lib/validation/report.ts).
    const report = await getFinancialReport(session, {
      from: parsed.data.from,
      to: new Date(parsed.data.to.getTime() + ONE_DAY_MS),
    });
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
