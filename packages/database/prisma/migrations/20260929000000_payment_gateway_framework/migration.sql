-- Additive payment gateway framework schema. This migration is created only; do not apply automatically.
CREATE SCHEMA IF NOT EXISTS "platform_schema";

DO $$ BEGIN
  CREATE TYPE "platform_schema"."PaymentProviderType" AS ENUM (
    'STRIPE', 'ADYEN', 'SQUARE', 'DEMO', 'AMAZON_PAYMENT_SERVICES', 'TELR', 'NETWORK_INTERNATIONAL', 'TAP', 'PAYTABS',
    'CHECKOUT_COM', 'HYPERPAY', 'MOYASAR', 'GEIDEA', 'BENEFIT', 'PAYPAL', 'RAZORPAY', 'CASHFREE', 'PAYU',
    'GMO_PAYMENT_GATEWAY', 'SB_PAYMENT_SERVICE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "platform_schema"."PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "platform_schema"."PaymentIntentStatus" AS ENUM ('REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "platform_schema"."ReconciliationStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCH', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'AMAZON_PAYMENT_SERVICES';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'TELR';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'NETWORK_INTERNATIONAL';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'TAP';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'PAYTABS';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'CHECKOUT_COM';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'HYPERPAY';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'MOYASAR';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'GEIDEA';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'BENEFIT';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'PAYPAL';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'RAZORPAY';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'CASHFREE';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'PAYU';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'GMO_PAYMENT_GATEWAY';
ALTER TYPE "platform_schema"."PaymentProviderType" ADD VALUE IF NOT EXISTS 'SB_PAYMENT_SERVICE';

CREATE TABLE IF NOT EXISTS "platform_schema"."payment_provider_configs" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "provider" "platform_schema"."PaymentProviderType" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "supported_currencies" TEXT[] NOT NULL DEFAULT ARRAY['JPY','USD','EUR']::TEXT[],
  "last_sync_at" TIMESTAMPTZ(6),
  "last_error" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  "environment" VARCHAR(16) NOT NULL DEFAULT 'SANDBOX',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "enabled_payment_methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "integration_status" VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED',
  CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_configs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_payment_provider_config_property_id" UNIQUE ("property_id", "id")
);
ALTER TABLE "platform_schema"."payment_provider_configs" ADD COLUMN IF NOT EXISTS "environment" VARCHAR(16) NOT NULL DEFAULT 'SANDBOX';
ALTER TABLE "platform_schema"."payment_provider_configs" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "platform_schema"."payment_provider_configs" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_schema"."payment_provider_configs" ADD COLUMN IF NOT EXISTS "enabled_payment_methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "platform_schema"."payment_provider_configs" ADD COLUMN IF NOT EXISTS "integration_status" VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED';
CREATE INDEX IF NOT EXISTS "idx_payment_provider_config_enabled" ON "platform_schema"."payment_provider_configs"("property_id", "enabled");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_provider_config_primary" ON "platform_schema"."payment_provider_configs"("property_id") WHERE "is_primary" AND "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "platform_schema"."payment_intents" (
  "id" TEXT NOT NULL, "property_id" TEXT NOT NULL, "payment_provider_config_id" TEXT NOT NULL, "folio_id" TEXT,
  "external_id" VARCHAR(100) NOT NULL, "amount" INTEGER NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "platform_schema"."PaymentIntentStatus" NOT NULL, "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb, "client_secret" VARCHAR(100),
  "capture_method" VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC', "confirmation_method" VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC',
  "idempotency_key" VARCHAR(64), "last_error" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id"), CONSTRAINT "payment_intents_external_id_key" UNIQUE ("external_id"),
  CONSTRAINT "payment_intents_idempotency_key_key" UNIQUE ("idempotency_key"), CONSTRAINT "uq_payment_intent_property_id" UNIQUE ("property_id","id"),
  CONSTRAINT "payment_intents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_intents_config_fkey" FOREIGN KEY ("payment_provider_config_id") REFERENCES "platform_schema"."payment_provider_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_intents_folio_fkey" FOREIGN KEY ("folio_id") REFERENCES "finance_schema"."folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
ALTER TABLE "platform_schema"."payment_intents" ADD COLUMN IF NOT EXISTS "folio_id" TEXT;
CREATE INDEX IF NOT EXISTS "idx_payment_intent_status" ON "platform_schema"."payment_intents"("property_id","status");
CREATE INDEX IF NOT EXISTS "idx_payment_intent_external_id" ON "platform_schema"."payment_intents"("property_id","external_id");

CREATE TABLE IF NOT EXISTS "platform_schema"."payment_gateway_transactions" (
  "id" TEXT NOT NULL, "property_id" TEXT NOT NULL, "payment_provider_config_id" TEXT NOT NULL, "payment_intent_id" TEXT,
  "external_id" VARCHAR(100) NOT NULL, "amount" INTEGER NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "platform_schema"."PaymentStatus" NOT NULL, "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb, "authorization_code" VARCHAR(50), "captured_at" TIMESTAMPTZ(6),
  "refunded_amount" INTEGER NOT NULL DEFAULT 0, "reconciliation_status" "platform_schema"."ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" VARCHAR(64), "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6), CONSTRAINT "payment_gateway_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_gateway_transactions_external_id_key" UNIQUE ("external_id"),
  CONSTRAINT "payment_gateway_transactions_intent_id_key" UNIQUE ("payment_intent_id"),
  CONSTRAINT "payment_gateway_transactions_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "uq_payment_gateway_txn_property_id" UNIQUE ("property_id","id"),
  CONSTRAINT "payment_gateway_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_transactions_config_fkey" FOREIGN KEY ("payment_provider_config_id") REFERENCES "platform_schema"."payment_provider_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_gateway_transactions_intent_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "platform_schema"."payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_payment_gateway_txn_status" ON "platform_schema"."payment_gateway_transactions"("property_id","status");
CREATE INDEX IF NOT EXISTS "idx_payment_gateway_txn_external_id" ON "platform_schema"."payment_gateway_transactions"("property_id","external_id");

CREATE TABLE IF NOT EXISTS "platform_schema"."payment_webhooks" (
  "id" TEXT NOT NULL, "property_id" TEXT NOT NULL, "payment_provider_config_id" TEXT NOT NULL,
  "provider" "platform_schema"."PaymentProviderType" NOT NULL, "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL, "processed" BOOLEAN NOT NULL DEFAULT false, "processed_at" TIMESTAMPTZ(6), "error" TEXT,
  "correlation_id" VARCHAR(64), "idempotency_key" VARCHAR(64) NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6), CONSTRAINT "payment_webhooks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhooks_correlation_id_key" UNIQUE ("correlation_id"), CONSTRAINT "payment_webhooks_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "uq_payment_webhook_property_id" UNIQUE ("property_id","id"),
  CONSTRAINT "payment_webhooks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_webhooks_config_fkey" FOREIGN KEY ("payment_provider_config_id") REFERENCES "platform_schema"."payment_provider_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_payment_webhook_config_processed" ON "platform_schema"."payment_webhooks"("payment_provider_config_id","processed_at");
