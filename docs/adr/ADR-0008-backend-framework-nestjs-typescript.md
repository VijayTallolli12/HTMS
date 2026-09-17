# ADR-0008: Backend Framework Selection: NestJS & TypeScript Layered Architecture

## Status
Accepted

## Context
Enterprise HMS is structured as an Event-Driven Modular Monolith. To maintain strict boundaries between the 18 canonical domains, the backend framework must provide:
1. Robust modularization and dependency injection to enforce domain encapsulation.
2. Built-in support for OpenAPI 3.1 generation directly from strongly-typed DTOs.
3. Clean separation of concerns between HTTP transport, application orchestration, domain business rules, and persistence.
4. Seamless integration with Prisma, Kysely, RabbitMQ (AMQP), and Redis.

## Decision
We select **NestJS with TypeScript** as the standard backend runtime framework and mandate a **Strict Layered Architecture** within every domain module:

```
+-------------------------------------------------------------------------------+
|                            Transport / Controller                             |
|  - Validates DTOs via ValidationPipe (class-validator / Zod)                  |
|  - Resolves Auth & Scope via ScopedAuthGuard                                  |
|  - Zero Business Logic! Dispatches Command to Application Service             |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                             Application Service                               |
|  - Coordinates business workflows, transactions, and outbox emission          |
|  - Enforces authorization rules and security context                          |
|  - Loads Aggregate via Repository -> Invokes Domain Service / Aggregate Method|
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                          Domain Service & Aggregates                          |
|  - Pure business invariants and state machine transitions                     |
|  - Zero dependency on HTTP, framework, or database drivers                    |
+-------------------------------------------------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
+------------------------------------+   +------------------------------------+
|             Repository             |   |           Query Service            |
| - Manages aggregate persistence    |   | - Optimized read projections       |
| - Uses Prisma for CRUD & mutations |   | - Uses Kysely for tape charts/grids|
+------------------------------------+   +------------------------------------+
                   |                                         |
                   +--------------------+--------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                             Database Tier (PostgreSQL)                        |
+-------------------------------------------------------------------------------+
```

### Module Structure Guidelines:
Every domain module in `apps/api-core/src/modules/{domain}/` must follow this structure:
```
modules/{domain}/
??? controllers/              # HTTP entry points (Zero business logic)
??? dto/                      # Request / Response schemas with validation decorators
??? services/
?   ??? {domain}.application.service.ts # Workflow orchestration & transaction boundaries
?   ??? {domain}.domain.service.ts      # Pure business rules & calculations
??? domain/
?   ??? aggregates/           # Entity state machines and invariants
?   ??? events/               # Domain event declarations
??? repositories/             # Persistence interfaces & Prisma implementations
??? queries/                  # Read-only query services (Kysely implementations)
??? messaging/
?   ??? publishers/           # Outbox event emitter adapters
?   ??? consumers/            # RabbitMQ topic event handlers
??? {domain}.module.ts        # NestJS module declaration with explicit exports
```

### Framework Rules:
1. **Controllers Must Contain Zero Business Logic**: Controllers solely handle HTTP mapping, DTO validation, user context extraction, and response status codes.
2. **Domain Encapsulation**: A module exports only its `ApplicationService`, `QueryService`, or typed interfaces. Internal repositories and domain entities are private to the module.
3. **Exception Handling**: Domain exceptions (e.g., `RoomNotReadyException`) are caught by a global `HttpExceptionFilter` that serializes them into RFC 7807 Problem Details.

## Consequences
### Positive:
* Prevents domain logic leakage into transport layers.
* Provides uniform testing hooks: application services can be unit-tested with mock repositories without booting HTTP servers.
* First-class TypeScript type safety from request body to database query.
* Clean, predictable code structure across all 18 domains.

### Negative / Tradeoffs:
* Requires maintaining boilerplate layers (Controller -> Application Service -> Repository). This boilerplate is justified by domain isolation and enterprise maintainability.
