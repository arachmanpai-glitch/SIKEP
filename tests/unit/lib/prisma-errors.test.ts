import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { mapPrismaError } from "@/lib/prisma-errors";

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("simulated", {
    code,
    clientVersion: "7.10.0",
    meta,
  });
}

describe("lib/prisma-errors mapPrismaError", () => {
  it("maps P2002 (unique constraint) to ConflictError", () => {
    const mapped = mapPrismaError(
      knownError("P2002", { target: ["school_id", "name"] }),
      "Jenis Tagihan",
    );
    expect(mapped).toBeInstanceOf(ConflictError);
  });

  it("maps P2025 (record not found) to NotFoundError", () => {
    const mapped = mapPrismaError(knownError("P2025"), "Santri");
    expect(mapped).toBeInstanceOf(NotFoundError);
  });

  it("passes through an unrelated Prisma error code unchanged", () => {
    const original = knownError("P2003");
    expect(mapPrismaError(original, "Santri")).toBe(original);
  });

  it("passes through a non-Prisma error unchanged", () => {
    const original = new Error("something else");
    expect(mapPrismaError(original, "Santri")).toBe(original);
  });
});
