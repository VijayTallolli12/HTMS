# ADR-0001: Adoption of Event-Driven Modular Monolith Architecture

## Status
Accepted

## Context
Enterprise HMS is a comprehensive hospitality operating system designed for multi-property luxury hotel chains. It encompasses 19 distinct functional domains (PMS, Front Office, Housekeeping, Finance, F&B, Spa, CRM, etc.). 
A critical early architectural decision is whether to implement this system as:
1. A distributed microservices cluster (e.g., 15-20 independently deployed services).
2. A generic monolithic application.
3. An event-driven modular monolith with strict domain boundaries.

Distributed microservices introduce immense operational complexity: network latency between high-frequency front desk queries, complex distributed 2PC/Saga transactions for cashiering and folios, service mesh management, and distributed tracing overhead. Conversely, a traditional unstructured monolith leads to spaghetti code, tight coupling, and difficult team scaling.

## Decision
We adopt an **Event-Driven Modular Monolith** architecture for Enterprise HMS:
* **Strict Module Boundaries**: Code is structured into isolated domain packages (`@hms/pms`, `@hms/front-office`, `@hms/finance`, etc.).
* **Zero Direct Cross-Domain Database Joins**: Modules are strictly forbidden from performing SQL joins across domain schemas.
* **In-Process Communication via Explicit Interfaces**: Synchronous queries use typed in-process interfaces. Cross-domain mutations and side effects occur strictly via asynchronous domain events.
* **Extraction-Ready**: Because domain boundaries and database schemas are decoupled from day one, any domain that encounters extreme independent scaling demands can be extracted into an independent microservice with minimal architectural friction.

## Consequences
### Positive:
* Single deployment pipeline and simplified operational management.
* Extremely low operational latency for front desk operations (in-memory queries rather than multi-hop HTTP/gRPC calls).
* ACID transactions remain available within single domain aggregates (e.g., within folio postings).
* Rapid developer velocity and easier end-to-end integration testing.

### Negative / Tradeoffs:
* Requires vigilant architectural governance to prevent developers or AI agents from violating module boundaries.
* CI pipeline build times must be optimized using incremental monorepo tooling (e.g., Nx / Turborepo).
