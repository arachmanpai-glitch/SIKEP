import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PHASE 2 schema-shape tests. There is no live PostgreSQL instance in this
 * environment (see docs/decisions.md D14), so instead of a DMMF/runtime
 * check — Prisma ORM v7's client-bundle DMMF was found to omit unique/
 * native-type metadata (trimmed for bundle size) — these tests assert
 * directly against the generated migration SQL, i.e. the exact DDL that
 * will run against a real PostgreSQL database. Regenerate this file with:
 *   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
 * (strip the first 3 CLI banner lines) whenever prisma/schema.prisma changes.
 */
const migrationPath = path.resolve(
  __dirname,
  "../../../prisma/migrations/20260918000000_init/migration.sql",
);
const sql = readFileSync(migrationPath, "utf-8");

function extractTable(name: string): string {
  const match = sql.match(new RegExp(`CREATE TABLE "${name}" \\(([\\s\\S]*?)\\n\\);`, "m"));
  if (!match) throw new Error(`Table "${name}" not found in migration.sql`);
  return match[1];
}

const REQUIRED_TABLES = [
  "schools",
  "roles",
  "users",
  "academic_years",
  "classes",
  "santri",
  "financial_accounts",
  "fund_sources",
  "transaction_categories",
  "bill_types",
  "santri_bills",
  "santri_payments",
  "payment_allocations",
  "santri_credits",
  "income_transactions",
  "expense_transactions",
  "financial_ledger",
  "approval_requests",
  "approval_settings",
  "budgets",
  "transaction_attachments",
  "audit_logs",
  "notifications",
  "settings",
  "financial_periods",
  "reversal_transactions",
];

describe("prisma migration DDL — table inventory", () => {
  it("creates exactly the 26 tables required by the SIKEP spec (section 13)", () => {
    for (const table of REQUIRED_TABLES) {
      expect(sql, `missing CREATE TABLE "${table}"`).toContain(`CREATE TABLE "${table}" (`);
    }
    const created = [...sql.matchAll(/CREATE TABLE "([a-z_]+)" \(/g)].map((m) => m[1]);
    expect(created.sort()).toEqual([...REQUIRED_TABLES].sort());
  });
});

describe("prisma migration DDL — multi-tenant isolation", () => {
  // "schools" is the tenant root itself (it IS the school, not owned by
  // one); "roles" is deliberately global reference data (see D12).
  const NOT_TENANT_SCOPED = new Set(["schools", "roles"]);

  it("gives every domain table a school_id column, except the tenant root and the global roles table", () => {
    for (const table of REQUIRED_TABLES) {
      const body = extractTable(table);
      if (NOT_TENANT_SCOPED.has(table)) {
        expect(body).not.toContain('"school_id"');
      } else {
        expect(body, `${table} is missing school_id`).toContain('"school_id" UUID NOT NULL');
      }
    }
  });
});

describe("prisma migration DDL — money columns", () => {
  it("never uses FLOAT/REAL/DOUBLE PRECISION anywhere in the schema", () => {
    expect(sql).not.toMatch(/\b(FLOAT|REAL|DOUBLE PRECISION)\b/i);
  });

  it.each([
    ["santri_bills", "amount"],
    ["santri_bills", "amount_paid"],
    ["santri_payments", "amount"],
    ["payment_allocations", "amount"],
    ["santri_credits", "amount"],
    ["income_transactions", "amount"],
    ["expense_transactions", "amount"],
    ["financial_ledger", "amount"],
    ["financial_accounts", "opening_balance"],
    ["budgets", "planned_amount"],
    ["approval_settings", "expense_approval_threshold"],
  ])("stores %s.%s as DECIMAL(18,2)", (table, column) => {
    const body = extractTable(table);
    expect(body).toMatch(new RegExp(`"${column}" DECIMAL\\(18,2\\)`));
  });
});

describe("prisma migration DDL — timestamp columns are timezone-aware", () => {
  it("uses TIMESTAMPTZ for every *_at column", () => {
    const timestampColumns = [...sql.matchAll(/"(\w+_at)" (\w[\w ()]*)/g)];
    expect(timestampColumns.length).toBeGreaterThan(0);
    for (const [, column, type] of timestampColumns) {
      expect(type, `${column} should be TIMESTAMPTZ`).toMatch(/^TIMESTAMPTZ\(6\)/);
    }
  });
});

describe("prisma migration DDL — append-only / immutable tables", () => {
  it.each(["financial_ledger", "audit_logs", "reversal_transactions"])(
    "keeps %s insert-only (no updated_at / deleted_at)",
    (table) => {
      const body = extractTable(table);
      expect(body).not.toContain('"updated_at"');
      expect(body).not.toContain('"deleted_at"');
    },
  );
});

describe("prisma migration DDL — polymorphic attachment FKs", () => {
  it("gives transaction_attachments three separate nullable typed FK columns instead of one shared column", () => {
    const body = extractTable("transaction_attachments");
    expect(body).toContain('"income_transaction_id" UUID');
    expect(body).toContain('"expense_transaction_id" UUID');
    expect(body).toContain('"santri_payment_id" UUID');

    // Exactly one FK constraint per typed column — not two FKs sharing a
    // single "entity_id" column (that would be relationally unsatisfiable).
    const incomeFks = sql.match(
      /ALTER TABLE "transaction_attachments" ADD CONSTRAINT \S+ FOREIGN KEY \("income_transaction_id"\)/g,
    );
    const expenseFks = sql.match(
      /ALTER TABLE "transaction_attachments" ADD CONSTRAINT \S+ FOREIGN KEY \("expense_transaction_id"\)/g,
    );
    const entityIdFks = sql.match(
      /ALTER TABLE "transaction_attachments" ADD CONSTRAINT \S+ FOREIGN KEY \("entity_id"\)/g,
    );
    expect(incomeFks).toHaveLength(1);
    expect(expenseFks).toHaveLength(1);
    expect(entityIdFks).toBeNull();
  });
});

describe("prisma migration DDL — financial integrity constraints", () => {
  it("enforces idempotency_key uniqueness on income and expense transactions", () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "income_transactions_idempotency_key_key" ON "income_transactions"("idempotency_key")',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "expense_transactions_idempotency_key_key" ON "expense_transactions"("idempotency_key")',
    );
  });

  it("enforces at the DB level that an approval decider cannot be the requester", () => {
    expect(sql).toContain(
      'ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decider_not_requester_chk" CHECK ("decided_by_id" IS NULL OR "decided_by_id" <> "requested_by_id")',
    );
  });

  it("declares the fixed K1-K6 + PENGABDIAN class level structure (spec section 4)", () => {
    expect(sql).toContain(
      "CREATE TYPE \"ClassLevel\" AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'PENGABDIAN');",
    );
  });

  it("declares the exact 12 audit actions from spec section 16", () => {
    expect(sql).toContain(
      "CREATE TYPE \"AuditAction\" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'POST', 'VOID', 'REVERSAL', 'LOGIN', 'LOGOUT', 'EXPORT', 'CONFIG_CHANGE');",
    );
  });
});
