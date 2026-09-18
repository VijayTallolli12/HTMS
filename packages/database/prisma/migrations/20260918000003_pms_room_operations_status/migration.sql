-- Enable btree_gist extension for GiST scalar indexing
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Alter Rooms table with operational status dimensions and OCC version
ALTER TABLE pms_schema.rooms
  ADD COLUMN IF NOT EXISTS housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'DIRTY',
  ADD COLUMN IF NOT EXISTS service_status VARCHAR(20) NOT NULL DEFAULT 'IN_SERVICE',
  ADD COLUMN IF NOT EXISTS occupancy_status VARCHAR(20) NOT NULL DEFAULT 'VACANT',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

-- Ensure all existing rows are initialized to DIRTY / IN_SERVICE / VACANT
UPDATE pms_schema.rooms
SET housekeeping_status = 'DIRTY',
    service_status = 'IN_SERVICE',
    occupancy_status = 'VACANT',
    version = 0
WHERE housekeeping_status IS NULL;

-- Composite unique constraint for composite FK referencing
ALTER TABLE pms_schema.rooms
  DROP CONSTRAINT IF EXISTS uq_rooms_property_id,
  ADD CONSTRAINT uq_rooms_property_id UNIQUE (property_id, id);

-- Check constraints for status dimensions
ALTER TABLE pms_schema.rooms
  DROP CONSTRAINT IF EXISTS chk_rooms_hk_status,
  ADD CONSTRAINT chk_rooms_hk_status CHECK (housekeeping_status IN ('DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'PICKUP'));

ALTER TABLE pms_schema.rooms
  DROP CONSTRAINT IF EXISTS chk_rooms_service_status,
  ADD CONSTRAINT chk_rooms_service_status CHECK (service_status IN ('IN_SERVICE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'));

ALTER TABLE pms_schema.rooms
  DROP CONSTRAINT IF EXISTS chk_rooms_occupancy_status,
  ADD CONSTRAINT chk_rooms_occupancy_status CHECK (occupancy_status IN ('VACANT', 'OCCUPIED'));

CREATE INDEX IF NOT EXISTS idx_rooms_property_hk_status ON pms_schema.rooms (property_id, housekeeping_status);
CREATE INDEX IF NOT EXISTS idx_rooms_property_service_status ON pms_schema.rooms (property_id, service_status);

-- 2. Room Maintenance Blocks Table (Authoritative OOO/OOS Schedule)
CREATE TABLE IF NOT EXISTS pms_schema.room_maintenance_blocks (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  room_id TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL,
  cancelled_by TEXT,
  cancellation_reason VARCHAR(255),
  cancelled_at TIMESTAMPTZ(6),
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_room_maintenance_blocks_prop_id UNIQUE (property_id, id),
  CONSTRAINT fk_rmb_room_property FOREIGN KEY (property_id, room_id) REFERENCES pms_schema.rooms(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_rmb_type CHECK (type IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')),
  CONSTRAINT chk_rmb_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')),
  CONSTRAINT chk_rmb_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_room_maintenance_lookup ON pms_schema.room_maintenance_blocks (property_id, room_id, status);
CREATE INDEX IF NOT EXISTS idx_room_maintenance_dates ON pms_schema.room_maintenance_blocks (property_id, start_date, end_date);

-- Authoritative GiST Exclusion Constraint: No overlapping active maintenance blocks for the same physical room
ALTER TABLE pms_schema.room_maintenance_blocks
  DROP CONSTRAINT IF EXISTS ex_room_maintenance_no_overlap;

ALTER TABLE pms_schema.room_maintenance_blocks
  ADD CONSTRAINT ex_room_maintenance_no_overlap
  EXCLUDE USING gist (
    property_id WITH =,
    room_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (status = 'ACTIVE' AND deleted_at IS NULL);

-- 3. Room Status Logs Table (Immutable Room Status Audit Ledger)
CREATE TABLE IF NOT EXISTS pms_schema.room_status_logs (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  room_id TEXT NOT NULL,
  previous_housekeeping_status VARCHAR(20),
  new_housekeeping_status VARCHAR(20),
  previous_service_status VARCHAR(20),
  new_service_status VARCHAR(20),
  reason VARCHAR(255),
  source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  changed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rsl_room_property FOREIGN KEY (property_id, room_id) REFERENCES pms_schema.rooms(property_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_room_status_logs_lookup ON pms_schema.room_status_logs (property_id, room_id, created_at);
