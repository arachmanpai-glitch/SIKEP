import { Prisma } from "@prisma/client";

/**
 * Idempotency-Key handling (spec section 17): if a request replays a key
 * already used, return the SAME record instead of creating a duplicate or
 * erroring. `findExisting` is checked first (fast path for an obvious
 * replay); if `create` still races with a concurrent identical request,
 * the DB's own `@unique` constraint on `idempotency_key` is the real
 * source of truth — a P2002 on create means someone else just won that
 * race, so we re-fetch and return their result instead of failing.
 */
export async function withIdempotency<T>(params: {
  findExisting: () => Promise<T | null>;
  create: () => Promise<T>;
}): Promise<{ record: T; replayed: boolean }> {
  const existing = await params.findExisting();
  if (existing) {
    return { record: existing, replayed: true };
  }

  try {
    const record = await params.create();
    return { record, replayed: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await params.findExisting();
      if (raced) {
        return { record: raced, replayed: true };
      }
    }
    throw error;
  }
}
