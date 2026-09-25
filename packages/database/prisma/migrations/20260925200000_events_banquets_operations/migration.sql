-- CreateSchema
CREATE SCHEMA IF NOT EXISTS events_schema;

-- CreateTable event_venues
CREATE TABLE IF NOT EXISTS events_schema.event_venues (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    venue_type VARCHAR(30) NOT NULL DEFAULT 'BALLROOM',
    capacity INTEGER NOT NULL,
    location VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event_venues PRIMARY KEY (id),
    CONSTRAINT uq_event_venue_property_code UNIQUE (property_id, code)
);

-- CreateTable event_packages
CREATE TABLE IF NOT EXISTS events_schema.event_packages (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_per_guest DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    min_guests INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event_packages PRIMARY KEY (id),
    CONSTRAINT uq_event_package_property_code UNIQUE (property_id, code)
);

-- CreateTable event_resources
CREATE TABLE IF NOT EXISTS events_schema.event_resources (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    resource_type VARCHAR(30) NOT NULL DEFAULT 'EQUIPMENT',
    total_quantity INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event_resources PRIMARY KEY (id),
    CONSTRAINT uq_event_resource_property_name UNIQUE (property_id, name)
);

-- CreateTable event_bookings
CREATE TABLE IF NOT EXISTS events_schema.event_bookings (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    booking_number VARCHAR(30) NOT NULL,
    venue_id TEXT NOT NULL,
    package_id TEXT,
    host_name VARCHAR(100) NOT NULL,
    host_email VARCHAR(100),
    host_phone VARCHAR(30),
    event_name VARCHAR(150) NOT NULL,
    event_type VARCHAR(30) NOT NULL DEFAULT 'CONFERENCE',
    start_time TIMESTAMPTZ(6) NOT NULL,
    end_time TIMESTAMPTZ(6) NOT NULL,
    expected_guests INTEGER NOT NULL,
    estimated_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    room_number VARCHAR(20),
    reservation_id TEXT,
    folio_id TEXT,
    folio_transaction_id TEXT,
    settlement_type VARCHAR(20),
    payment_method VARCHAR(20),
    completed_at TIMESTAMPTZ(6),
    completed_by TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event_bookings PRIMARY KEY (id),
    CONSTRAINT uq_event_booking_number UNIQUE (property_id, booking_number)
);

-- CreateTable event_booking_resources
CREATE TABLE IF NOT EXISTS events_schema.event_booking_resources (
    id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event_booking_resources PRIMARY KEY (id),
    CONSTRAINT uq_booking_resource UNIQUE (booking_id, resource_id)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_event_venues_property ON events_schema.event_venues (property_id);
CREATE INDEX IF NOT EXISTS idx_event_packages_property ON events_schema.event_packages (property_id);
CREATE INDEX IF NOT EXISTS idx_event_resources_property ON events_schema.event_resources (property_id);
CREATE INDEX IF NOT EXISTS idx_event_bookings_property_time ON events_schema.event_bookings (property_id, start_time);
CREATE INDEX IF NOT EXISTS idx_event_venue_schedule ON events_schema.event_bookings (property_id, venue_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_event_bookings_status ON events_schema.event_bookings (property_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_resources_booking ON events_schema.event_booking_resources (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_resources_resource ON events_schema.event_booking_resources (resource_id);

-- Add Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_venues_property') THEN
        ALTER TABLE events_schema.event_venues ADD CONSTRAINT fk_event_venues_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_packages_property') THEN
        ALTER TABLE events_schema.event_packages ADD CONSTRAINT fk_event_packages_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_resources_property') THEN
        ALTER TABLE events_schema.event_resources ADD CONSTRAINT fk_event_resources_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_bookings_property') THEN
        ALTER TABLE events_schema.event_bookings ADD CONSTRAINT fk_event_bookings_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_bookings_venue') THEN
        ALTER TABLE events_schema.event_bookings ADD CONSTRAINT fk_event_bookings_venue FOREIGN KEY (venue_id) REFERENCES events_schema.event_venues(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_bookings_package') THEN
        ALTER TABLE events_schema.event_bookings ADD CONSTRAINT fk_event_bookings_package FOREIGN KEY (package_id) REFERENCES events_schema.event_packages(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_booking_resources_booking') THEN
        ALTER TABLE events_schema.event_booking_resources ADD CONSTRAINT fk_event_booking_resources_booking FOREIGN KEY (booking_id) REFERENCES events_schema.event_bookings(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_booking_resources_resource') THEN
        ALTER TABLE events_schema.event_booking_resources ADD CONSTRAINT fk_event_booking_resources_resource FOREIGN KEY (resource_id) REFERENCES events_schema.event_resources(id) ON DELETE RESTRICT;
    END IF;
END $$;

