import { Prisma } from "@prisma/client";

const MAX_ATTEMPTS = 3;

/**
 * Retries a Serializable-isolation `$transaction` on a Postgres
 * serialization failure (Prisma error code P2034 — "Transaction failed
 * due to a write conflict or a deadlock"). This is the mechanism that
 * makes concurrent expense postings against the same account safe (spec
 * section 18's two-700k-expenses-against-1M-balance scenario): under
 * Serializable isolation Postgres itself detects the conflicting
 * concurrent writes and aborts one of them rather than letting both
 * succeed and overdraw the account — the aborted one retries here and
 * re-reads the now-current balance.
 */
export async function withSerializableRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isSerializationFailure || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw lastError;
}
