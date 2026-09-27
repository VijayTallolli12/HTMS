-- Add OCC version column to daily_rates table
ALTER TABLE "pms_schema"."daily_rates" ADD COLUMN IF NOT EXISTS "version" INT NOT NULL DEFAULT 0;
