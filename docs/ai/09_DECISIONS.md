# 09 — Architecture Decision Ledger

Concise ledger of ratified Architecture Decision Records (ADRs) and frozen design choices. Existing documents under `docs/adr/` and `docs/ARCHITECTURE-FREEZE.md` remain the source of truth.

---

## 1. Ratified Architecture Decision Records (ADRs)

| ADR | Title | Status | Summary & Invariant |
| :--- | :--- | :--- | :--- |
| **[ADR-0001](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0001-modular-monolith-architecture.md)** | Modular Monolith Architecture | **LOCKED** | Single deployable backend (`apps/api-core`) with strict module boundary isolation. Shared contracts in `@hms/api-contracts`. |
| **[ADR-0002](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0002-multi-property-tenant-isolation-strategy.md)** | Multi-Property Tenant Isolation Strategy | **LOCKED** | PostgreSQL domain schemas (`platform_schema`, `pms_schema`, `audit_schema`) with mandatory property scoping via composite keys. Zero cross-schema foreign keys. |
| **[ADR-0003](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0003-event-driven-outbox-pattern.md)** | Event-Driven Outbox Pattern | **LOCKED** | Outbox table in PostgreSQL (`audit_schema.outbox_events`). RabbitMQ for asynchronous decoupled fan-out. Idempotent consumer deduplication. |
| **[ADR-0004](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0004-angular-enterprise-frontend-architecture.md)** | Angular Enterprise Frontend Architecture | **LOCKED** | Angular 18+, Standalone Components, Signals reactivity, NgRx SignalStore, SCSS tokens via `@hms/ui`. |
| **[ADR-0005](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0005-unified-identity-rbac-scoping.md)** | Unified Identity & Scoped RBAC/ABAC | **LOCKED** | Scoped authorization resolving verified JWT claims via `ScopedRbacGuard`. Context switching between authorized properties. |
| **[ADR-0006](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0006-ai-operational-safety-boundaries.md)** | AI Operational Safety Boundaries | **APPROVED** | AI operates strictly as assistant/recommendation layer outside transactional authority. Zero direct financial or operational state mutation rights. |
| **[ADR-0007](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0007-database-access-orm-query-builder-policy.md)** | Dual-Tier Database Access Policy | **APPROVED** | Prisma as default ORM for CRUD and migrations. Kysely strictly restricted to tape charts and complex availability SQL. Raw SQL prohibited. |
| **[ADR-0008](file:///f:/Folkslogic/enterprise-hms/docs/adr/ADR-0008-backend-framework-nestjs-typescript.md)** | Backend Framework: NestJS + TypeScript | **APPROVED** | NestJS with Controllers -> Application Services -> Domain Services. Express platform, class-validator, Jest. |

---

## 2. Locked Domain & Task Decisions

- **Organizational Tree Structure**: Fixed 6-level hierarchy: `HotelGroup` -> `Region` -> `Country` -> `Property` -> `Building` -> `Floor` -> `Room`. Status: **LOCKED**.
- **W1-T04 DailyInventory Ownership**: `DailyInventory` owns total physical room counts, capacity counters (`bookedCount`, `outOfOrderCount`, `outOfServiceCount`), and Available-to-Sell (ATS) evaluation. Status: **LOCKED**.
- **W1-T05 Reservation Ownership**: `Reservation` aggregate owns booking lifecycle (CONFIRMED, CANCELLED), guest links, stay pricing snapshots, and `booked_count` adjustments. Status: **LOCKED**.
- **W1-T06 RoomMaintenanceBlock Authority**: Scheduled out-of-order and out-of-service maintenance blocks are modeled as explicit `RoomMaintenanceBlock` entities with half-open intervals `[startDate, endDate)`. Status: **LOCKED**.
- **W1-T06 Effective Operational State Authority**: Authoritative operational state for any target date is evaluated dynamically from room status and active maintenance blocks via `RoomStatusReconciliationService`. Status: **LOCKED**.
- **W1-T06 Materialized Projection & Lazy Reconciliation**: `Room.serviceStatus` and `Room.housekeepingStatus` are materialized projections for today's business date, lazily reconciled on read if expired. Idempotency is based on both fields matching the projection. Status: **LOCKED**.
- **W1-T06 PostgreSQL GiST Exclusion Constraint**: Overlapping active maintenance blocks on the same physical room are prevented at the database level using `ex_room_maintenance_no_overlap` on `(property_id, room_id, daterange(start_date, end_date, '[)')) WHERE (status = 'ACTIVE' AND deleted_at IS NULL)`. Status: **LOCKED**.
- **W1-T06 Post-Maintenance Hygiene Rule**: Returning a room to `IN_SERVICE` from maintenance automatically sets `housekeepingStatus = 'DIRTY'`. Status: **LOCKED**.
- **Optimistic Concurrency Control (OCC)**: Integer `version` increment with conditional `WHERE version = :version` on `Room`, `DailyInventory`, `RoomMaintenanceBlock`, and `Reservation`. Status: **LOCKED**.
