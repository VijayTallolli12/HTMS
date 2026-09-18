# 00 — Master AI Operating Contract & Non-Negotiable Rules

This document establishes the highest-level operating rules for AI development agents working on the Enterprise Hotel Management System (HMS). Existing documents under `docs/` remain the authoritative source of truth.

---

## 1. Core Technology Stack

- **Frontend**: Angular 18+, Standalone Components, Signals reactivity, SCSS design tokens via `@hms/ui`. Source: `docs/adr/ADR-0004-angular-enterprise-frontend-architecture.md`, `docs/10-UI-UX-ARCHITECTURE.md`.
- **Backend**: NestJS 10+, TypeScript, layered architecture (Controllers -> Application Services -> Domain Services). Source: `docs/adr/ADR-0008-backend-framework-nestjs-typescript.md`.
- **Database**: PostgreSQL 16+ with dedicated domain schemas (`platform_schema`, `pms_schema`, `audit_schema`). Source: `docs/adr/ADR-0002-multi-property-tenant-isolation-strategy.md`, `docs/07-DATABASE-ARCHITECTURE.md`.
- **ORM / Query Builder**: Dual-tier access — Prisma for default CRUD and migrations; Kysely strictly restricted per ADR-0007. Source: `docs/adr/ADR-0007-database-access-orm-query-builder-policy.md`.
- **Messaging & Outbox**: RabbitMQ 3.13+ via transactional outbox (`audit_schema.outbox_events`). Source: `docs/adr/ADR-0003-event-driven-outbox-pattern.md`, `docs/09-EVENT-CATALOG.md`.
- **Cache & Distributed Locks**: Redis 7 for caching, session stores, and distributed locking. Source: `docs/07-DATABASE-ARCHITECTURE.md`, `docs/14-DEPLOYMENT-ARCHITECTURE.md`.
- **Architecture Paradigm**: Event-Driven Modular Monolith with strictly bounded domains. Source: `docs/adr/ADR-0001-modular-monolith-architecture.md`, `docs/01-PRODUCT-VISION.md`.

---

## 2. Database & Data Integrity Rules

- **UUIDv7 Primary Keys**: All entity IDs must be time-ordered UUIDv7 generated application-side (`@hms/shared`). Zero database-generated UUIDs (`gen_random_uuid()` prohibited).
- **Prisma Default**: All persistence operations must use standard Prisma client methods within interactive transactions (`prisma.$transaction`).
- **ADR-0007 Kysely Restriction**: Kysely query builder is allowed ONLY for read-only tape charts, complex inventory queries, and high-dimension reporting.
- **Zero Raw SQL**: Raw SQL strings (`$queryRaw`, `$executeRaw`) are strictly forbidden in domain services.
- **Domain Schema Ownership**: Tables belong exclusively to their domain schema. Cross-schema foreign keys and cross-schema SQL joins are prohibited.
- **Transactional Consistency**: Financial, inventory, and status mutations must execute within ACID interactive transactions.
- **Transactional Outbox Mandatory**: Domain events must be inserted into `audit_schema.outbox_events` in the same transaction that mutates domain state.
- **Database Invariants**: Database constraints (GiST exclusion, composite unique keys, composite FKs) are the final authority. Application validation must not replace database constraints.

---

## 3. Security & Authorization Rules

- **Zero Trust Property Context**: Never trust client-supplied tenant, property, or organizational context from headers or payload bodies.
- **Context Verification**: Property access must be authenticated and authorized against the user's verified JWT claims via `ScopedRbacGuard`.
- **Scoped RBAC + ABAC**: Access requires explicit permissions scoped to the target property or organizational node (`@RequirePropertyContext()`, `@RequirePermissions(...)`).
- **No Convenience Bypasses**: Never bypass authentication, authorization, or property isolation for tests, seeds, or prototyping.
- **Audit Logging**: All sensitive mutations must record user ID, timestamp, source, and state delta in append-only audit ledgers.

---

## 4. Concurrency & State Mutation Rules

- **Optimistic Concurrency Control (OCC)**: Entities with concurrent mutation risks (`Room`, `DailyInventory`, `RoomMaintenanceBlock`, `Reservation`) must implement integer `version` OCC. Collisions throw HTTP 409 Conflict.
- **No Silent Overwrites**: Last-write-wins (LWW) is strictly prohibited for business-critical operational or financial state.
- **Atomic Capacity Adjustments**: Multi-day inventory and reservation operations must lock and adjust records in deterministic order (`ORDER BY businessDate ASC`).

---

## 5. Architectural Boundaries & Scope Control

- **Domain Boundaries**: Maintain strict domain boundaries. Never transfer responsibilities between tasks or domains without explicit architectural approval.
- **No Early Implementation**: Never implement logic, tables, or APIs belonging to future tasks (e.g. do not implement T07 room assignment during T06).
- **No Unrelated Refactors**: Do not modify files outside the active task's approved scope. Keep PRs and commits atomic and focused.

---

## 6. AI Operational Safety Boundaries

- **Assistant / Recommendation Role**: AI operates strictly outside transactional authority (Read/Draft only). Source: `docs/adr/ADR-0006-ai-operational-safety-boundaries.md`.
- **Prohibited AI Operations**: AI must never directly execute financial charges, override security policies, mutate inventory, or alter room operational states without human operator confirmation.
- **Human Approval Gates**: Sensitive workflows require explicit human-in-the-loop sign-off.

---

## 7. Development & Commit Governance

- **Mandatory 12-Step Lifecycle**:
  `PLAN` -> `INDEPENDENT REVIEW` -> `APPROVAL` -> `IMPLEMENT` -> `VERIFY` -> `REGRESSION REVIEW` -> `REPORT` -> `HUMAN COMMIT APPROVAL` -> `COMMIT` -> `PUSH (ON DEMAND ONLY)`.
- **Never Auto-Commit**: AI agents must NEVER commit code automatically without explicit human authorization.
- **Never Auto-Push**: AI agents must NEVER push to remote repositories unless explicitly instructed.
- **Single Task Scope**: Implement ONLY the currently assigned and approved task.
