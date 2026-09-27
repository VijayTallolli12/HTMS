-- Create employees table
CREATE TABLE pms_schema.employees (
    id                TEXT PRIMARY KEY,
    property_id       TEXT NOT NULL,
    employee_code     VARCHAR(30) NOT NULL,
    first_name        VARCHAR(50) NOT NULL,
    last_name         VARCHAR(50) NOT NULL,
    email             VARCHAR(100),
    phone             VARCHAR(30),
    hire_date         DATE NOT NULL,
    termination_date  DATE,
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    department        VARCHAR(50),
    position          VARCHAR(50),
    version           INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.employees ADD CONSTRAINT fk_employee_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_employee_property_code ON pms_schema.employees(property_id, employee_code);
CREATE UNIQUE INDEX uq_employee_property_id ON pms_schema.employees(property_id, id);
CREATE INDEX idx_employee_property_status ON pms_schema.employees(property_id, status);

-- Create employee_compensations table
CREATE TABLE pms_schema.employee_compensations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id          TEXT NOT NULL,
    employee_id          TEXT NOT NULL,
    effective_date       DATE NOT NULL,
    basic_salary         DECIMAL(12, 4) NOT NULL,
    housing_allowance    DECIMAL(12, 4) NOT NULL DEFAULT 0,
    transport_allowance  DECIMAL(12, 4) NOT NULL DEFAULT 0,
    other_allowance      DECIMAL(12, 4) NOT NULL DEFAULT 0,
    currency             VARCHAR(3) NOT NULL DEFAULT 'JPY',
    version              INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.employee_compensations ADD CONSTRAINT fk_compensation_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.employee_compensations ADD CONSTRAINT fk_compensation_employee
    FOREIGN KEY (property_id, employee_id) REFERENCES pms_schema.employees(property_id, id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_compensation_property_id ON pms_schema.employee_compensations(property_id, id);
CREATE UNIQUE INDEX uq_compensation_employee_effective ON pms_schema.employee_compensations(property_id, employee_id, effective_date);
CREATE INDEX idx_compensation_employee ON pms_schema.employee_compensations(property_id, employee_id);

-- Create payroll_periods table
CREATE TABLE pms_schema.payroll_periods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id  TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    processed_at TIMESTAMPTZ(6),
    processed_by UUID,
    version      INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.payroll_periods ADD CONSTRAINT fk_payroll_period_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_payroll_period_property_id ON pms_schema.payroll_periods(property_id, id);
CREATE UNIQUE INDEX uq_payroll_period_dates ON pms_schema.payroll_periods(property_id, period_start, period_end);
CREATE INDEX idx_payroll_period_status ON pms_schema.payroll_periods(property_id, status);

-- Create payroll_runs table
CREATE TABLE pms_schema.payroll_runs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id        TEXT NOT NULL,
    payroll_period_id  UUID NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    total_gross        DECIMAL(12, 4) NOT NULL DEFAULT 0,
    total_deductions   DECIMAL(12, 4) NOT NULL DEFAULT 0,
    total_net          DECIMAL(12, 4) NOT NULL DEFAULT 0,
    calculated_at      TIMESTAMPTZ(6),
    calculated_by      UUID,
    finalized_at       TIMESTAMPTZ(6),
    finalized_by       UUID,
    idempotency_key    VARCHAR(64) UNIQUE,
    version            INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.payroll_runs ADD CONSTRAINT fk_payroll_run_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.payroll_runs ADD CONSTRAINT fk_payroll_run_period
    FOREIGN KEY (property_id, payroll_period_id) REFERENCES pms_schema.payroll_periods(property_id, id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_payroll_run_property_id ON pms_schema.payroll_runs(property_id, id);
CREATE INDEX idx_payroll_run_period ON pms_schema.payroll_runs(property_id, payroll_period_id);
CREATE INDEX idx_payroll_run_status ON pms_schema.payroll_runs(property_id, status);
CREATE UNIQUE INDEX uq_payroll_run_idempotency ON pms_schema.payroll_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Create payroll_lines table
CREATE TABLE pms_schema.payroll_lines (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id          TEXT NOT NULL,
    payroll_run_id       UUID NOT NULL,
    employee_id          TEXT NOT NULL,
    basic                DECIMAL(12, 4) NOT NULL,
    housing_allowance    DECIMAL(12, 4) NOT NULL DEFAULT 0,
    transport_allowance  DECIMAL(12, 4) NOT NULL DEFAULT 0,
    other_allowance      DECIMAL(12, 4) NOT NULL DEFAULT 0,
    overtime             DECIMAL(12, 4) NOT NULL DEFAULT 0,
    gross                DECIMAL(12, 4) NOT NULL,
    deductions           DECIMAL(12, 4) NOT NULL DEFAULT 0,
    net                  DECIMAL(12, 4) NOT NULL,
    currency             VARCHAR(3) NOT NULL DEFAULT 'JPY',
    version              INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ(6)
);

ALTER TABLE pms_schema.payroll_lines ADD CONSTRAINT fk_payroll_line_property
    FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT;
ALTER TABLE pms_schema.payroll_lines ADD CONSTRAINT fk_payroll_line_run
    FOREIGN KEY (property_id, payroll_run_id) REFERENCES pms_schema.payroll_runs(property_id, id) ON DELETE CASCADE;
ALTER TABLE pms_schema.payroll_lines ADD CONSTRAINT fk_payroll_line_employee
    FOREIGN KEY (property_id, employee_id) REFERENCES pms_schema.employees(property_id, id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_payroll_line_property_id ON pms_schema.payroll_lines(property_id, id);
CREATE UNIQUE INDEX uq_payroll_line_run_employee ON pms_schema.payroll_lines(payroll_run_id, employee_id);
CREATE INDEX idx_payroll_line_run ON pms_schema.payroll_lines(property_id, payroll_run_id);
CREATE INDEX idx_payroll_line_employee ON pms_schema.payroll_lines(property_id, employee_id);

-- Create enums
CREATE TYPE pms_schema.employment_status AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE');
CREATE TYPE pms_schema.payroll_period_status AS ENUM ('OPEN', 'PROCESSING', 'PROCESSED', 'CLOSED');
CREATE TYPE pms_schema.payroll_run_status AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'FINALIZED');

-- Update tables to use enum types (remove default first, then alter, then set new default)
ALTER TABLE pms_schema.employees ALTER COLUMN status DROP DEFAULT;
ALTER TABLE pms_schema.employees ALTER COLUMN status TYPE pms_schema.employment_status USING status::pms_schema.employment_status;
ALTER TABLE pms_schema.employees ALTER COLUMN status SET DEFAULT 'ACTIVE'::pms_schema.employment_status;

ALTER TABLE pms_schema.payroll_periods ALTER COLUMN status DROP DEFAULT;
ALTER TABLE pms_schema.payroll_periods ALTER COLUMN status TYPE pms_schema.payroll_period_status USING status::pms_schema.payroll_period_status;
ALTER TABLE pms_schema.payroll_periods ALTER COLUMN status SET DEFAULT 'OPEN'::pms_schema.payroll_period_status;

ALTER TABLE pms_schema.payroll_runs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE pms_schema.payroll_runs ALTER COLUMN status TYPE pms_schema.payroll_run_status USING status::pms_schema.payroll_run_status;
ALTER TABLE pms_schema.payroll_runs ALTER COLUMN status SET DEFAULT 'DRAFT'::pms_schema.payroll_run_status;