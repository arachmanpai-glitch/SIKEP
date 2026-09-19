import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const samplePayload = {
  userId: "11111111-1111-4111-8111-111111111111",
  schoolId: "22222222-2222-4222-8222-222222222222",
  roleCode: "BENDAHARA",
  email: "bendahara@sikep.test",
};

describe("lib/auth/session", () => {
  it("round-trips a session payload through sign and verify", async () => {
    const token = await createSessionToken(samplePayload);
    const verified = await verifySessionToken(token);
    expect(verified).toEqual(samplePayload);
  });

  it("returns null for a tampered token", async () => {
    const token = await createSessionToken(samplePayload);
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("returns null for garbage input instead of throwing", async () => {
    await expect(verifySessionToken("not-a-jwt-at-all")).resolves.toBeNull();
  });

  it("returns null for an expired token", async () => {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const expired = await new SignJWT({
      schoolId: samplePayload.schoolId,
      roleCode: samplePayload.roleCode,
      email: samplePayload.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(samplePayload.userId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);

    await expect(verifySessionToken(expired)).resolves.toBeNull();
  });

  it("returns null when signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("a-completely-different-secret-value-00000000");
    const token = await new SignJWT({
      schoolId: samplePayload.schoolId,
      roleCode: samplePayload.roleCode,
      email: samplePayload.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(samplePayload.userId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
