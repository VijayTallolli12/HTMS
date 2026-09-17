# ADR-0007: Database Access Strategy: Dual-Tier Prisma & Kysely Policy

## Status
Accepted

## Context
In Enterprise HMS, developers and AI engineering agents interact with a multi-schema PostgreSQL database.
A pure ORM (such as Prisma) provides excellent schema migration tooling, strong TypeScript types, and rapid developer productivity for standard transactional workflows. However, complex hospitality queries (such as the Front Desk 30-day Tape Chart across 1,000 rooms, dynamic availability lookups, and multi-dimensional revenue aggregations) suffer from N+1 query patterns or inefficient SQL generation when forced through an ORM.
Conversely, using raw SQL or allowing developers/agents to arbitrarily pick query tools creates security vulnerabilities (SQL injection risks), degrades type safety, and makes database migrations difficult to manage.

## Decision
We adopt a **Dual-Tier Database Access Policy**:

### 1. Primary Layer: Prisma (Mandatory Default)
Prisma is the mandatory default tool for:
* All standard CRUD operations across all domains.
* Aggregate persistence and repository implementations.
* Schema definitions and migrations (`prisma migrate`).
* Seed scripts and model type generation.
* Standard business transactions within domain boundaries.

### 2. Specialized Layer: Kysely (Restricted Query Builder)
Kysely (a type-safe, zero-cost TypeScript SQL query builder) is permitted **exclusively** for explicitly approved complex read queries:
* **Tape Chart (Room Rack)**: High-density multi-room, multi-day availability grids.
* **Complex Availability Searches**: Cross-referencing room types, seasonal rates, and operational restrictions.
* **Performance-Sensitive Reporting**: Night audit balance reconciliation and RevPAR/ADR aggregations.
* **Bulk Aggregations**: Mass shift task balancing for room attendant assignments.

### 3. Raw SQL Policy (Prohibited by Default)
* Unchecked raw SQL strings (`prisma.$queryRawUnsafe` or native client execution) are strictly prohibited.
* Any proposed use of raw SQL requires an **Architecture Escalation Request** with benchmark evidence demonstrating why Prisma and Kysely are insufficient, subject to Lead Architect signoff.

## Consequences
### Positive:
* Prevents arbitrary developer and AI agent tool selection.
* Guarantees 100% type safety from database schema to TypeScript types across both simple and complex queries.
* Eliminates N+1 query bottlenecks on mission-critical front desk tape charts while preserving Prisma's high developer velocity for standard workflows.
* Enforces single-source-of-truth migrations through Prisma.

### Negative / Tradeoffs:
* Requires maintaining Kysely type definitions synchronized with Prisma schema migrations (automated via `prisma-kysely` code generation).
