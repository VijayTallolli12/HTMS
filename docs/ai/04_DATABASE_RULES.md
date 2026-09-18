# 04 — Database Rules & Access Policy

Concise rules governing PostgreSQL persistence, migrations, concurrency, and integrity. Existing documents under `docs/` remain the source of truth.

---

## 1. Engine & Schema Isolation

- **PostgreSQL 16+**: The single relational database engine. Source: `docs/07-DATABASE-ARCHITECTURE.md`.
- **Domain Schemas**: Dedicated schemas (`platform_schema`, `pms_schema`, `audit_schema`). Cross-schema foreign keys are strictly prohibited. Source: `docs/adr/ADR-0002-multi-property-tenant-isolation-strategy.md`.

---

## 2. Identifiers & Keys

- **UUIDv7 Mandatory**: All primary keys must be time-ordered UUIDv7 generated application-side (`generateUuidV7()` from `@hms/shared`). Zero database-generated UUIDs (`gen_random_uuid()` prohibited). Source: `docs/07-DATABASE-ARCHITECTURE.md`.
- **Property-Scoped Composite Keys**: Operational child records must include `propertyId` and define composite unique constraints `@@unique([propertyId, id])` to enforce strict property scoping. Source: `docs/03-ORGANIZATION-MODEL.md`.

---

## 3. Database Access Policy (ADR-0007)

- **Prisma Default**: Prisma is the authoritative access mechanism for all CRUD, interactive transactions, and migrations. Source: `docs/adr/ADR-0007-database-access-orm-query-builder-policy.md`.
- **Kysely Restricted**: Kysely query builder is permitted ONLY for high-dimensional tape charts, complex inventory availability, and reporting queries.
- **Zero Raw SQL**: Raw SQL (`$queryRaw`, `$executeRaw`, string concatenation) is prohibited in application code.

---

## 4. Concurrency & Locking

- **Optimistic Concurrency Control (OCC)**: Entities subject to concurrent modification (`Room`, `DailyInventory`, `RoomMaintenanceBlock`, `Reservation`) must implement integer `version` OCC. Updating code must include `WHERE version = :version` and increment version. Collisions throw HTTP 409 Conflict.
- **Deterministic Multi-Row Ordering**: Multi-day operations (e.g. inventory capacity adjustments, booking allocations) must query and lock rows in deterministic ascending order (`ORDER BY businessDate ASC`) to prevent deadlocks.
- **Database Constraints as Authoritative Authority**: Database-level constraints (e.g. PostgreSQL GiST exclusion `ex_room_maintenance_no_overlap`, partial unique indexes) are the final authority for system invariants. Application validation must never substitute for database constraints.

---

## 5. Transactions, Outbox & Auditability

- **Interactive Transactions**: Multi-entity mutations must execute in interactive transactions (`prisma.$transaction(async (tx) => { ... })`).
- **Transactional Outbox**: Events must be persisted to `audit_schema.outbox_events` within the same database transaction.
- **Soft Deletes**: Business entities use `deletedAt DateTime?`. Active queries must include `deletedAt: null`.
- **Append-Only Ledgers**: Status logs (`room_status_logs`) and financial ledgers are append-only. Never execute `UPDATE` or `DELETE` on ledger tables.
