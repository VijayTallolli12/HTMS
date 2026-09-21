-- W1-T10: Housekeeping Tasks — Departure Cleaning Closed Loop

-- CreateTable
CREATE TABLE "pms_schema"."housekeeping_tasks" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "reservation_id" TEXT,
    "task_type" VARCHAR(20) NOT NULL,
    "priority" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "assigned_attendant_id" TEXT,
    "assigned_by" TEXT,
    "inspection_result" VARCHAR(10),
    "inspection_notes" TEXT,
    "rejection_reason" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "inspected_at" TIMESTAMPTZ(6),
    "inspected_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_hk_task_reservation_type" ON "pms_schema"."housekeeping_tasks"("property_id", "reservation_id", "task_type");
CREATE INDEX "idx_hk_task_property_status" ON "pms_schema"."housekeeping_tasks"("property_id", "status");
CREATE INDEX "idx_hk_task_property_room" ON "pms_schema"."housekeeping_tasks"("property_id", "room_id");
CREATE INDEX "idx_hk_task_attendant_status" ON "pms_schema"."housekeeping_tasks"("property_id", "assigned_attendant_id", "status");

-- AddForeignKey
ALTER TABLE "pms_schema"."housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pms_schema"."housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "pms_schema"."rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pms_schema"."housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "pms_schema"."reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
