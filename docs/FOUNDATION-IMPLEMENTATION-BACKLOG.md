# Foundation Implementation Backlog: Wave 1 (Core Operating Loop)

## 1. Implementation Wave Strategy Overview
To prevent merge gridlock and boundary erosion, development proceeds in disciplined sequential waves.
All 12 AI agents must NOT be launched simultaneously.

```
+-------------------------------------------------------------------------------+
|                    WAVE 1: CORE HOTEL OPERATING LOOP (ACTIVE)                 |
|  Agents: Platform, PMS, Front Office, Rooms/Housekeeping, QA                 |
|  Loop: Property -> Room -> Guest -> Reservation -> Room Assignment ->         |
|        Check-in -> Stay -> Checkout -> Dirty -> Housekeeping ->               |
|        Clean -> Inspection -> Ready                                           |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                         WAVE 2: OPERATIONAL EXPANSION                         |
|  Agents: Engineering, Food & Beverage, Guest Services, Transport              |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                          WAVE 3: BUSINESS EXPANSION                           |
|  Agents: Finance & Cashiering, Commercial, Revenue Management, Procurement   |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                           WAVE 4: GUEST ECOSYSTEM                             |
|  Agents: CRM, Loyalty, Mobile Applications (Guest & Staff)                    |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       WAVE 5: ENTERPRISE INTELLIGENCE                         |
|  Agents: Analytics & OLAP, AI Services, Advanced Integrations, Reporting      |
+-------------------------------------------------------------------------------+
```

---

## 2. Wave 1 Task Breakdown: The Core Operating Loop

### Task W1-T01: Monorepo Scaffolding & Local Infrastructure Baseline
* **Task ID**: `W1-T01`
* **Domain**: `Platform & DevOps`
* **Objective**: Initialize Nx monorepo workspace, root TypeScript configs, Docker Compose stack (PostgreSQL, RabbitMQ, Redis, Mailpit), and baseline NestJS project.
* **Dependencies**: None
* **Files / Modules Expected**:
  * `docker-compose.yml`
  * `package.json`, `nx.json`, `tsconfig.base.json`
  * `apps/api-core/src/main.ts`, `apps/api-core/src/app.module.ts`
  * `packages/shared-contracts/package.json`
  * `packages/database/package.json`
* **API Contract**: Health check endpoint `GET /api/health` returning `{ status: "ok", timestamp: "..." }`.
* **Database Impact**: Initializes PostgreSQL container with isolated schemas (`platform_schema`, `pms_schema`, `operations_schema`, `finance_schema`, `audit_schema`).
* **Events**: None.
* **Acceptance Criteria**: Running `docker compose up -d` boots all 4 services without errors. Running `npm run start:dev` boots NestJS listening on port 3000.
* **Tests**: Automated health check integration test asserting HTTP 200 and database connection ping.
* **Definition of Done**: Stack boots clean; CI pipeline runs lint and type-check with 0 warnings.

---

### Task W1-T02: Multi-Property Organization Model & Database Migrations
* **Task ID**: `W1-T02`
* **Domain**: `Platform`
* **Objective**: Model the multi-property hierarchy (Group -> Region -> Property -> Building -> Floor -> Physical Room) in Prisma schema and generate initial migrations.
* **Dependencies**: `W1-T01`
* **Files / Modules Expected**:
  * `packages/database/prisma/schema.prisma` (Domain schema for platform and room masters)
  * `packages/database/prisma/migrations/0001_initial_hierarchy/migration.sql`
  * `packages/database/src/seed/seed-hierarchy.ts` (Seeds Corporate HQ, Tokyo Grandeur, Paris Palace)
* **API Contract**: Internal repository interfaces in `packages/database`.
* **Database Impact**: Creates `platform_schema.organizations`, `regions`, `properties`, `buildings`, `floors`, `physical_rooms`. UUIDv7 primary keys and audit fields enforced.
* **Events**: None.
* **Acceptance Criteria**: `npx prisma migrate dev` applies successfully; seed script populates 2 properties with 50 rooms each.
* **Tests**: Integration test verifying foreign key constraints within schema and hierarchy traversal queries.
* **Definition of Done**: Migration is forward-only, clean rollback tested, models typed and exported.

---

### Task W1-T03: Scoped Identity, Auth Guard & Context Resolver
* **Task ID**: `W1-T03`
* **Domain**: `Platform & Security`
* **Objective**: Implement JWT authentication, RBAC policy evaluator, and the Property Context resolver middleware validating `X-Tenant-ID` and `X-Property-ID`.
* **Dependencies**: `W1-T02`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/platform/auth/guards/jwt-auth.guard.ts`
  * `apps/api-core/src/modules/platform/auth/guards/property-scope.guard.ts`
  * `apps/api-core/src/modules/platform/auth/decorators/current-user.decorator.ts`
  * `apps/api-core/src/modules/platform/auth/services/auth.service.ts`
* **API Contract**: `POST /api/v1/platform/auth/login`, `POST /api/v1/platform/auth/refresh`.
* **Database Impact**: Creates `platform_schema.users`, `roles`, `permissions`, `user_role_assignments`.
* **Events**: `UserLoggedIn`, `UserRoleAssigned`.
* **Acceptance Criteria**: Requests with valid JWT and matching `X-Property-ID` succeed; requests with mismatched property scope return HTTP 403 Forbidden.
* **Tests**: Unit tests for RBAC evaluator; API tests for token expiration, scope validation, and invalid header rejections.
* **Definition of Done**: Scope resolution passes all 8 persona scenarios from architecture review.

---

### Task W1-T04: PMS Room Types, Rate Plans & Inventory Calendar
* **Task ID**: `W1-T04`
* **Domain**: `PMS`
* **Objective**: Implement Room Type configurations, Rate Plans (with cancellation rules and meal plan codes), and daily inventory availability tracking.
* **Dependencies**: `W1-T03`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/pms/room-types/`
  * `apps/api-core/src/modules/pms/rate-plans/`
  * `apps/api-core/src/modules/pms/inventory/`
  * `packages/database/prisma/schemas/pms.prisma`
* **API Contract**:
  * `GET /api/v1/pms/room-types`
  * `POST /api/v1/pms/rate-plans`
  * `GET /api/v1/pms/inventory/availability?startDate=...&endDate=...`
* **Database Impact**: Creates `pms_schema.room_types`, `rate_plans`, `inventory_days` with composite index `(property_id, date, room_type_id)`.
* **Events**: `RatePlanCreated`, `InventoryAdjusted`.
* **Acceptance Criteria**: Available to Sell (ATS) calculates accurately: `ATS = Total Rooms - Physical OOO - Booked Count`.
* **Tests**: Unit tests for rate calculation formulas; concurrency tests verifying zero race conditions during inventory decrement.
* **Definition of Done**: Full OpenAPI documentation generated; >90% branch coverage on inventory calculations.

---

### Task W1-T05: Central Reservation Aggregate & Booking Workflow
* **Task ID**: `W1-T05`
* **Domain**: `PMS`
* **Objective**: Implement core reservation entity aggregate, booking creation, modification, cancellation, and inventory decrement logic.
* **Dependencies**: `W1-T04`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/pms/reservations/domain/reservation.aggregate.ts`
  * `apps/api-core/src/modules/pms/reservations/services/reservation.application.service.ts`
  * `apps/api-core/src/modules/pms/reservations/controllers/reservation.controller.ts`
* **API Contract**:
  * `POST /api/v1/pms/reservations` (Supports `Idempotency-Key`)
  * `GET /api/v1/pms/reservations/:id`
  * `PATCH /api/v1/pms/reservations/:id/cancel`
* **Database Impact**: Creates `pms_schema.reservations`, `reservation_rate_nights`.
* **Events**: `ReservationCreated`, `ReservationModified`, `ReservationCancelled` emitted to Transactional Outbox.
* **Acceptance Criteria**: Creating a confirmed reservation atomically decrements ATS across all stay nights; cancelling restores ATS.
* **Tests**: Unit tests on reservation invariants; integration tests asserting atomic database transaction and outbox insertion.
* **Definition of Done**: Commands and Events strictly separated; idempotency verified with Redis TTL locks.

---

### Task W1-T06: Rooms Operations Status State Machine & Out-of-Order Engine
* **Task ID**: `W1-T06`
* **Domain**: `Rooms Operations`
* **Objective**: Implement physical room status finite state machine (`Dirty`, `Pick-up`, `Clean`, `Inspected`, `Occupied`, `OOO`, `OOS`) and transition audit logging.
* **Dependencies**: `W1-T02`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/operations/rooms/domain/room-status.machine.ts`
  * `apps/api-core/src/modules/operations/rooms/services/rooms-ops.service.ts`
  * `apps/api-core/src/modules/operations/rooms/controllers/rooms-status.controller.ts`
* **API Contract**:
  * `GET /api/v1/operations/rooms/status-matrix`
  * `POST /api/v1/operations/rooms/:id/status-transition`
  * `POST /api/v1/operations/rooms/:id/out-of-order`
* **Database Impact**: Creates `operations_schema.room_status_records` and `room_status_history`.
* **Events**: `RoomDirty`, `RoomCleaned`, `RoomReady`, `RoomPlacedOOO`, `RoomReturnedToService`.
* **Acceptance Criteria**: State machine strictly prevents invalid transitions (e.g., cannot transition from `Dirty` directly to `Inspected` without passing `Clean`). Placing a room OOO synchronously decrements PMS ATS.
* **Tests**: Exhaustive matrix unit test covering all valid and invalid state machine transitions.
* **Definition of Done**: Real-time room status changes emit versioned domain events to RabbitMQ outbox.

---

### Task W1-T07: Front Office Room Assignment & Arrival Processing
* **Task ID**: `W1-T07`
* **Domain**: `Front Office`
* **Objective**: Implement daily arrival queue, intelligent/manual room assignment validation, and tape chart read queries via Kysely.
* **Dependencies**: `W1-T05`, `W1-T06`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/frontoffice/arrivals/`
  * `apps/api-core/src/modules/frontoffice/assignment/services/room-assignment.service.ts`
  * `apps/api-core/src/modules/frontoffice/tape-chart/queries/tape-chart.kysely.ts`
* **API Contract**:
  * `GET /api/v1/frontoffice/arrivals?date=...`
  * `POST /api/v1/frontoffice/reservations/:id/assign-room`
  * `GET /api/v1/frontoffice/tape-chart?startDate=...&endDate=...`
* **Database Impact**: Updates `pms_schema.reservations.assigned_room_id`.
* **Events**: `RoomAssigned`.
* **Acceptance Criteria**: Room assignment verifies room is not OOO, matches room type, and has no overlapping reservation. Kysely tape chart query executes in < 50ms for 500 rooms over 30 days.
* **Tests**: Integration test verifying room assignment conflict detection; performance benchmark on Kysely tape chart query.
* **Definition of Done**: Tape chart query utilizes Kysely with zero N+1 queries; controllers contain zero business logic.

---

### Task W1-T08: Check-In Workflow & Keycard Integration Handoff
* **Task ID**: `W1-T08`
* **Domain**: `Front Office`
* **Objective**: Implement the check-in command handler: verify room is `INSPECTED`, capture payment guarantee pre-auth token, transition reservation to `CHECKED_IN`, and emit check-in event.
* **Dependencies**: `W1-T06`, `W1-T07`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/frontoffice/checkin/commands/check-in-guest.command.ts`
  * `apps/api-core/src/modules/frontoffice/checkin/services/check-in.application.service.ts`
  * `apps/api-core/src/modules/frontoffice/checkin/controllers/check-in.controller.ts`
* **API Contract**: `POST /api/v1/frontoffice/checkin` (Payload: `reservationId`, `roomId`, `paymentToken`, `keycardCount`).
* **Database Impact**: Updates `reservations.status = 'CHECKED_IN'`; inserts outbox event.
* **Events**: `GuestCheckedIn`, `KeycardIssued`.
* **Acceptance Criteria**: Fails with RFC 7807 `409 Conflict` (`ROOM_NOT_INSPECTED`) if target room is not in `INSPECTED` status. Succeeded check-in atomically commits state and publishes `GuestCheckedIn`.
* **Tests**: E2E integration test from reservation -> assign clean room -> check-in -> event dispatched.
* **Definition of Done**: Zero room checked in without `INSPECTED` status; idempotency key supported.

---

### Task W1-T09: Checkout Workflow, Folio Settlement Check & Departure Transition
* **Task ID**: `W1-T09`
* **Domain**: `Front Office`
* **Objective**: Implement checkout command handler: verify folio balance is $0.00 (via Finance query service), transition reservation to `CHECKED_OUT`, and emit departure event.
* **Dependencies**: `W1-T08`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/frontoffice/checkout/commands/check-out-guest.command.ts`
  * `apps/api-core/src/modules/frontoffice/checkout/services/check-out.application.service.ts`
  * `apps/api-core/src/modules/frontoffice/checkout/controllers/check-out.controller.ts`
* **API Contract**: `POST /api/v1/frontoffice/checkout/:reservationId`.
* **Database Impact**: Updates `reservations.status = 'CHECKED_OUT'`.
* **Events**: `GuestCheckedOut`.
* **Acceptance Criteria**: If open balance > $0.00, returns RFC 7807 `409 Conflict` (`FOLIO_BALANCE_NON_ZERO`). When zero, commits checkout and publishes `GuestCheckedOut`.
* **Tests**: Unit tests for balance validation; integration tests asserting `GuestCheckedOut` triggers Rooms Ops to mark room `Dirty`.
* **Definition of Done**: Complete checkout verification with mock Finance service.

---

### Task W1-T10: Housekeeping Task Generation, Execution & Inspection Board
* **Task ID**: `W1-T10`
* **Domain**: `Housekeeping`
* **Objective**: Implement housekeeping task allocation, room attendant mobile task sheet progress (`Dirty` -> `Cleaning` -> `Clean`), and supervisor inspection approval (`Clean` -> `Inspected` -> `RoomReady`).
* **Dependencies**: `W1-T06`, `W1-T09`
* **Files / Modules Expected**:
  * `apps/api-core/src/modules/operations/housekeeping/tasks/`
  * `apps/api-core/src/modules/operations/housekeeping/inspections/`
  * `apps/api-core/src/modules/operations/housekeeping/consumers/checkout-event.consumer.ts`
* **API Contract**:
  * `POST /api/v1/housekeeping/tasks/batch-generate`
  * `PATCH /api/v1/housekeeping/tasks/:id/status`
  * `POST /api/v1/housekeeping/inspections/:id/certify`
* **Database Impact**: Creates `operations_schema.housekeeping_tasks`, `inspection_checklists`.
* **Events**: `RoomCleaningStarted`, `RoomCleaned`, `RoomInspectionRequired`, `RoomReady`.
* **Acceptance Criteria**: Consumer listens to `GuestCheckedOut` and automatically spawns a departure cleaning task. Attendant finishing cleaning triggers `RoomCleaned`; supervisor approval triggers `RoomReady` (`INSPECTED`).
* **Tests**: Automated integration test verifying full loop: `GuestCheckedOut` -> `RoomDirty` -> Task Spawned -> Attendant Cleans -> Supervisor Approves -> `RoomReady` -> Available for Check-In.
* **Definition of Done**: Complete closed-loop verification of the Core Operating Loop.
