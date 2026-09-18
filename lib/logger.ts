import pino from "pino";

import { env } from "@/lib/env";

/**
 * Structured application logger. Use `logger.child({ module: "..." })`
 * per subsystem (service, repository, API route) so log lines can be
 * filtered by origin. Never log secrets, tokens, or full request bodies
 * containing money/PII without redaction.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token", "*.secret"],
    remove: true,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
