import { z } from "zod";

export const REPORT_EXPORT_FORMATS = ["pdf", "xlsx"] as const;
export const reportExportFormatSchema = z.enum(REPORT_EXPORT_FORMATS);
export type ReportExportFormat = z.infer<typeof reportExportFormatSchema>;

/** `to` is exclusive at the service layer (see ReportService) — this schema
 * takes the inclusive last-day-wanted from the client and the route layer
 * advances it by one day before calling the service, so API consumers don't
 * need to think about the exclusive boundary. */
export const financialReportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const billingReportQuerySchema = z.object({
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "VOIDED"]).optional(),
});
