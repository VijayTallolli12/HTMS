-- 1. Guests Table (Operational Property-Local Guest Profiles)
CREATE TABLE IF NOT EXISTS pms_schema.guests (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(30),
  identification_type VARCHAR(30),
  identification_number VARCHAR(50),
  crm_profile_id TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_guests_property_id UNIQUE (property_id, id)
);

CREATE INDEX IF NOT EXISTS idx_guests_property_name ON pms_schema.guests (property_id, last_name);
CREATE INDEX IF NOT EXISTS idx_guests_property_email ON pms_schema.guests (property_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_property_phone ON pms_schema.guests (property_id, phone);

-- 2. Reservations Table (Central Reservation Aggregate Root)
CREATE TABLE IF NOT EXISTS pms_schema.reservations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES platform_schema.properties(id) ON DELETE RESTRICT,
  confirmation_number VARCHAR(30) NOT NULL,
  idempotency_key VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  guest_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  rate_plan_id TEXT NOT NULL,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  adults_count INT NOT NULL DEFAULT 1,
  children_count INT NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  special_requests TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ(6),
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ(6),
  CONSTRAINT uq_reservations_property_id UNIQUE (property_id, id),
  CONSTRAINT uq_reservations_property_confirmation_number UNIQUE (property_id, confirmation_number),
  CONSTRAINT uq_reservations_property_idempotency_key UNIQUE (property_id, idempotency_key),
  CONSTRAINT fk_reservations_guest_property FOREIGN KEY (property_id, guest_id) REFERENCES pms_schema.guests(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_room_type_property FOREIGN KEY (property_id, room_type_id) REFERENCES pms_schema.room_types(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_rate_plan_property FOREIGN KEY (property_id, rate_plan_id) REFERENCES pms_schema.rate_plans(property_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_reservations_dates CHECK (departure_date > arrival_date),
  CONSTRAINT chk_reservations_occupancy CHECK (adults_count >= 1 AND children_count >= 0),
  CONSTRAINT chk_reservations_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_reservations_status CHECK (status IN ('CONFIRMED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_lookup ON pms_schema.reservations (property_id, status, arrival_date);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON pms_schema.reservations (property_id, guest_id);

-- 3. Reservation Rate Nights Table (Immutable Nightly Pricing Snapshot)
CREATE TABLE IF NOT EXISTS pms_schema.reservation_rate_nights (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  business_date DATE NOT NULL,
  base_rate_amount DECIMAL(12, 4) NOT NULL,
  extra_adult_rate DECIMAL(12, 4) NOT NULL DEFAULT 0,
  extra_child_rate DECIMAL(12, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_reservation_rate_nights_res_date UNIQUE (reservation_id, business_date),
  CONSTRAINT fk_res_rate_nights_reservation_property FOREIGN KEY (property_id, reservation_id) REFERENCES pms_schema.reservations(property_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_res_rate_nights_amount CHECK (total_amount >= 0 AND base_rate_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reservation_rate_nights_lookup ON pms_schema.reservation_rate_nights (property_id, business_date);
