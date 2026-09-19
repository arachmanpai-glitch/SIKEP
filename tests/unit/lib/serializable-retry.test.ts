import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { withSerializableRetry } from "@/lib/serializable-retry";

function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034",
    clientVersion: "7.10.0",
  });
}

describe("lib/serializable-retry withSerializableRetry", () => {
  it("returns the result on the first successful attempt", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(withSerializableRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries on a P2034 serialization failure and succeeds on the next attempt", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(serializationFailure())
      .mockResolvedValueOnce("ok-after-retry");
    await expect(withSerializableRetry(run)).resolves.toBe("ok-after-retry");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives up after the max attempts and throws the last serialization error", async () => {
    const run = vi.fn().mockRejectedValue(serializationFailure());
    await expect(withSerializableRetry(run)).rejects.toMatchObject({ code: "P2034" });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-serialization error", async () => {
    const run = vi.fn().mockRejectedValue(new Error("insufficient balance"));
    await expect(withSerializableRetry(run)).rejects.toThrow("insufficient balance");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
