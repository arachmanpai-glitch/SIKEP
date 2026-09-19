import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/FinancialPeriodRepository", () => ({
  createPeriod: vi.fn(),
  findClosedPeriodCoveringDate: vi.fn(),
  findOverlappingPeriod: vi.fn(),
  findPeriodById: vi.fn(),
  listPeriods: vi.fn(),
  markPeriodClosed: vi.fn(),
}));
vi.mock("@/repositories/DashboardRepository", () => ({
  listActiveFinancialAccounts: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/LedgerService", () => ({ getAccountBalanceWithRetry: vi.fn() }));

import { Prisma } from "@prisma/client";

import {
  ConflictError,
  FinancialIntegrityError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { listActiveFinancialAccounts } from "@/repositories/DashboardRepository";
import {
  createPeriod,
  findClosedPeriodCoveringDate,
  findOverlappingPeriod,
  findPeriodById,
  markPeriodClosed,
} from "@/repositories/FinancialPeriodRepository";
import {
  assertPeriodOpenForDate,
  closeFinancialPeriod,
  createFinancialPeriod,
} from "@/services/FinancialPeriodService";
import { getAccountBalanceWithRetry } from "@/services/LedgerService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

describe("services/FinancialPeriodService.assertPeriodOpenForDate", () => {
  beforeEach(() => {
    vi.mocked(findClosedPeriodCoveringDate).mockReset();
  });

  it("does nothing when no closed period covers the date", async () => {
    vi.mocked(findClosedPeriodCoveringDate).mockResolvedValue(null);
    await expect(
      assertPeriodOpenForDate({} as never, "school-a", new Date("2026-01-15")),
    ).resolves.toBeUndefined();
  });

  it("throws FinancialIntegrityError when a closed period covers the date", async () => {
    vi.mocked(findClosedPeriodCoveringDate).mockResolvedValue({
      id: "period-1",
      name: "Januari 2026",
    } as never);

    await expect(
      assertPeriodOpenForDate({} as never, "school-a", new Date("2026-01-15")),
    ).rejects.toBeInstanceOf(FinancialIntegrityError);
  });
});

describe("services/FinancialPeriodService.createFinancialPeriod", () => {
  beforeEach(() => {
    vi.mocked(findOverlappingPeriod).mockReset().mockResolvedValue(null);
    vi.mocked(createPeriod)
      .mockReset()
      .mockResolvedValue({ id: "period-1", name: "Januari 2026" } as never);
  });

  it("throws ConflictError when the date range overlaps an existing period", async () => {
    vi.mocked(findOverlappingPeriod).mockResolvedValue({
      id: "period-existing",
      name: "Januari 2026",
    } as never);

    await expect(
      createFinancialPeriod(SESSION, {
        name: "Jan 2026 (dupe)",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(createPeriod).not.toHaveBeenCalled();
  });

  it("creates the period when there's no overlap", async () => {
    const result = await createFinancialPeriod(SESSION, {
      name: "Januari 2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    });
    expect(result).toEqual({ id: "period-1", name: "Januari 2026" });
  });
});

describe("services/FinancialPeriodService.closeFinancialPeriod", () => {
  beforeEach(() => {
    vi.mocked(findPeriodById)
      .mockReset()
      .mockResolvedValue({ id: "period-1", status: "OPEN" } as never);
    vi.mocked(listActiveFinancialAccounts)
      .mockReset()
      .mockResolvedValue([{ id: "acc-1", name: "Kas Utama" } as never]);
    vi.mocked(getAccountBalanceWithRetry)
      .mockReset()
      .mockResolvedValue(new Prisma.Decimal("1000000.00"));
    vi.mocked(markPeriodClosed)
      .mockReset()
      .mockResolvedValue({ id: "period-1", status: "CLOSED" } as never);
  });

  it("throws NotFoundError for a nonexistent period", async () => {
    vi.mocked(findPeriodById).mockResolvedValue(null);
    await expect(closeFinancialPeriod(SESSION, "ghost", { balances: [] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ConflictError when the period is already CLOSED", async () => {
    vi.mocked(findPeriodById).mockResolvedValue({ id: "period-1", status: "CLOSED" } as never);
    await expect(
      closeFinancialPeriod(SESSION, "period-1", {
        balances: [{ financialAccountId: "acc-1", actualBalance: "1000000.00" }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ValidationError when an active account's actual balance is missing", async () => {
    await expect(
      closeFinancialPeriod(SESSION, "period-1", { balances: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when a balance references an unknown/inactive account", async () => {
    await expect(
      closeFinancialPeriod(SESSION, "period-1", {
        balances: [
          { financialAccountId: "acc-1", actualBalance: "1000000.00" },
          { financialAccountId: "acc-unknown", actualBalance: "0.00" },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("computes the reconciliation difference and closes the period", async () => {
    const result = await closeFinancialPeriod(SESSION, "period-1", {
      balances: [{ financialAccountId: "acc-1", actualBalance: "950000.00" }],
    });

    expect(result.reconciliation).toEqual([
      {
        financialAccountId: "acc-1",
        financialAccountName: "Kas Utama",
        systemBalance: "1000000",
        actualBalance: "950000",
        difference: "-50000",
      },
    ]);
    expect(markPeriodClosed).toHaveBeenCalledWith("school-a", "period-1", "u1");
  });

  it("throws ConflictError when another request closes the period concurrently", async () => {
    vi.mocked(markPeriodClosed).mockRejectedValue(new Error("P2025"));

    await expect(
      closeFinancialPeriod(SESSION, "period-1", {
        balances: [{ financialAccountId: "acc-1", actualBalance: "1000000.00" }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
