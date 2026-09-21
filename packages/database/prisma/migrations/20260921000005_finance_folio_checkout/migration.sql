-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance_schema";

-- 1. Alter Reservations table with checkout fields and checkout idempotency constraint
ALTER TABLE "pms_schema"."reservations"
  ADD COLUMN IF NOT EXISTS "check_out_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "checked_out_by" TEXT,
  ADD COLUMN IF NOT EXISTS "check_out_idempotency_key" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "check_out_payload_hash" VARCHAR(64);

ALTER TABLE "pms_schema"."reservations"
  DROP CONSTRAINT IF EXISTS "uq_reservations_checkout_idempotency";

ALTER TABLE "pms_schema"."reservations"
  ADD CONSTRAINT "uq_reservations_checkout_idempotency"
  UNIQUE ("property_id", "check_out_idempotency_key");

-- 2. Finance Folios Table (Guest Billing Ledger Aggregate Root)
CREATE TABLE IF NOT EXISTS "finance_schema"."folios" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "folio_number" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "currency" VARCHAR(3) NOT NULL,
    "balance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" TEXT,

    CONSTRAINT "folios_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_folio_property_res_number" UNIQUE ("property_id", "reservation_id", "folio_number"),
    CONSTRAINT "uq_folio_property_idempotency" UNIQUE ("property_id", "idempotency_key")
);

CREATE INDEX IF NOT EXISTS "idx_folio_property_reservation" ON "finance_schema"."folios"("property_id", "reservation_id");
CREATE INDEX IF NOT EXISTS "idx_folio_property_status" ON "finance_schema"."folios"("property_id", "status");

-- 3. Finance Folio Transactions Table (Immutable Ledger Posting Entries)
CREATE TABLE IF NOT EXISTS "finance_schema"."folio_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "folio_id" TEXT NOT NULL,
    "transaction_code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "tax_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reason_code" VARCHAR(50),
    "idempotency_key" VARCHAR(64) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "posted_by" TEXT NOT NULL,

    CONSTRAINT "folio_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_folio_tx_property_idempotency" UNIQUE ("property_id", "idempotency_key"),
    CONSTRAINT "folio_transactions_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "finance_schema"."folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_folio_tx_property_folio" ON "finance_schema"."folio_transactions"("property_id", "folio_id");
CREATE INDEX IF NOT EXISTS "idx_folio_tx_folio_posted" ON "finance_schema"."folio_transactions"("folio_id", "posted_at");

-- 4. Finance Payments Table (Immutable Payment Records)
CREATE TABLE IF NOT EXISTS "finance_schema"."payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "folio_id" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "payment_method" VARCHAR(30) NOT NULL,
    "reference_number" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    "idempotency_key" VARCHAR(64) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL,
    "processed_by" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_payment_property_idempotency" UNIQUE ("property_id", "idempotency_key"),
    CONSTRAINT "payments_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "finance_schema"."folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_payment_property_folio" ON "finance_schema"."payments"("property_id", "folio_id");
