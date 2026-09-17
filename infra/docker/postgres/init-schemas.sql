-- Enterprise HMS Database Initialization
-- Creates domain schemas per 07-DATABASE-ARCHITECTURE.md
-- Architecture Freeze: September 16, 2026

CREATE SCHEMA IF NOT EXISTS platform_schema;
CREATE SCHEMA IF NOT EXISTS pms_schema;
CREATE SCHEMA IF NOT EXISTS operations_schema;
CREATE SCHEMA IF NOT EXISTS finance_schema;
CREATE SCHEMA IF NOT EXISTS crm_schema;
CREATE SCHEMA IF NOT EXISTS integration_schema;
CREATE SCHEMA IF NOT EXISTS audit_schema;
CREATE SCHEMA IF NOT EXISTS analytics_schema;

-- Grant usage on schemas to current user
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN (
            'platform_schema', 
            'pms_schema', 
            'operations_schema', 
            'finance_schema', 
            'crm_schema', 
            'integration_schema', 
            'audit_schema', 
            'analytics_schema'
        )
    LOOP
        EXECUTE format('GRANT ALL ON SCHEMA %I TO %I;', schema_record.schema_name, current_user);
    END LOOP;
END
$$;
