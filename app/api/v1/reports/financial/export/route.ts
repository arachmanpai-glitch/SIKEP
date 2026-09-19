import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { renderFinancialReportPdf } from "@/lib/reports/pdf";
import { renderFinancialReportXlsx } from "@/lib/reports/xlsx";
import { requireSession } from "@/lib/rbac";
import { financialReportQuerySchema, reportExportFormatSchema } from "@/lib/validation/report";
import { recordAudit } from "@/services/AuditService";
import { getFinancialReport } from "@/services/ReportService";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const CONTENT_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/**
 * The one GET route in this codebase that has a side effect beyond reading
 * (an EXPORT audit_logs row, spec section 16) — a file download has no
 * sensible non-idempotent HTTP verb to sit behind, and the write is scoped
 * strictly to the immutable audit log, never to domain data. See
 * docs/decisions.md D50.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const params = request.nextUrl.searchParams;

    const formatParsed = reportExportFormatSchema.safeParse(params.get("format"));
    if (!formatParsed.success) {
      throw new ValidationError('Format harus "pdf" atau "xlsx".');
    }

    const queryParsed = financialReportQuerySchema.safeParse({
      from: params.get("from"),
      to: params.get("to"),
    });
    if (!queryParsed.success) {
      throw new ValidationError("Rentang tanggal tidak valid.", queryParsed.error.flatten());
    }

    const report = await getFinancialReport(session, {
      from: queryParsed.data.from,
      to: new Date(queryParsed.data.to.getTime() + ONE_DAY_MS),
    });

    const format = formatParsed.data;
    const buffer =
      format === "pdf"
        ? await renderFinancialReportPdf(report)
        : await renderFinancialReportXlsx(report);

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "EXPORT",
      entityType: "FinancialReport",
      newValues: { from: report.from, to: report.to, format },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="laporan-keuangan.${format}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
