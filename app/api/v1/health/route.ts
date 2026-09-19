import { NextResponse } from "next/server";

import { checkHealth } from "@/lib/health";

/**
 * Public (no auth) — load balancers/process managers/uptime monitors need
 * to poll this without a session. Deliberately NOT wrapped in the
 * standard `apiSuccess`/`apiError` envelope (lib/api-response.ts): health
 * checks are consumed by infra tooling that expects a plain
 * `{ status: "ok" }`-shaped body and reads the HTTP status code, not this
 * app's `{ success, data, message }` business API contract.
 */
export async function GET() {
  const result = await checkHealth();
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}
