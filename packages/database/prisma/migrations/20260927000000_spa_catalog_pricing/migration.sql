-- CreateTable
CREATE TABLE "spa_schema"."spa_service_categories" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "spa_service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spa_schema"."spa_service_addons" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price_adjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "spa_service_addons_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "spa_schema"."spa_services" ADD COLUMN     "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "eligible_room_types" TEXT,
ADD COLUMN     "eligible_therapist_ids" TEXT;

-- CreateIndex
CREATE INDEX "idx_spa_service_categories_property_active" ON "spa_schema"."spa_service_categories"("property_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "spa_service_categories_property_id_code_key" ON "spa_schema"."spa_service_categories"("property_id", "code");

-- CreateIndex
CREATE INDEX "idx_spa_service_addons_service" ON "spa_schema"."spa_service_addons"("property_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "spa_service_addons_service_id_code_key" ON "spa_schema"."spa_service_addons"("service_id", "code");

-- CreateIndex
CREATE INDEX "idx_spa_services_category" ON "spa_schema"."spa_services"("property_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "spa_services_property_id_id_key" ON "spa_schema"."spa_services"("property_id", "id");

-- AddForeignKey
ALTER TABLE "spa_schema"."spa_service_categories" ADD CONSTRAINT "spa_service_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_schema"."spa_services" ADD CONSTRAINT "spa_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "spa_schema"."spa_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_schema"."spa_service_addons" ADD CONSTRAINT "spa_service_addons_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_schema"."spa_service_addons" ADD CONSTRAINT "spa_service_addons_property_id_service_id_fkey" FOREIGN KEY ("property_id", "service_id") REFERENCES "spa_schema"."spa_services"("property_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;