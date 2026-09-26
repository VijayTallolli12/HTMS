-- CreateEnum
CREATE TYPE "pms_schema"."MarketRateProviderType" AS ENUM ('DEMO_COMPSET', 'DEMO_OTA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "pms_schema"."CompetitorSegment" AS ENUM ('LUXURY', 'UPSCALE', 'MIDSCALE', 'ECONOMY');

-- CreateTable
CREATE TABLE "pms_schema"."market_rate_providers" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "provider_name" VARCHAR(100) NOT NULL,
    "provider_type" "pms_schema"."MarketRateProviderType" NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "market_rate_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pms_schema"."competitor_set" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "competitor_code" VARCHAR(30) NOT NULL,
    "competitor_name" VARCHAR(100) NOT NULL,
    "segment" "pms_schema"."CompetitorSegment" NOT NULL DEFAULT 'UPSCALE',
    "distance_km" DECIMAL(6,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competitor_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_market_rate_provider_property_id" ON "pms_schema"."market_rate_providers"("property_id", "id");

-- CreateIndex
CREATE INDEX "idx_market_rate_provider_enabled" ON "pms_schema"."market_rate_providers"("property_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "uq_competitor_set_property_code" ON "pms_schema"."competitor_set"("property_id", "competitor_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_competitor_set_property_id" ON "pms_schema"."competitor_set"("property_id", "id");

-- CreateIndex
CREATE INDEX "idx_competitor_set_active" ON "pms_schema"."competitor_set"("property_id", "is_active");

-- AddForeignKey
ALTER TABLE "pms_schema"."market_rate_providers" ADD CONSTRAINT "market_rate_providers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pms_schema"."competitor_set" ADD CONSTRAINT "competitor_set_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;