-- CreateTable
CREATE TABLE IF NOT EXISTS pms_schema.property_business_dates (
    property_id TEXT NOT NULL,
    current_business_date DATE NOT NULL,
    previous_business_date DATE,
    is_audit_in_progress BOOLEAN NOT NULL DEFAULT false,
    last_audit_run_id TEXT,
    last_audited_at TIMESTAMPTZ(6),
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_property_business_dates PRIMARY KEY (property_id)
);

-- CreateTable
CREATE TABLE IF NOT EXISTS pms_schema.night_audit_runs (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    business_date DATE NOT NULL,
    next_business_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    executed_by TEXT NOT NULL,
    started_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ(6),
    failure_reason VARCHAR(1000),
    metrics JSONB,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_night_audit_runs PRIMARY KEY (id),
    CONSTRAINT uq_night_audit_property_date UNIQUE (property_id, business_date)
);

-- CreateTable
CREATE TABLE IF NOT EXISTS pms_schema.night_audit_steps (
    id TEXT NOT NULL,
    audit_run_id TEXT NOT NULL,
    step_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    order_index INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMPTZ(6),
    completed_at TIMESTAMPTZ(6),
    items_processed INTEGER NOT NULL DEFAULT 0,
    details JSONB,
    error_message VARCHAR(1000),

    CONSTRAINT pk_night_audit_steps PRIMARY KEY (id),
    CONSTRAINT uq_night_audit_steps_run_key UNIQUE (audit_run_id, step_key)
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_night_audit_property_status ON pms_schema.night_audit_runs (property_id, status);

-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_night_audit_steps_order ON pms_schema.night_audit_steps (audit_run_id, order_index);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pbd_property'
    ) THEN
        ALTER TABLE pms_schema.property_business_dates ADD CONSTRAINT fk_pbd_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pbd_last_run'
    ) THEN
        ALTER TABLE pms_schema.property_business_dates ADD CONSTRAINT fk_pbd_last_run FOREIGN KEY (last_audit_run_id) REFERENCES pms_schema.night_audit_runs(id) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_nar_property'
    ) THEN
        ALTER TABLE pms_schema.night_audit_runs ADD CONSTRAINT fk_nar_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_nas_audit_run'
    ) THEN
        ALTER TABLE pms_schema.night_audit_steps ADD CONSTRAINT fk_nas_audit_run FOREIGN KEY (audit_run_id) REFERENCES pms_schema.night_audit_runs(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

