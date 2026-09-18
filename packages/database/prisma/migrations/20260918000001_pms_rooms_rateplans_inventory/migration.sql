-- 1. Create PMS Schema
CREATE SCHEMA IF NOT EXISTS pms_schema;

-- 2. Add Composite Unique Constraints to Platform Tables (Required for Composite FKs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_buildings_property_id'
  ) THEN
    ALTER TABLE platform_schema.buildings
      ADD CONSTRAINT uq_buildings_property_id UNIQUE (property_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_floors_building_id'
  ) THEN
    ALTER TABLE platform_schema.floors
      ADD CONSTRAINT uq_floors_building_id UNIQUE (building_id, id);
  END IF;
END $$;

-- 3. Room Types Table (UUIDv7 generated application-side as TEXT)
CREATE TABLE IF NOT EXISTS pms_schema.room_types (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  room_class VARCHAR(50) NOT NULL,
  base_occupancy INT NOT NULL DEFAULT 2,
  max_occupancy INT NOT NULL DEFAULT 3,
  max_adults INT NOT NULL DEFAULT 2,
  max_children INT NOT NULL DEFAULT 1,
  bed_configuration JSONB NOT NULL,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_room_types_property_code UNIQUE (property_id, code),
  CONSTRAINT uq_room_types_property_id UNIQUE (property_id, id),
  CONSTRAINT chk_room_types_occupancy CHECK (
    base_occupancy >= 1 AND
    max_occupancy >= base_occupancy AND
    max_adults >= 1 AND
    max_adults <= max_occupancy AND
    max_children >= 0 AND
    max_children <= max_occupancy AND
    (max_adults + max_children) >= max_occupancy
  )
);

-- 4. Physical Rooms Table with Composite Hierarchy Constraints
CREATE TABLE IF NOT EXISTS pms_schema.rooms (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  building_id TEXT NOT NULL,
  floor_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  name VARCHAR(100),
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_rooms_property_room_number UNIQUE (property_id, room_number),
  CONSTRAINT fk_rooms_building_property FOREIGN KEY (property_id, building_id)
    REFERENCES platform_schema.buildings(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_rooms_floor_building FOREIGN KEY (building_id, floor_id)
    REFERENCES platform_schema.floors(building_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_rooms_room_type_property FOREIGN KEY (property_id, room_type_id)
    REFERENCES pms_schema.room_types(property_id, id) ON DELETE RESTRICT
);

-- 5. Rate Plans Table (UUIDv7 generated application-side as TEXT)
CREATE TABLE IF NOT EXISTS pms_schema.rate_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  currency VARCHAR(3) NOT NULL,
  meal_plan_code VARCHAR(20) NOT NULL DEFAULT 'RO',
  pricing_model VARCHAR(30) NOT NULL DEFAULT 'PER_ROOM',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_closed_to_arrival BOOLEAN NOT NULL DEFAULT false,
  is_closed_to_departure BOOLEAN NOT NULL DEFAULT false,
  min_stay_days INT NOT NULL DEFAULT 1,
  max_stay_days INT,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  cancellation_policy JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_rate_plans_property_code UNIQUE (property_id, code),
  CONSTRAINT uq_rate_plans_property_id UNIQUE (property_id, id),
  CONSTRAINT chk_rate_plans_stay_days CHECK (
    min_stay_days >= 1 AND (max_stay_days IS NULL OR max_stay_days >= min_stay_days)
  ),
  CONSTRAINT chk_rate_plans_validity CHECK (valid_to >= valid_from)
);

-- 6. Rate Plan Room Types (Soft-Delete & Active Partial Unique Index)
CREATE TABLE IF NOT EXISTS pms_schema.rate_plan_room_types (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  rate_plan_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  base_rate_amount DECIMAL(12, 4) NOT NULL,
  extra_adult_rate DECIMAL(12, 4) NOT NULL DEFAULT 0,
  extra_child_rate DECIMAL(12, 4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT fk_rprt_rate_plan_property FOREIGN KEY (property_id, rate_plan_id)
    REFERENCES pms_schema.rate_plans(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_rprt_room_type_property FOREIGN KEY (property_id, room_type_id)
    REFERENCES pms_schema.room_types(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_rprt_rates_non_negative CHECK (
    base_rate_amount >= 0 AND extra_adult_rate >= 0 AND extra_child_rate >= 0
  ),
  CONSTRAINT chk_rprt_active_not_deleted CHECK (
    NOT (is_active = true AND deleted_at IS NOT NULL)
  )
);

-- Active Partial Unique Index (Enforces canonical active state)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_rate_plan_room_types
  ON pms_schema.rate_plan_room_types (rate_plan_id, room_type_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- 7. Daily Rates (RESTRICT Delete Safety & Nullable Overrides)
CREATE TABLE IF NOT EXISTS pms_schema.daily_rates (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  rate_plan_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  business_date DATE NOT NULL,
  base_rate_amount DECIMAL(12, 4) NOT NULL,
  extra_adult_rate DECIMAL(12, 4),
  extra_child_rate DECIMAL(12, 4),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_closed_to_arrival BOOLEAN,
  is_closed_to_departure BOOLEAN,
  min_stay_days INT,
  max_stay_days INT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_daily_rates_plan_room_date UNIQUE (rate_plan_id, room_type_id, business_date),
  CONSTRAINT fk_daily_rates_rate_plan_property FOREIGN KEY (property_id, rate_plan_id)
    REFERENCES pms_schema.rate_plans(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_daily_rates_room_type_property FOREIGN KEY (property_id, room_type_id)
    REFERENCES pms_schema.room_types(property_id, id) ON DELETE RESTRICT
);

-- 8. Daily Inventory Operational Ledger
CREATE TABLE IF NOT EXISTS pms_schema.daily_inventory (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  room_type_id TEXT NOT NULL,
  business_date DATE NOT NULL,
  total_rooms INT NOT NULL DEFAULT 0,
  out_of_order_count INT NOT NULL DEFAULT 0,
  out_of_service_count INT NOT NULL DEFAULT 0,
  blocked_count INT NOT NULL DEFAULT 0,
  booked_count INT NOT NULL DEFAULT 0,
  overbooking_limit INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_daily_inventory_prop_type_date UNIQUE (property_id, room_type_id, business_date),
  CONSTRAINT fk_daily_inventory_room_type_property FOREIGN KEY (property_id, room_type_id)
    REFERENCES pms_schema.room_types(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_daily_inventory_non_negative CHECK (
    total_rooms >= 0 AND
    out_of_order_count >= 0 AND
    out_of_service_count >= 0 AND
    blocked_count >= 0 AND
    booked_count >= 0 AND
    overbooking_limit >= 0
  )
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_room_types_property_active ON pms_schema.room_types (property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_property_room_type ON pms_schema.rooms (property_id, room_type_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON pms_schema.rooms (floor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON pms_schema.rooms (building_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_property_active ON pms_schema.rate_plans (property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_rates_lookup ON pms_schema.daily_rates (property_id, business_date, room_type_id);
CREATE INDEX IF NOT EXISTS idx_daily_inventory_lookup ON pms_schema.daily_inventory (property_id, business_date, room_type_id);
