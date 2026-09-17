# ADR-0002: Multi-Property Tenant Isolation & Schema Strategy

## Status
Accepted

## Context
Enterprise HMS serves a multi-property luxury hotel portfolio with corporate, regional, and individual property operations. 
We must determine how multi-tenancy and multi-property isolation are modeled in PostgreSQL:
* **Database-per-Tenant**: Extremely high management overhead (running thousands of migrations), complex cross-property reporting for corporate executives.
* **Public Shared Schema with `property_id` Filter**: High risk of accidental data leakage if an engineer forgets a `WHERE property_id = ...` clause.
* **Domain Schemas in Shared Database with Mandatory Parameterized Scoping & Composite Indexing**: Clean separation of domain tables with strong application-layer and database-layer isolation.

## Decision
We adopt **Domain Schemas within a Shared PostgreSQL Instance** augmented with **Mandatory Property Scoping**:
1. Tables are partitioned by domain schemas (`pms_schema`, `operations_schema`, `finance_schema`, etc.).
2. Every table containing property-scoped data must include `tenant_id UUID NOT NULL` and `property_id UUID NOT NULL`.
3. Composite indexes on operational tables must lead with `property_id` (`CREATE INDEX ... ON pms_schema.reservations (property_id, ...)`).
4. Application query builders automatically enforce property scoping based on the authenticated request context headers (`X-Tenant-ID`, `X-Property-ID`).
5. Cross-property corporate queries are explicitly authorized via Corporate/Regional role grants.

## Consequences
### Positive:
* Enables instant, real-time consolidated corporate and regional financial reporting without cross-database ETL overhead.
* Clear architectural ownership of database tables aligned with business domains.
* Simplifies database connection pooling, backup procedures, and point-in-time recovery.

### Negative / Tradeoffs:
* Requires automated static analysis tests and query interceptors to guarantee that every repository query includes `property_id`.
