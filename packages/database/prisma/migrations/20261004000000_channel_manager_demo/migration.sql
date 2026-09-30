-- Channel Manager demo persistence (additive; no external provider integration).
CREATE SCHEMA IF NOT EXISTS "platform_schema";

DO $$ BEGIN
  CREATE TYPE "platform_schema"."ChannelProvider" AS ENUM ('BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'DEMO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "platform_schema"."ChannelSyncType" AS ENUM ('RESERVATION_INBOUND', 'RESERVATION_OUTBOUND', 'AVAILABILITY', 'RATE', 'RECONCILIATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "platform_schema"."ChannelSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "platform_schema"."channel_configs" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "provider" "platform_schema"."ChannelProvider" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configuration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "field_mapping" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "last_sync_at" TIMESTAMPTZ(6),
  "last_error" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channel_configs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_channel_config_property_provider" UNIQUE ("property_id", "provider"),
  CONSTRAINT "uq_channel_config_property_id" UNIQUE ("property_id", "id")
);

CREATE INDEX IF NOT EXISTS "idx_channel_config_property_enabled"
  ON "platform_schema"."channel_configs"("property_id", "enabled");

CREATE TABLE IF NOT EXISTS "platform_schema"."channel_sync_logs" (
  "id" TEXT NOT NULL,
  "channel_config_id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "sync_type" "platform_schema"."ChannelSyncType" NOT NULL,
  "status" "platform_schema"."ChannelSyncStatus" NOT NULL,
  "records_processed" INTEGER NOT NULL DEFAULT 0,
  "records_failed" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "correlation_id" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "retry_of_id" TEXT,
  "request_payload" JSONB,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "channel_sync_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channel_sync_logs_channel_config_id_fkey" FOREIGN KEY ("channel_config_id") REFERENCES "platform_schema"."channel_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "channel_sync_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_channel_sync_log_config_id" UNIQUE ("channel_config_id", "id")
);

CREATE INDEX IF NOT EXISTS "idx_channel_sync_log_config_started"
  ON "platform_schema"."channel_sync_logs"("channel_config_id", "started_at");
CREATE INDEX IF NOT EXISTS "idx_channel_sync_log_property_started"
  ON "platform_schema"."channel_sync_logs"("property_id", "started_at");
CREATE INDEX IF NOT EXISTS "idx_channel_sync_log_retry_of"
  ON "platform_schema"."channel_sync_logs"("channel_config_id", "retry_of_id");

-- Upgrade previously-created Channel Manager tables if present.
ALTER TYPE "platform_schema"."ChannelSyncStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TABLE "platform_schema"."channel_sync_logs" ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "platform_schema"."channel_sync_logs" ADD COLUMN IF NOT EXISTS "retry_of_id" TEXT;
ALTER TABLE "platform_schema"."channel_sync_logs" ADD COLUMN IF NOT EXISTS "request_payload" JSONB;
