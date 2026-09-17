# Database Architecture & Persistence Strategy: Enterprise HMS

## 1. Executive Summary & Engine Selection
Enterprise HMS utilizes **PostgreSQL 16+** as its primary transactional database. PostgreSQL provides enterprise-grade ACID guarantees, native JSONB support for dynamic hospitality attributes, robust partitioning for multi-property time-series data, and native Row-Level Security (RLS) for zero-trust multi-tenancy.

---

## 2. PostgreSQL Schema Organization Strategy: Domain-Driven Schemas

Rather than dumping hundreds of tables into a single `public` schema or creating hundreds of separate databases, we implement **Domain Schemas within a Shared Database Instance**:

```
enterprise_hms_db
??? platform_schema        # Organizations, Properties, Users, Roles, Permissions
??? pms_schema             # RoomTypes, PhysicalRooms, RatePlans, InventoryDays, Reservations
??? operations_schema      # RoomStatusRecords, HousekeepingTasks, MaintenanceWorkOrders
??? finance_schema         # Folios, FolioTransactions, Payments, Invoices, TaxRules
??? crm_schema             # GuestProfiles, GuestPreferences, StayHistories, LoyaltyAccounts
??? integration_schema     # ChannelMappings, WebhookSubscriptions, InboundPayloadLogs
??? audit_schema           # Immutable System Audit Log, State Change History, Outbox Events
```

### Strategic Benefits:
1. **Clear Ownership**: Each domain module has explicit boundaries and permissions.
2. **Encapsulation**: Cross-domain database joins are strictly prohibited in application code.
3. **Painless Microservice Extraction**: If high-load domains (e.g., `pms_schema` or `finance_schema`) ever require extraction into independent microservices, their schema can be migrated with minimal disruption.

---

## 3. Data Modeling Conventions & Standards

### 3.1 Identifier Strategy: UUIDv7
All primary keys use **UUIDv7** (time-ordered sequential UUIDs):
* **Technical Purpose**:
  * Provides a **time-ordered identifier** combining a 48-bit Unix timestamp with 74 bits of randomness.
  * Preserves **index locality** and sequential insertion performance in PostgreSQL B-tree indexes, preventing the page-splitting and index bloat associated with random UUIDv4 identifiers.
  * Optimal for **distributed ID generation** across web, mobile, and background worker nodes without central database sequence bottlenecks.
* **Security Clarification**:
  * **UUIDv7 is NOT an authorization or anti-enumeration security mechanism.**
  * **Authorization and scoped access controls provide security. Identifier opacity must never replace authorization.**
  * All database queries and API endpoints must validate tenant, property, and user access permissions regardless of identifier unpredictability.

### 3.2 Naming Conventions
* **Tables**: Plural snake_case (`pms_schema.reservations`, `operations_schema.housekeeping_tasks`).
* **Columns**: Singular snake_case (`reservation_id`, `room_number`, `created_at`).
* **Foreign Keys**: Suffixed with `_id` (`property_id`, `guest_id`, `assigned_room_id`). Foreign keys are enforced within schemas; cross-schema references are logical UUIDs.
* **Booleans**: Prefixed with `is_` or `has_` (`is_active`, `is_vip`, `has_balcony`).
* **Timestamps**: Explicit `TIMESTAMPTZ` with UTC timezone (`arrival_time`, `settled_at`).

### 3.3 Universal Audit Fields
Every transactional table must include:
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
created_by UUID NOT NULL,
updated_by UUID NOT NULL,
version    INTEGER NOT NULL DEFAULT 1 -- Optimistic Concurrency Control
```

### 3.4 Soft Delete Policy
* **Operational Entities** (e.g., `GuestPreference`, `RatePlanRule`) employ soft deletes using `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL`.
* **Financial & Audit Entities** (e.g., `FolioTransaction`, `PaymentRecord`, `AuditTrail`, `OutboxMessage`) are **strictly immutable and append-only**. Hard and soft deletes are explicitly prohibited by database triggers. Offsetting records (rebates/voids) must be created instead.

---

## 4. Database Access Strategy: Dual-Tier ORM & Query Builder Policy

To balance type safety, developer productivity, and query performance, database access is strictly regulated (see [ADR-0007](adr/ADR-0007-database-access-orm-query-builder-policy.md)). AI developers must NOT arbitrarily choose between Prisma, Kysely, or raw SQL.

### Tier 1: Prisma (Default ORM)
Prisma is the **mandatory default** for:
* Standard CRUD operations across all domains.
* Aggregate persistence and repository implementations.
* Database schema migrations (`prisma migrate`).
* Strongly typed model definitions and seed generation.
* Standard business transactions within a domain aggregate.

### Tier 2: Kysely (Restricted Query Builder)
Kysely is permitted **exclusively for approved complex SQL** where Prisma exhibits N+1 query overhead or inadequate SQL generation:
* **Interactive Tape Chart (Room Rack)**: High-density multi-room, multi-day availability queries.
* **Complex Availability Searches**: Dynamic filtering across room types, inventory allocations, and rate restrictions.
* **Performance-Sensitive Reporting**: Aggregating night audit trial balances and managerial RevPAR/ADR metrics.
* **Specialized Bulk Aggregations**: Mass shift task balancing for housekeeping attendants.

### Tier 3: Raw SQL (Exception Only)
* Raw SQL (`prisma.$queryRaw` or unmanaged SQL strings) is **prohibited by default**.
* Using raw SQL requires an **explicit Architecture Escalation Request** and approval from the Lead Architect.

---

## 5. Multi-Property Isolation: Tenant & Property Scoping
Every table containing property-scoped data must include `tenant_id` and `property_id` columns:
```sql
CREATE TABLE pms_schema.reservations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    confirmation_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    guest_profile_id UUID NOT NULL,
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);
```

### Composite Indexing Pattern:
Every query in the system filters by property. Therefore, composite indexes always lead with `property_id`:
```sql
CREATE INDEX idx_reservations_property_dates 
ON pms_schema.reservations (property_id, arrival_date, departure_date) 
WHERE status != 'CANCELLED';
```

---

## 6. Migration & Seeding Strategy
1. **Migration Tooling**: Prisma Migrate with forward-only migrations.
2. **Zero-Downtime Migration Rule (Expand/Contract)**:
   * Phase 1: Add new nullable columns or tables.
   * Phase 2: Deploy code writing to both old and new structures.
   * Phase 3: Backfill historical data.
   * Phase 4: Deploy code reading exclusively from new structures.
   * Phase 5: Drop old columns in a subsequent release.
3. **Deterministic Seeding**: Automated seeds provision baseline configurations (Corporate HQ, Tokyo Grandeur, Paris Palace, standard role definitions, and system tax rules) for development and CI environments.
