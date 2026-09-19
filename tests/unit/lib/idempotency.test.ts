import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { withIdempotency } from "@/lib/idempotency";

function conflictError() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "7.10.0",
  });
}

describe("lib/idempotency withIdempotency", () => {
  it("creates a new record when nothing exists yet", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new-1" });
    const result = await withIdempotency({
      findExisting: async () => null,
      create,
    });

    expect(result).toEqual({ record: { id: "new-1" }, replayed: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns the existing record without calling create, when one is already found", async () => {
    const create = vi.fn();
    const result = await withIdempotency({
      findExisting: async () => ({ id: "existing-1" }),
      create,
    });

    expect(result).toEqual({ record: { id: "existing-1" }, replayed: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("re-fetches and returns the winner's record when create() races and loses (P2002)", async () => {
    const create = vi.fn().mockRejectedValue(conflictError());
    const findExisting = vi
      .fn()
      .mockResolvedValueOnce(null) // first check: not there yet
      .mockResolvedValueOnce({ id: "winner-1" }); // re-check after P2002: the other request's row

    const result = await withIdempotency({ findExisting, create });

    expect(result).toEqual({ record: { id: "winner-1" }, replayed: true });
  });

  it("rethrows a P2002 if the record still isn't found on re-check (a different unique constraint, not idempotency)", async () => {
    const create = vi.fn().mockRejectedValue(conflictError());
    const findExisting = vi.fn().mockResolvedValue(null);

    await expect(withIdempotency({ findExisting, create })).rejects.toThrow("duplicate");
  });

  it("rethrows any non-P2002 error from create() unchanged", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(withIdempotency({ findExisting: async () => null, create })).rejects.toThrow(
      "connection lost",
    );
  });
});
