import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { renderBillingReportPdf } from "@/lib/reports/pdf";
import { renderBillingReportXlsx } from "@/lib/reports/xlsx";
import { requireSession } from "@/lib/rbac";
import { billingReportQuerySchema, reportExportFormatSchema } from "@/lib/validation/report";
import { recordAudit } from "@/services/AuditService";
import { getBillingReport } from "@/services/ReportService";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/** See docs/decisions.md D50 — the EXPORT audit write on a GET route is a
 * deliberate, scoped exception (audit_logs only, never domain data). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const params = request.nextUrl.searchParams;

    const formatParsed = reportExportFormatSchema.safeParse(params.get("format"));
    if (!formatParsed.success) {
      throw new ValidationError('Format harus "pdf" atau "xlsx".');
    }

    const queryParsed = billingReportQuerySchema.safeParse({
      academicYearId: params.get("academicYearId") ?? undefined,
      classId: params.get("classId") ?? undefined,
      status: params.get("status") ?? undefined,
    });
    if (!queryParsed.success) {
      throw new ValidationError("Filter laporan tidak valid.", queryParsed.error.flatten());
    }

    const report = await getBillingReport(session, queryParsed.data);

    const format = formatParsed.data;
    const buffer =
      format === "pdf"
        ? await renderBillingReportPdf(report)
        : await renderBillingReportXlsx(report);

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "EXPORT",
      entityType: "BillingReport",
      newValues: { filter: queryParsed.data, format, rowCount: report.rows.length },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="laporan-tagihan-santri.${format}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
