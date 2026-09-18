# 05 — API & Security Rules

Concise rules for API contract governance, authentication, tenant isolation, and authorization. Existing documents under `docs/` remain the source of truth.

---

## 1. API Contract Governance

- **OpenAPI 3.1 & Shared Types**: All DTOs, requests, responses, and enums must be defined in `packages/api-contracts`. Source: `docs/08-API-CONTRACTS.md`.
- **Standard Envelopes**:
  - Success: `{ success: true, data: T, meta?: Record<string, unknown> }`.
  - Error: RFC 7807 Problem Details (`{ type, title, status, detail, instance, invalidParams }`). Source: `docs/08-API-CONTRACTS.md`.
- **Idempotency**: All mutating state endpoints (POST/PUT) must support optional or required `Idempotency-Key` headers. Re-submitting with the same key returns the identical response without side effects. Source: `docs/08-API-CONTRACTS.md`.

---

## 2. Authentication & Session Security

- **JWT RS256**: Stateless JWT signed with RS256 private key, validated against public JWKS. Source: `docs/12-SECURITY-ARCHITECTURE.md`.
- **Zero Trust Client Scoping**: Never trust client-supplied tenant, property, or user IDs. All authorization context must derive from validated claims inside the verified JWT. Source: `docs/12-SECURITY-ARCHITECTURE.md`.

---

## 3. Scoped Authorization (RBAC + ABAC)

- **Mandatory Property Context**: Operational endpoints must use `@RequirePropertyContext()` to ensure the request target matches an authorized property claim. Source: `docs/adr/ADR-0005-unified-identity-rbac-scoping.md`.
- **Granular Permissions**: Endpoints protected by `@RequirePermissions(...)` using the dot-delimited lowercase convention:
  `<domain>.<resource>.<action>`
  - Examples: `pms.room.read`, `front_office.reservation.create`, `room_operations.status.update`, `room_operations.maintenance.create`. Source: `docs/04-USER-ROLES-PERMISSIONS.md`.
- **Guard Execution**: Enforced by NestJS global `ScopedRbacGuard`. Cross-property leakage is blocked before controller execution. Source: `docs/04-USER-ROLES-PERMISSIONS.md`.

---

## 4. Audit Trail & Compliance

- **Immutable Audit Logging**: All sensitive mutations (status changes, maintenance blocks, reservation edits) record user ID, property ID, old/new states, source, and reason to dedicated audit tables (`room_status_logs`, etc.). Source: `docs/12-SECURITY-ARCHITECTURE.md`.
- **Dual-Approval Governance**: Sensitive operational or financial actions (e.g. rate overrides above thresholds, folio write-offs) require secondary supervisor sign-off. Source: `docs/04-USER-ROLES-PERMISSIONS.md`.
