-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClassLevel" AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'PENGABDIAN');

-- CreateEnum
CREATE TYPE "SantriStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "TransactionCategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "SantriCreditType" AS ENUM ('ISSUED', 'CONSUMED', 'VOIDED_REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE', 'REVERSAL', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "FinancialEntityType" AS ENUM ('INCOME_TRANSACTION', 'EXPENSE_TRANSACTION', 'SANTRI_PAYMENT', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'POST', 'VOID', 'REVERSAL', 'LOGIN', 'LOGOUT', 'EXPORT', 'CONFIG_CHANGE');

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "level" "ClassLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "santri" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_id" UUID,
    "nis" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "status" "SantriStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "santri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "opening_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "account_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_sources" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fund_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionCategoryType" NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_types" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bill_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "santri_bills" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "santri_id" UUID NOT NULL,
    "bill_type_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "due_date" TIMESTAMPTZ(6),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "santri_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "santri_payments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "santri_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "income_transaction_id" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_no" TEXT,
    "note" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "santri_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "santri_payment_id" UUID NOT NULL,
    "santri_bill_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "santri_credits" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "santri_id" UUID NOT NULL,
    "type" "SantriCreditType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_payment_id" UUID,
    "consumed_for_bill_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "santri_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_transactions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "fund_source_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "income_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_transactions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_threshold_snapshot" DECIMAL(18,2),
    "posted_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ledger" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "financial_period_id" UUID,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reference_type" "FinancialEntityType" NOT NULL,
    "reference_id" UUID NOT NULL,
    "income_transaction_id" UUID,
    "expense_transaction_id" UUID,
    "description" TEXT,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "expense_transaction_id" UUID NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "threshold_amount_snapshot" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_settings" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "expense_approval_threshold" DECIMAL(18,2) NOT NULL DEFAULT 1000000.00,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "planned_amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_attachments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "entity_type" "FinancialEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "income_transaction_id" UUID,
    "expense_transaction_id" UUID,
    "santri_payment_id" UUID,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reversal_transactions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "original_entity_type" "FinancialEntityType" NOT NULL,
    "original_entity_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reversed_by_id" UUID NOT NULL,
    "ledger_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reversal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_school_id_idx" ON "users"("school_id");

-- CreateIndex
CREATE INDEX "academic_years_school_id_idx" ON "academic_years"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_school_id_name_key" ON "academic_years"("school_id", "name");

-- CreateIndex
CREATE INDEX "classes_school_id_academic_year_id_level_idx" ON "classes"("school_id", "academic_year_id", "level");

-- CreateIndex
CREATE INDEX "santri_school_id_class_id_idx" ON "santri"("school_id", "class_id");

-- CreateIndex
CREATE INDEX "santri_school_id_status_idx" ON "santri"("school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "santri_school_id_nis_key" ON "santri"("school_id", "nis");

-- CreateIndex
CREATE INDEX "financial_accounts_school_id_idx" ON "financial_accounts"("school_id");

-- CreateIndex
CREATE INDEX "fund_sources_school_id_idx" ON "fund_sources"("school_id");

-- CreateIndex
CREATE INDEX "transaction_categories_school_id_type_idx" ON "transaction_categories"("school_id", "type");

-- CreateIndex
CREATE INDEX "bill_types_school_id_idx" ON "bill_types"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_types_school_id_name_key" ON "bill_types"("school_id", "name");

-- CreateIndex
CREATE INDEX "santri_bills_school_id_santri_id_status_idx" ON "santri_bills"("school_id", "santri_id", "status");

-- CreateIndex
CREATE INDEX "santri_bills_school_id_academic_year_id_idx" ON "santri_bills"("school_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "santri_payments_income_transaction_id_key" ON "santri_payments"("income_transaction_id");

-- CreateIndex
CREATE INDEX "santri_payments_school_id_santri_id_idx" ON "santri_payments"("school_id", "santri_id");

-- CreateIndex
CREATE INDEX "payment_allocations_school_id_idx" ON "payment_allocations"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_santri_payment_id_santri_bill_id_key" ON "payment_allocations"("santri_payment_id", "santri_bill_id");

-- CreateIndex
CREATE INDEX "santri_credits_school_id_santri_id_idx" ON "santri_credits"("school_id", "santri_id");

-- CreateIndex
CREATE UNIQUE INDEX "income_transactions_idempotency_key_key" ON "income_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "income_transactions_school_id_status_idx" ON "income_transactions"("school_id", "status");

-- CreateIndex
CREATE INDEX "income_transactions_school_id_transaction_date_idx" ON "income_transactions"("school_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_transactions_idempotency_key_key" ON "expense_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "expense_transactions_school_id_status_idx" ON "expense_transactions"("school_id", "status");

-- CreateIndex
CREATE INDEX "expense_transactions_school_id_transaction_date_idx" ON "expense_transactions"("school_id", "transaction_date");

-- CreateIndex
CREATE INDEX "financial_ledger_school_id_financial_account_id_idx" ON "financial_ledger"("school_id", "financial_account_id");

-- CreateIndex
CREATE INDEX "financial_ledger_school_id_reference_type_reference_id_idx" ON "financial_ledger"("school_id", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "approval_requests_school_id_status_idx" ON "approval_requests"("school_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_school_id_expense_transaction_id_idx" ON "approval_requests"("school_id", "expense_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_settings_school_id_key" ON "approval_settings"("school_id");

-- CreateIndex
CREATE INDEX "budgets_school_id_idx" ON "budgets"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_school_id_academic_year_id_category_id_key" ON "budgets"("school_id", "academic_year_id", "category_id");

-- CreateIndex
CREATE INDEX "transaction_attachments_school_id_entity_type_entity_id_idx" ON "transaction_attachments"("school_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_entity_type_entity_id_idx" ON "audit_logs"("school_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_action_idx" ON "audit_logs"("school_id", "action");

-- CreateIndex
CREATE INDEX "notifications_school_id_user_id_is_read_idx" ON "notifications"("school_id", "user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "settings_school_id_key_key" ON "settings"("school_id", "key");

-- CreateIndex
CREATE INDEX "financial_periods_school_id_status_idx" ON "financial_periods"("school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_school_id_name_key" ON "financial_periods"("school_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "reversal_transactions_ledger_entry_id_key" ON "reversal_transactions"("ledger_entry_id");

-- CreateIndex
CREATE INDEX "reversal_transactions_school_id_original_entity_type_origin_idx" ON "reversal_transactions"("school_id", "original_entity_type", "original_entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri" ADD CONSTRAINT "santri_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri" ADD CONSTRAINT "santri_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_sources" ADD CONSTRAINT "fund_sources_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_types" ADD CONSTRAINT "bill_types_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_bills" ADD CONSTRAINT "santri_bills_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_bills" ADD CONSTRAINT "santri_bills_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_bills" ADD CONSTRAINT "santri_bills_bill_type_id_fkey" FOREIGN KEY ("bill_type_id") REFERENCES "bill_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_bills" ADD CONSTRAINT "santri_bills_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_payments" ADD CONSTRAINT "santri_payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_payments" ADD CONSTRAINT "santri_payments_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_payments" ADD CONSTRAINT "santri_payments_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_payments" ADD CONSTRAINT "santri_payments_income_transaction_id_fkey" FOREIGN KEY ("income_transaction_id") REFERENCES "income_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_santri_payment_id_fkey" FOREIGN KEY ("santri_payment_id") REFERENCES "santri_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_santri_bill_id_fkey" FOREIGN KEY ("santri_bill_id") REFERENCES "santri_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_credits" ADD CONSTRAINT "santri_credits_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_credits" ADD CONSTRAINT "santri_credits_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_credits" ADD CONSTRAINT "santri_credits_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "santri_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_fund_source_id_fkey" FOREIGN KEY ("fund_source_id") REFERENCES "fund_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_financial_period_id_fkey" FOREIGN KEY ("financial_period_id") REFERENCES "financial_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_income_transaction_id_fkey" FOREIGN KEY ("income_transaction_id") REFERENCES "income_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_expense_transaction_id_fkey" FOREIGN KEY ("expense_transaction_id") REFERENCES "expense_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_expense_transaction_id_fkey" FOREIGN KEY ("expense_transaction_id") REFERENCES "expense_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_settings" ADD CONSTRAINT "approval_settings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_settings" ADD CONSTRAINT "approval_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_income_transaction_id_fkey" FOREIGN KEY ("income_transaction_id") REFERENCES "income_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_expense_transaction_id_fkey" FOREIGN KEY ("expense_transaction_id") REFERENCES "expense_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_santri_payment_id_fkey" FOREIGN KEY ("santri_payment_id") REFERENCES "santri_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversal_transactions" ADD CONSTRAINT "reversal_transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversal_transactions" ADD CONSTRAINT "reversal_transactions_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversal_transactions" ADD CONSTRAINT "reversal_transactions_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "financial_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual addition (not expressible in schema.prisma without a preview
-- feature): SIKEP spec section 3/11 — "Bendahara tidak boleh menyetujui
-- transaksi yang dibuat sendiri" / "Creator tidak boleh menjadi approver".
-- Enforced at the service layer too (PHASE 5/7), but a DB-level CHECK is
-- cheap, high-value defense-in-depth for a hard financial-integrity rule.
-- CreateCheckConstraint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decider_not_requester_chk" CHECK ("decided_by_id" IS NULL OR "decided_by_id" <> "requested_by_id");

