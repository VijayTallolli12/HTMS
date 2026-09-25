-- CreateSchema
CREATE SCHEMA IF NOT EXISTS spa_schema;

-- CreateTable spa_services
CREATE TABLE IF NOT EXISTS spa_schema.spa_services (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_spa_services PRIMARY KEY (id),
    CONSTRAINT uq_spa_service_property_code UNIQUE (property_id, code)
);

-- CreateTable spa_therapists
CREATE TABLE IF NOT EXISTS spa_schema.spa_therapists (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_spa_therapists PRIMARY KEY (id)
);

-- CreateTable spa_rooms
CREATE TABLE IF NOT EXISTS spa_schema.spa_rooms (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    name VARCHAR(50) NOT NULL,
    room_type VARCHAR(30) NOT NULL DEFAULT 'SINGLE',
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_spa_rooms PRIMARY KEY (id),
    CONSTRAINT uq_spa_room_property_name UNIQUE (property_id, name)
);

-- CreateTable spa_appointments
CREATE TABLE IF NOT EXISTS spa_schema.spa_appointments (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    appointment_number VARCHAR(30) NOT NULL,
    service_id TEXT NOT NULL,
    therapist_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    start_time TIMESTAMPTZ(6) NOT NULL,
    end_time TIMESTAMPTZ(6) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    guest_name VARCHAR(100),
    guest_phone VARCHAR(30),
    room_number VARCHAR(20),
    reservation_id TEXT,
    folio_id TEXT,
    folio_transaction_id TEXT,
    settlement_type VARCHAR(20),
    payment_method VARCHAR(20),
    notes TEXT,
    completed_at TIMESTAMPTZ(6),
    completed_by TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_spa_appointments PRIMARY KEY (id),
    CONSTRAINT uq_spa_appointment_number UNIQUE (property_id, appointment_number)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_spa_services_property_active ON spa_schema.spa_services (property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_spa_therapists_property_active ON spa_schema.spa_therapists (property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_spa_rooms_property_status ON spa_schema.spa_rooms (property_id, status);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_property_time ON spa_schema.spa_appointments (property_id, start_time);
CREATE INDEX IF NOT EXISTS idx_spa_therapist_schedule ON spa_schema.spa_appointments (property_id, therapist_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_spa_room_schedule ON spa_schema.spa_appointments (property_id, room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_status ON spa_schema.spa_appointments (property_id, status);

-- Add Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_services_property') THEN
        ALTER TABLE spa_schema.spa_services ADD CONSTRAINT fk_spa_services_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_therapists_property') THEN
        ALTER TABLE spa_schema.spa_therapists ADD CONSTRAINT fk_spa_therapists_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_rooms_property') THEN
        ALTER TABLE spa_schema.spa_rooms ADD CONSTRAINT fk_spa_rooms_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_appointments_property') THEN
        ALTER TABLE spa_schema.spa_appointments ADD CONSTRAINT fk_spa_appointments_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_appointments_service') THEN
        ALTER TABLE spa_schema.spa_appointments ADD CONSTRAINT fk_spa_appointments_service FOREIGN KEY (service_id) REFERENCES spa_schema.spa_services(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_appointments_therapist') THEN
        ALTER TABLE spa_schema.spa_appointments ADD CONSTRAINT fk_spa_appointments_therapist FOREIGN KEY (therapist_id) REFERENCES spa_schema.spa_therapists(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spa_appointments_room') THEN
        ALTER TABLE spa_schema.spa_appointments ADD CONSTRAINT fk_spa_appointments_room FOREIGN KEY (room_id) REFERENCES spa_schema.spa_rooms(id) ON DELETE RESTRICT;
    END IF;
END $$;

