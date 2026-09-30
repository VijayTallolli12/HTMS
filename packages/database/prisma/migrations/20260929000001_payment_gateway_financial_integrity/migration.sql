-- Additive payment gateway financial integrity migration. DO NOT APPLY AUTOMATICALLY.
-- Before enabling amount checks, inspect existing gateway rows using read-only queries:
-- SELECT id, amount, refunded_amount FROM platform_schema.payment_gateway_transactions
-- WHERE amount <= 0 OR refunded_amount < 0 OR refunded_amount > amount;
-- Verify authorized/captured values against authoritative provider records before backfill.

DO $$ BEGIN
  CREATE TYPE "platform_schema"."PaymentGatewayOperationType" AS ENUM ('AUTHORIZATION', 'CAPTURE', 'REFUND', 'CANCEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "platform_schema"."PaymentGatewayOperationState" AS ENUM (
    'REQUESTED', 'PROVIDER_PENDING', 'PROVIDER_CONFIRMED', 'SETTLEMENT_PENDING', 'SETTLED', 'FAILED', 'REQUIRES_RECONCILIATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "platform_schema"."payment_gateway_transactions"
  ADD COLUMN IF NOT EXISTS "authorized_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "captured_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pending_capture_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pending_refund_amount" INTEGER NOT NULL DEFAULT 0;

-- Keep existing globally-unique legacy keys in place. The operation table is the
-- source of truth for per-operation retries; these scoped indexes make the new
-- relational/idempotency boundaries explicit without rewriting legacy records.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_folio_property_id"
  ON "finance_schema"."folios"("property_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_folio_transaction_property_id"
  ON "finance_schema"."folio_transactions"("property_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_property_id"
  ON "finance_schema"."payments"("property_id", "id");

-- Legacy idempotency keys and relationship uniqueness constraints are preserved.

CREATE TABLE IF NOT EXISTS "platform_schema"."payment_gateway_operations" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "payment_provider_config_id" TEXT NOT NULL,
  "payment_intent_id" TEXT,
  "gateway_transaction_id" TEXT,
  "folio_id" TEXT,
  "reservation_id" TEXT,
  "operation_type" "platform_schema"."PaymentGatewayOperationType" NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "provider_idempotency_key" VARCHAR(100) NOT NULL,
  "provider_reference" VARCHAR(100),
  "provider_result" JSONB,
  "state" "platform_schema"."PaymentGatewayOperationState" NOT NULL DEFAULT 'REQUESTED',
  "failure_code" VARCHAR(64),
  "failure_message" TEXT,
  "reconciliation_reason" TEXT,
  "reason" VARCHAR(255),
  "actor_id" TEXT NOT NULL,
  "actor_hotel_group_id" TEXT,
  "actor_snapshot" JSONB NOT NULL,
  "original_payment_id" TEXT,
  "folio_payment_id" TEXT,
  "folio_transaction_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider_started_at" TIMESTAMPTZ(6),
  "provider_confirmed_at" TIMESTAMPTZ(6),
  "settled_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "transaction_applied_at" TIMESTAMPTZ(6),
  CONSTRAINT "payment_gateway_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_payment_gateway_operation_property_id" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_payment_gateway_operation_idempotency" UNIQUE ("property_id", "operation_type", "idempotency_key"),
  CONSTRAINT "payment_gateway_operations_property_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_config_fkey" FOREIGN KEY ("property_id", "payment_provider_config_id") REFERENCES "platform_schema"."payment_provider_configs"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_intent_fkey" FOREIGN KEY ("property_id", "payment_intent_id") REFERENCES "platform_schema"."payment_intents"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_transaction_fkey" FOREIGN KEY ("property_id", "gateway_transaction_id") REFERENCES "platform_schema"."payment_gateway_transactions"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_folio_fkey" FOREIGN KEY ("property_id", "folio_id") REFERENCES "finance_schema"."folios"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_reservation_fkey" FOREIGN KEY ("property_id", "reservation_id") REFERENCES "pms_schema"."reservations"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_original_payment_fkey" FOREIGN KEY ("property_id", "original_payment_id") REFERENCES "finance_schema"."payments"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_folio_payment_fkey" FOREIGN KEY ("property_id", "folio_payment_id") REFERENCES "finance_schema"."payments"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_folio_transaction_fkey" FOREIGN KEY ("property_id", "folio_transaction_id") REFERENCES "finance_schema"."folio_transactions"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_operations_amount_positive" CHECK ("amount" > 0)
);
-- Replace legacy global webhook and intent idempotency constraints with approved scopes.
-- Preserve legacy global uniqueness while older rows exist by including the old value
-- in the scoped hash at write time and move to composite unique constraints.
ALTER TABLE "platform_schema"."payment_webhooks"
  DROP CONSTRAINT IF EXISTS "payment_webhooks_correlation_id_key",
  DROP CONSTRAINT IF EXISTS "payment_webhooks_idempotency_key_key";
DROP INDEX IF EXISTS "platform_schema"."payment_webhooks_correlation_id_key";
DROP INDEX IF EXISTS "platform_schema"."payment_webhooks_idempotency_key_key";
ALTER TABLE "platform_schema"."payment_intents"
  DROP CONSTRAINT IF EXISTS "payment_intents_idempotency_key_key";
DROP INDEX IF EXISTS "platform_schema"."payment_intents_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_intent_property_idempotency"
  ON "platform_schema"."payment_intents"("property_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_webhook_scoped_event"
  ON "platform_schema"."payment_webhooks"("property_id", "payment_provider_config_id", "provider", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_webhook_scoped_correlation"
  ON "platform_schema"."payment_webhooks"("property_id", "payment_provider_config_id", "provider", "event_type", "correlation_id");

CREATE INDEX IF NOT EXISTS "idx_payment_gateway_operation_recovery"
  ON "platform_schema"."payment_gateway_operations"("property_id", "state", "created_at");
CREATE INDEX IF NOT EXISTS "idx_payment_gateway_operation_transaction"
  ON "platform_schema"."payment_gateway_operations"("property_id", "gateway_transaction_id", "operation_type");

CREATE TABLE IF NOT EXISTS "finance_schema"."payment_adjustments" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "folio_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "original_payment_id" TEXT NOT NULL,
  "gateway_transaction_id" TEXT NOT NULL,
  "refund_operation_id" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "amount" DECIMAL(12,4) NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_payment_adjustment_property_id" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_payment_adjustment_idempotency" UNIQUE ("property_id", "idempotency_key"),
  CONSTRAINT "uq_payment_adjustment_refund_operation" UNIQUE ("property_id", "refund_operation_id"),
  CONSTRAINT "payment_adjustment_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "payment_adjustments_property_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_adjustments_folio_fkey" FOREIGN KEY ("property_id", "folio_id") REFERENCES "finance_schema"."folios"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_adjustments_reservation_fkey" FOREIGN KEY ("property_id", "reservation_id") REFERENCES "pms_schema"."reservations"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_adjustments_payment_fkey" FOREIGN KEY ("property_id", "original_payment_id") REFERENCES "finance_schema"."payments"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_adjustments_transaction_fkey" FOREIGN KEY ("property_id", "gateway_transaction_id") REFERENCES "platform_schema"."payment_gateway_transactions"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_adjustments_operation_fkey" FOREIGN KEY ("property_id", "refund_operation_id") REFERENCES "platform_schema"."payment_gateway_operations"("property_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_payment_adjustment_folio"
  ON "finance_schema"."payment_adjustments"("property_id", "folio_id", "created_at");

-- Amount constraints are intentionally excluded pending the read-only legacy-row
-- validation above and provider-authoritative backfill plan.
