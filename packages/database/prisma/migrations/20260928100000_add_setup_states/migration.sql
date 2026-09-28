-- W2: First-run setup state ledger.
-- Additive-only: creates one new table in platform_schema. No existing tables,
-- columns, or constraints are altered.
CREATE TABLE "platform_schema"."setup_states" (
    "id" TEXT NOT NULL,
    "hotel_group_id" TEXT,
    "property_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'NOT_INITIALIZED',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "last_error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "setup_states_pkey" PRIMARY KEY ("id")
);

-- Optimistic-concurrency guard: update/set-state operations compare "version".
-- Concurrent bootstrap transactions block on this row and re-check eligibility.
CREATE INDEX "setup_states_hotel_group_id_idx" ON "platform_schema"."setup_states"("hotel_group_id");
CREATE INDEX "setup_states_property_id_idx" ON "platform_schema"."setup_states"("property_id");
CREATE INDEX "setup_states_state_idx" ON "platform_schema"."setup_states"("state");
