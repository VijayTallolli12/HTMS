-- Create guest_crm_profiles table
CREATE TABLE pms_schema.guest_crm_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id             TEXT NOT NULL,
    guest_id                TEXT NOT NULL UNIQUE,
    vip_flag                BOOLEAN NOT NULL DEFAULT false,
    notes                   TEXT,
    communication_preferences JSONB,
    marketing_consent       BOOLEAN NOT NULL DEFAULT false,
    tags                    TEXT[] NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.guest_crm_profiles ADD CONSTRAINT fk_crm_profile_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.guest_crm_profiles ADD CONSTRAINT fk_crm_profile_guest
    FOREIGN KEY (property_id, guest_id) REFERENCES pms_schema.guests(property_id, id) ON DELETE CASCADE;

CREATE INDEX idx_crm_profile_vip ON pms_schema.guest_crm_profiles(property_id, vip_flag);
CREATE UNIQUE INDEX uq_crm_profile_guest ON pms_schema.guest_crm_profiles(property_id, guest_id);

-- Create guest_preferences table
CREATE TABLE pms_schema.guest_preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT NOT NULL,
    guest_id    TEXT NOT NULL,
    category    VARCHAR(50) NOT NULL,
    preference  VARCHAR(100) NOT NULL,
    value       VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE pms_schema.guest_preferences ADD CONSTRAINT fk_guest_preference_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.guest_preferences ADD CONSTRAINT fk_guest_preference_guest
    FOREIGN KEY (property_id, guest_id) REFERENCES pms_schema.guests(property_id, id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_guest_preference_unique ON pms_schema.guest_preferences(property_id, guest_id, category, preference);
CREATE INDEX idx_guest_preferences_guest ON pms_schema.guest_preferences(property_id, guest_id);

-- Create loyalty_memberships table
CREATE TABLE pms_schema.loyalty_memberships (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id       TEXT NOT NULL,
    guest_id          TEXT NOT NULL UNIQUE,
    membership_number VARCHAR(30) NOT NULL UNIQUE,
    tier              VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    points_balance    INT NOT NULL DEFAULT 0,
    lifetime_points   INT NOT NULL DEFAULT 0,
    joined_date       DATE NOT NULL,
    active            BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.loyalty_memberships ADD CONSTRAINT fk_loyalty_membership_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.loyalty_memberships ADD CONSTRAINT fk_loyalty_membership_guest
    FOREIGN KEY (property_id, guest_id) REFERENCES pms_schema.guests(property_id, id) ON DELETE CASCADE;

CREATE INDEX idx_loyalty_membership_tier ON pms_schema.loyalty_memberships(property_id, tier);
CREATE INDEX idx_loyalty_membership_active ON pms_schema.loyalty_memberships(property_id, active);
CREATE UNIQUE INDEX uq_loyalty_membership_guest ON pms_schema.loyalty_memberships(property_id, guest_id);
CREATE UNIQUE INDEX uq_loyalty_membership_property_id ON pms_schema.loyalty_memberships(property_id, id);

-- Create loyalty_transactions table
CREATE TABLE pms_schema.loyalty_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id       TEXT NOT NULL,
    membership_id     UUID NOT NULL,
    type              VARCHAR(20) NOT NULL,
    points            INT NOT NULL,
    reference         VARCHAR(64),
    reference_type    VARCHAR(30),
    description       VARCHAR(500),
    idempotency_key   VARCHAR(64) UNIQUE,
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE pms_schema.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_membership
    FOREIGN KEY (property_id, membership_id) REFERENCES pms_schema.loyalty_memberships(property_id, id) ON DELETE CASCADE;

CREATE INDEX idx_loyalty_tx_membership_date ON pms_schema.loyalty_transactions(property_id, membership_id, created_at DESC);
CREATE INDEX idx_loyalty_tx_idempotency ON pms_schema.loyalty_transactions(property_id, idempotency_key);