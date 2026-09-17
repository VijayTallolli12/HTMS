-- CreateTable
CREATE TABLE "platform_schema"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "default_property_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."user_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."password_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."organization_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hotel_group_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."roles" (
    "id" TEXT NOT NULL,
    "hotel_group_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."user_role_scopes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "hotel_group_id" TEXT,
    "region_id" TEXT,
    "country_id" TEXT,
    "property_id" TEXT,
    "department_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_role_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_schema"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "token_family" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_schema"."security_audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "outcome" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" TEXT,
    "details" JSONB,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "platform_schema"."users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "platform_schema"."users"("status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "platform_schema"."users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_default_property_id_idx" ON "platform_schema"."users"("default_property_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_user_id_key" ON "platform_schema"."user_credentials"("user_id");

-- CreateIndex
CREATE INDEX "password_histories_user_id_created_at_idx" ON "platform_schema"."password_histories"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_idx" ON "platform_schema"."organization_memberships"("user_id");

-- CreateIndex
CREATE INDEX "organization_memberships_hotel_group_id_idx" ON "platform_schema"."organization_memberships"("hotel_group_id");

-- CreateIndex
CREATE INDEX "organization_memberships_status_idx" ON "platform_schema"."organization_memberships"("status");

-- CreateIndex
CREATE INDEX "organization_memberships_deleted_at_idx" ON "platform_schema"."organization_memberships"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_user_id_hotel_group_id_key" ON "platform_schema"."organization_memberships"("user_id", "hotel_group_id");

-- CreateIndex
CREATE INDEX "roles_hotel_group_id_idx" ON "platform_schema"."roles"("hotel_group_id");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "platform_schema"."roles"("code");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "platform_schema"."roles"("is_system");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "platform_schema"."roles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "platform_schema"."permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "platform_schema"."permissions"("module");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "platform_schema"."role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "platform_schema"."role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "platform_schema"."role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_user_id_idx" ON "platform_schema"."user_role_scopes"("user_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_role_id_idx" ON "platform_schema"."user_role_scopes"("role_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_scope_type_idx" ON "platform_schema"."user_role_scopes"("scope_type");

-- CreateIndex
CREATE INDEX "user_role_scopes_hotel_group_id_idx" ON "platform_schema"."user_role_scopes"("hotel_group_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_region_id_idx" ON "platform_schema"."user_role_scopes"("region_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_country_id_idx" ON "platform_schema"."user_role_scopes"("country_id");

-- CreateIndex
CREATE INDEX "user_role_scopes_property_id_idx" ON "platform_schema"."user_role_scopes"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "platform_schema"."auth_sessions"("session_token");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "platform_schema"."auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_session_token_idx" ON "platform_schema"."auth_sessions"("session_token");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "platform_schema"."auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_revoked_at_idx" ON "platform_schema"."auth_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "platform_schema"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "platform_schema"."refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_family_idx" ON "platform_schema"."refresh_tokens"("token_family");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "platform_schema"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_timestamp_idx" ON "audit_schema"."security_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "security_audit_logs_actor_id_idx" ON "audit_schema"."security_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_action_idx" ON "audit_schema"."security_audit_logs"("action");

-- CreateIndex
CREATE INDEX "security_audit_logs_resource_type_resource_id_idx" ON "audit_schema"."security_audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_correlation_id_idx" ON "audit_schema"."security_audit_logs"("correlation_id");

-- AddForeignKey
ALTER TABLE "platform_schema"."users" ADD CONSTRAINT "users_default_property_id_fkey" FOREIGN KEY ("default_property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_schema"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."password_histories" ADD CONSTRAINT "password_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_schema"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_schema"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."organization_memberships" ADD CONSTRAINT "organization_memberships_hotel_group_id_fkey" FOREIGN KEY ("hotel_group_id") REFERENCES "platform_schema"."hotel_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."roles" ADD CONSTRAINT "roles_hotel_group_id_fkey" FOREIGN KEY ("hotel_group_id") REFERENCES "platform_schema"."hotel_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_schema"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform_schema"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_schema"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_schema"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_hotel_group_id_fkey" FOREIGN KEY ("hotel_group_id") REFERENCES "platform_schema"."hotel_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "platform_schema"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "platform_schema"."countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."user_role_scopes" ADD CONSTRAINT "user_role_scopes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "platform_schema"."properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_schema"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "platform_schema"."auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_schema"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "platform_schema"."refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==============================================================================
-- POSTGRESQL-SPECIFIC CONSTRAINTS & IMMUTABILITY (W1-T03 T02)
-- ==============================================================================

-- 1. Case-Insensitive Email Uniqueness Index
CREATE UNIQUE INDEX "users_email_lower_idx" ON "platform_schema"."users" (LOWER("email"));

-- 2. Role Uniqueness Partial Unique Indexes
-- System roles (hotel_group_id IS NULL): code must be globally unique
CREATE UNIQUE INDEX "roles_system_code_unique_idx" ON "platform_schema"."roles" ("code")
WHERE "hotel_group_id" IS NULL;

-- Custom roles (hotel_group_id IS NOT NULL): code must be unique within hotel group
CREATE UNIQUE INDEX "roles_custom_hotel_group_code_unique_idx" ON "platform_schema"."roles" ("hotel_group_id", "code")
WHERE "hotel_group_id" IS NOT NULL;

-- 3. UserRoleScope Hierarchy Field Combination CHECK Constraint
ALTER TABLE "platform_schema"."user_role_scopes"
ADD CONSTRAINT "chk_user_role_scope_valid_combinations" CHECK (
  (
    scope_type = 'GLOBAL' AND
    hotel_group_id IS NULL AND
    region_id IS NULL AND
    country_id IS NULL AND
    property_id IS NULL AND
    department_code IS NULL
  ) OR (
    scope_type = 'GROUP' AND
    hotel_group_id IS NOT NULL AND
    region_id IS NULL AND
    country_id IS NULL AND
    property_id IS NULL AND
    department_code IS NULL
  ) OR (
    scope_type = 'REGION' AND
    hotel_group_id IS NULL AND
    region_id IS NOT NULL AND
    country_id IS NULL AND
    property_id IS NULL AND
    department_code IS NULL
  ) OR (
    scope_type = 'COUNTRY' AND
    hotel_group_id IS NULL AND
    region_id IS NULL AND
    country_id IS NOT NULL AND
    property_id IS NULL AND
    department_code IS NULL
  ) OR (
    scope_type = 'PROPERTY' AND
    hotel_group_id IS NULL AND
    region_id IS NULL AND
    country_id IS NULL AND
    property_id IS NOT NULL AND
    department_code IS NULL
  ) OR (
    scope_type = 'DEPARTMENT' AND
    hotel_group_id IS NULL AND
    region_id IS NULL AND
    country_id IS NULL AND
    property_id IS NOT NULL AND
    department_code IS NOT NULL
  )
);

-- 4. UserRoleScope Equivalent Assignment Uniqueness (Handling NULL semantics via partial indexes)
CREATE UNIQUE INDEX "uq_user_role_scope_global" ON "platform_schema"."user_role_scopes" ("user_id", "role_id")
WHERE "scope_type" = 'GLOBAL';

CREATE UNIQUE INDEX "uq_user_role_scope_group" ON "platform_schema"."user_role_scopes" ("user_id", "role_id", "hotel_group_id")
WHERE "scope_type" = 'GROUP';

CREATE UNIQUE INDEX "uq_user_role_scope_region" ON "platform_schema"."user_role_scopes" ("user_id", "role_id", "region_id")
WHERE "scope_type" = 'REGION';

CREATE UNIQUE INDEX "uq_user_role_scope_country" ON "platform_schema"."user_role_scopes" ("user_id", "role_id", "country_id")
WHERE "scope_type" = 'COUNTRY';

CREATE UNIQUE INDEX "uq_user_role_scope_property" ON "platform_schema"."user_role_scopes" ("user_id", "role_id", "property_id")
WHERE "scope_type" = 'PROPERTY';

CREATE UNIQUE INDEX "uq_user_role_scope_department" ON "platform_schema"."user_role_scopes" ("user_id", "role_id", "property_id", "department_code")
WHERE "scope_type" = 'DEPARTMENT';

-- 5. Security Audit Log Immutability (Append-Only Ledger Protection)
CREATE OR REPLACE FUNCTION audit_schema.prevent_security_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_schema.security_audit_logs is append-only. UPDATE and DELETE operations are strictly prohibited.'
        USING ERRCODE = '27000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_security_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_schema.security_audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_schema.prevent_security_audit_log_modification();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_schema.security_audit_logs FROM PUBLIC;
GRANT SELECT, INSERT ON audit_schema.security_audit_logs TO PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app_role') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_schema.security_audit_logs FROM hms_app_role;
        GRANT SELECT, INSERT ON audit_schema.security_audit_logs TO hms_app_role;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_user') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_schema.security_audit_logs FROM hms_user;
        GRANT SELECT, INSERT ON audit_schema.security_audit_logs TO hms_user;
    END IF;
END
$$;

-- 6. Role System vs Custom Consistency CHECK Constraint
ALTER TABLE "platform_schema"."roles"
ADD CONSTRAINT "chk_roles_system_custom_consistency" CHECK (
  (
    is_system = TRUE
    AND hotel_group_id IS NULL
  )
  OR
  (
    is_system = FALSE
    AND hotel_group_id IS NOT NULL
  )
);
