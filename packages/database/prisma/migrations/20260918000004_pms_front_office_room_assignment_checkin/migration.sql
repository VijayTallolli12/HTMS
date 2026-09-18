-- Enable btree_gist extension for GiST scalar indexing
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Alter Reservations table with assignment and check-in fields
ALTER TABLE pms_schema.reservations
  ADD COLUMN IF NOT EXISTS assigned_room_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS assigned_by TEXT,
  ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS checked_in_by TEXT,
  ADD COLUMN IF NOT EXISTS check_in_idempotency_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS check_in_payload_hash VARCHAR(64);

-- Composite Foreign Key to physical Room within same property
ALTER TABLE pms_schema.reservations
  DROP CONSTRAINT IF EXISTS fk_reservations_assigned_room;

ALTER TABLE pms_schema.reservations
  ADD CONSTRAINT fk_reservations_assigned_room
  FOREIGN KEY (property_id, assigned_room_id)
  REFERENCES pms_schema.rooms(property_id, id)
  ON DELETE RESTRICT;

-- Unique constraint for check-in idempotency per property
ALTER TABLE pms_schema.reservations
  DROP CONSTRAINT IF EXISTS uq_reservations_checkin_idempotency;

ALTER TABLE pms_schema.reservations
  ADD CONSTRAINT uq_reservations_checkin_idempotency
  UNIQUE (property_id, check_in_idempotency_key);

-- Indexes for room assignment lookup
CREATE INDEX IF NOT EXISTS idx_reservations_property_assigned_room
  ON pms_schema.reservations (property_id, assigned_room_id);

-- 2. Reservation Assignment Logs Table (Immutable Room Assignment Audit Ledger)
CREATE TABLE IF NOT EXISTS pms_schema.reservation_assignment_logs (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  reservation_id TEXT NOT NULL,
  previous_room_id TEXT,
  new_room_id TEXT,
  action VARCHAR(30) NOT NULL,
  reason VARCHAR(255),
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ral_reservation FOREIGN KEY (property_id, reservation_id) REFERENCES pms_schema.reservations(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_ral_prev_room FOREIGN KEY (property_id, previous_room_id) REFERENCES pms_schema.rooms(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_ral_new_room FOREIGN KEY (property_id, new_room_id) REFERENCES pms_schema.rooms(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_ral_action CHECK (action IN ('ASSIGN', 'UNASSIGN', 'REASSIGN'))
);

CREATE INDEX IF NOT EXISTS idx_res_assignment_logs_lookup
  ON pms_schema.reservation_assignment_logs (property_id, reservation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_room_assignment_logs_lookup
  ON pms_schema.reservation_assignment_logs (property_id, new_room_id, created_at);

-- 3. PostgreSQL GiST Exclusion Constraint: No overlapping active room assignments for the same physical room
ALTER TABLE pms_schema.reservations
  DROP CONSTRAINT IF EXISTS exclude_overlapping_room_assignments;

ALTER TABLE pms_schema.reservations
  ADD CONSTRAINT exclude_overlapping_room_assignments
  EXCLUDE USING gist (
    property_id WITH =,
    assigned_room_id WITH =,
    daterange(arrival_date, departure_date, '[)') WITH &&
  )
  WHERE (
    assigned_room_id IS NOT NULL
    AND status IN ('CONFIRMED', 'CHECKED_IN')
    AND deleted_at IS NULL
  );
