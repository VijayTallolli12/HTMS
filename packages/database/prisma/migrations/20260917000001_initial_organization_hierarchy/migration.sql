-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform_schema";

-- CreateTable
CREATE TABLE "platform_schema"."hotel_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hotel_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."regions" (
    "id" TEXT NOT NULL,
    "hotel_group_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."countries" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."properties" (
    "id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "time_zone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state_province" TEXT,
    "postal_code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."buildings" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."floors" (
    "id" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_schema"."outbox_events" (
    "id" TEXT NOT NULL,
    "specversion" TEXT NOT NULL DEFAULT '1.0',
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "subject" TEXT,
    "datacontenttype" TEXT NOT NULL DEFAULT 'application/json',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "tenant_id" TEXT,
    "property_id" TEXT,
    "correlation_id" TEXT,
    "causation_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_groups_code_key" ON "platform_schema"."hotel_groups"("code");

-- CreateIndex
CREATE INDEX "hotel_groups_status_idx" ON "platform_schema"."hotel_groups"("status");

-- CreateIndex
CREATE INDEX "hotel_groups_deleted_at_idx" ON "platform_schema"."hotel_groups"("deleted_at");

-- CreateIndex
CREATE INDEX "regions_hotel_group_id_idx" ON "platform_schema"."regions"("hotel_group_id");

-- CreateIndex
CREATE INDEX "regions_status_idx" ON "platform_schema"."regions"("status");

-- CreateIndex
CREATE INDEX "regions_deleted_at_idx" ON "platform_schema"."regions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "regions_hotel_group_id_code_key" ON "platform_schema"."regions"("hotel_group_id", "code");

-- CreateIndex
CREATE INDEX "countries_region_id_idx" ON "platform_schema"."countries"("region_id");

-- CreateIndex
CREATE INDEX "countries_code_idx" ON "platform_schema"."countries"("code");

-- CreateIndex
CREATE INDEX "countries_status_idx" ON "platform_schema"."countries"("status");

-- CreateIndex
CREATE INDEX "countries_deleted_at_idx" ON "platform_schema"."countries"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "countries_region_id_code_key" ON "platform_schema"."countries"("region_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "properties_code_key" ON "platform_schema"."properties"("code");

-- CreateIndex
CREATE INDEX "properties_country_id_idx" ON "platform_schema"."properties"("country_id");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "platform_schema"."properties"("status");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "platform_schema"."properties"("deleted_at");

-- CreateIndex
CREATE INDEX "buildings_property_id_idx" ON "platform_schema"."buildings"("property_id");

-- CreateIndex
CREATE INDEX "buildings_status_idx" ON "platform_schema"."buildings"("status");

-- CreateIndex
CREATE INDEX "buildings_deleted_at_idx" ON "platform_schema"."buildings"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_property_id_code_key" ON "platform_schema"."buildings"("property_id", "code");

-- CreateIndex
CREATE INDEX "floors_building_id_idx" ON "platform_schema"."floors"("building_id");

-- CreateIndex
CREATE INDEX "floors_floor_number_idx" ON "platform_schema"."floors"("floor_number");

-- CreateIndex
CREATE INDEX "floors_status_idx" ON "platform_schema"."floors"("status");

-- CreateIndex
CREATE INDEX "floors_deleted_at_idx" ON "platform_schema"."floors"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_code_key" ON "platform_schema"."floors"("building_id", "code");

-- CreateIndex
CREATE INDEX "outbox_events_published_time_idx" ON "audit_schema"."outbox_events"("published", "time");

-- AddForeignKey
ALTER TABLE "platform_schema"."regions" ADD CONSTRAINT "regions_hotel_group_id_fkey" FOREIGN KEY ("hotel_group_id") REFERENCES "platform_schema"."hotel_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."countries" ADD CONSTRAINT "countries_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "platform_schema"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."properties" ADD CONSTRAINT "properties_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "platform_schema"."countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."buildings" ADD CONSTRAINT "buildings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "platform_schema"."buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
