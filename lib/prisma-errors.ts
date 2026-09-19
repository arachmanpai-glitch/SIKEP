import { Prisma } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/errors";

/**
 * Translates known Prisma error codes into our AppError taxonomy so they
 * surface as proper 409/404 responses instead of falling through to
 * handleApiError's generic 500 (which is meant for truly unexpected bugs,
 * not routine "duplicate name" conflicts). Call from repository/service
 * catch blocks around create/update/delete.
 */
export function mapPrismaError(error: unknown, entityLabel: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "";
      return new ConflictError(`${entityLabel} dengan nilai tersebut sudah ada.`, {
        fields: target,
      });
    }
    if (error.code === "P2025") {
      return new NotFoundError(entityLabel);
    }
  }
  return error;
}
