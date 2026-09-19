import type { SantriBill } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { mapPrismaError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import type { CreateBillInput, CreateBulkBillsInput } from "@/lib/validation/bill";
import { createBill, findBillById, listBillsForSchool } from "@/repositories/SantriBillRepository";
import { recordAudit } from "@/services/AuditService";

/** spec section 12: "tagihan individual" — one bill for one santri. */
export async function createBillForSantri(
  session: SessionPayload,
  input: CreateBillInput,
): Promise<SantriBill> {
  try {
    const bill = await prisma.$transaction(async (tx) => {
      const created = await createBill(tx, { schoolId: session.schoolId, ...input });
      await recordAudit({
        schoolId: session.schoolId,
        userId: session.userId,
        action: "CREATE",
        entityType: "SantriBill",
        entityId: created.id,
        newValues: created,
      });
      return created;
    });
    return bill;
  } catch (error) {
    throw mapPrismaError(error, "Tagihan Santri");
  }
}

/** spec section 12: "tagihan massal" — same bill applied to many santri
 * (e.g. a whole class) in one atomic batch. */
export async function createBulkBillsForSantri(
  session: SessionPayload,
  input: CreateBulkBillsInput,
): Promise<SantriBill[]> {
  const { santriIds, ...billFields } = input;

  try {
    return await prisma.$transaction(async (tx) => {
      const created: SantriBill[] = [];
      for (const santriId of santriIds) {
        const bill = await createBill(tx, { schoolId: session.schoolId, santriId, ...billFields });
        await recordAudit({
          schoolId: session.schoolId,
          userId: session.userId,
          action: "CREATE",
          entityType: "SantriBill",
          entityId: bill.id,
          newValues: bill,
        });
        created.push(bill);
      }
      return created;
    });
  } catch (error) {
    throw mapPrismaError(error, "Tagihan Santri");
  }
}

export async function getBillForSchool(session: SessionPayload, id: string): Promise<SantriBill> {
  const bill = await findBillById(session.schoolId, id);
  if (!bill) throw new NotFoundError("Tagihan Santri");
  return bill;
}

export async function listBillsForSession(
  session: SessionPayload,
  santriId?: string,
): Promise<SantriBill[]> {
  return listBillsForSchool(session.schoolId, santriId);
}
