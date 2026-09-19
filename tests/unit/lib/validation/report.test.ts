import { describe, expect, it } from "vitest";

import {
  billingReportQuerySchema,
  financialReportQuerySchema,
  reportExportFormatSchema,
} from "@/lib/validation/report";

describe("lib/validation/report", () => {
  describe("financialReportQuerySchema", () => {
    it("accepts ISO date strings", () => {
      const result = financialReportQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-31" });
      expect(result.success).toBe(true);
    });

    it("rejects a non-date value", () => {
      const result = financialReportQuerySchema.safeParse({ from: "not-a-date", to: "2026-01-31" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing field", () => {
      const result = financialReportQuerySchema.safeParse({ from: "2026-01-01" });
      expect(result.success).toBe(false);
    });
  });

  describe("billingReportQuerySchema", () => {
    it("accepts an empty filter (all optional)", () => {
      const result = billingReportQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects a non-UUID academicYearId", () => {
      const result = billingReportQuerySchema.safeParse({ academicYearId: "not-a-uuid" });
      expect(result.success).toBe(false);
    });

    it("rejects an unknown status value", () => {
      const result = billingReportQuerySchema.safeParse({ status: "SOMETHING_ELSE" });
      expect(result.success).toBe(false);
    });
  });

  describe("reportExportFormatSchema", () => {
    it("accepts pdf and xlsx", () => {
      expect(reportExportFormatSchema.safeParse("pdf").success).toBe(true);
      expect(reportExportFormatSchema.safeParse("xlsx").success).toBe(true);
    });

    it("rejects any other format", () => {
      expect(reportExportFormatSchema.safeParse("csv").success).toBe(false);
      expect(reportExportFormatSchema.safeParse(null).success).toBe(false);
    });
  });
});
