# Architecture Freeze & Governance Protocol: Enterprise HMS

## 1. Declaration of Architecture Freeze
As of **September 16, 2026**, the system architecture for the **Enterprise Hospitality Operating Platform (Enterprise HMS)** is officially **FROZEN**.

The design phase is concluded. All technical product blueprints, aggregate boundaries, data models, and messaging specifications are ratified. Engineering agents and developers are strictly prohibited from altering core architectural patterns without invoking the formal Architecture Change Process.

---

## 2. Ratified & Frozen Architectural Decisions

| Area | Frozen Architecture Decision | Reference ADR |
| :--- | :--- | :--- |
| **System Paradigm** | **Event-Driven Modular Monolith** with strict domain package isolation. | [ADR-0001](adr/ADR-0001-modular-monolith-architecture.md) |
| **Persistence Engine** | **PostgreSQL 16+** with Domain Schemas (`platform_schema`, `pms_schema`, etc.) and UUIDv7 primary keys. | [ADR-0002](adr/ADR-0002-multi-property-tenant-isolation-strategy.md) |
| **Database Access** | **Prisma** for standard CRUD/migrations + **Kysely** restricted exclusively to tape charts and complex availability SQL. | [ADR-0007](adr/ADR-0007-database-access-orm-query-builder-policy.md) |
| **Message Broker** | **RabbitMQ 3.13+ (AMQP 0-9-1)** with Topic Exchanges and Dead Letter Exchanges (DLX). | [ADR-0003](adr/ADR-0003-event-driven-outbox-pattern.md) |
| **Distributed Cache** | **Redis 7** strictly for caching, idempotency key locks (`idemp:*`), and WebSocket user sessions. | [ADR-0003](adr/ADR-0003-event-driven-outbox-pattern.md) |
| **Event Reliability** | **Transactional Outbox Pattern** in PostgreSQL with at-least-once delivery and consumer deduplication. | [ADR-0003](adr/ADR-0003-event-driven-outbox-pattern.md) |
| **Backend Runtime** | **NestJS + TypeScript** with strict separation: Controllers -> Application Services -> Domain Services -> Repositories. | [ADR-0008](adr/ADR-0008-backend-framework-nestjs-typescript.md) |
| **Frontend Shell** | **Angular 18+** with Signals reactivity, Standalone Components, and NgRx SignalStore. | [ADR-0004](adr/ADR-0004-angular-enterprise-frontend-architecture.md) |
| **Identity & Access** | **Scoped RBAC + ABAC Context Model** resolving `X-Tenant-ID` and `X-Property-ID` headers. | [ADR-0005](adr/ADR-0005-unified-identity-rbac-scoping.md) |
| **API Standards** | **OpenAPI 3.1 Contract-First**, RFC 7807 Problem Details, Idempotency-Key, RFC 6585 Rate Limiting. | [08-API-CONTRACTS.md](08-API-CONTRACTS.md) |
| **AI Boundaries** | AI operates strictly outside transactional authority; Read/Draft only; Zero financial or physical state mutation rights. | [ADR-0006](adr/ADR-0006-ai-operational-safety-boundaries.md) |
| **Dev Environment** | **Docker Compose** baseline (Postgres, RabbitMQ, Redis, Mailpit). Zero local Kubernetes requirements. | [14-DEPLOYMENT-ARCHITECTURE.md](14-DEPLOYMENT-ARCHITECTURE.md) |
| **Prod Infrastructure** | **Managed Kubernetes (EKS/AKS)** + Managed Aurora PostgreSQL Multi-AZ + Amazon MQ (RabbitMQ). | [14-DEPLOYMENT-ARCHITECTURE.md](14-DEPLOYMENT-ARCHITECTURE.md) |
| **Team Model** | **12 Specialized AI Developer Agents** governed by [AI-DEVELOPER-CONTRACT.md](AI-DEVELOPER-CONTRACT.md). | [15-AI-DEVELOPMENT-GUIDELINES.md](15-AI-DEVELOPMENT-GUIDELINES.md) |

---

## 3. Mandatory Architecture Change Protocol

No engineer, subagent, or autonomous AI developer may silently alter business formulas, persistence patterns, or module boundaries.

Any proposed modification to a frozen decision requires a formal **Architecture Change Request (ACR)** containing:
1. **Problem Statement**: Concrete evidence of why the current frozen architecture is inadequate (e.g., benchmark numbers, unresolvable technical conflict).
2. **Impact Analysis**: Comprehensive mapping of all upstream and downstream domains, packages, APIs, and schemas affected.
3. **Alternatives Evaluated**: Minimum of two viable alternative designs with pros and cons.
4. **Concrete Recommendation**: Explicit proposal for the replacement technology, pattern, or schema change.
5. **Architecture Decision Record (ADR)**: Draft ADR committed to `docs/adr/`.
6. **Lead Architect Review**: Formal technical evaluation by the Lead Architect Agent.
7. **Human Stakeholder Approval**: Mandatory human-in-the-loop signoff for any change impacting financial folios, security boundaries, or cloud infrastructure budgets.

**Silent changes to architecture will trigger immediate PR rejection at the CI merge gate.**
