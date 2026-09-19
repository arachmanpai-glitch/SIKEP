"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/csrf";
import type { ApiResponseBody } from "@/types/api";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

/**
 * fetch() wrapper for client components calling /api/v1/** mutating
 * routes: attaches the CSRF header (lib/auth/csrf.ts double-submit
 * pattern) and parses the standard ApiResponseBody envelope
 * (lib/api-response.ts), throwing with the server's message on failure so
 * callers can show it directly.
 */
export async function apiMutate<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER_NAME]: readCookie(CSRF_COOKIE_NAME) ?? "",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as ApiResponseBody<T>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const json = (await response.json()) as ApiResponseBody<T>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}
