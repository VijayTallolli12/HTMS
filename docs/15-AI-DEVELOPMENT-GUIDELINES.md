# Multi-AI Development Model & Engineering Constitution: Enterprise HMS

## 1. Multi-AI Agent Collaborative Architecture
Enterprise HMS is engineered and maintained by 12 specialized AI developer agents collaborating across strictly bounded domains. To prevent merge collisions, domain boundary erosion, and race conditions, every agent operates within an assigned domain scope and isolated git worktree.

```
                                +---------------------------+
                                |    Lead Architect Agent   |
                                |  (System Blueprint & ADRs)|
                                +---------------------------+
                                              |
      +--------------------+------------------+-------------------+--------------------+
      |                    |                  |                   |                    |
+-----v------+      +------v-----+     +------v-----+      +------v-----+       +------v-----+
| Platform   |      | PMS        |     | Front Office|     | Rooms/HK   |       | Engineering|
| Agent      |      | Agent      |     | Agent      |      | Agent      |       | Agent      |
+------------+      +------------+     +------------+      +------------+       +------------+
      |                    |                  |                   |                    |
+-----v------+      +------v-----+     +------v-----+      +------v-----+       +------v-----+
| Finance    |      | Commercial |     | F&B        |      | CRM/Loyalty|       | Mobile     |
| Agent      |      | Agent      |     | Agent      |      | Agent      |       | Agent      |
+------------+      +------------+     +------------+      +------------+       +------------+
      |                    |                  |                   |                    |
      +--------------------+------------------+-------------------+--------------------+
                                              |
                               +--------------+--------------+
                               |                             |
                        +------v------+               +------v------+
                        | QA & Test   |               | DevOps /    |
                        | Agent       |               | Security    |
                        +-------------+               +-------------+
```

---

## 2. The 12 AI Developer Roles: Comprehensive Responsibility Matrix

### 1. Platform Agent
* **Owned Directories**: `apps/api-core/src/modules/platform/`, `packages/database/prisma/schemas/platform.prisma`
* **Owned Domain**: Core Platform, Organization Hierarchy, Identity, RBAC/ABAC Engine, Audit Trail.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`.
* **APIs Exposed**: `/api/v1/platform/orgs`, `/api/v1/platform/properties`, `/api/v1/platform/auth`, `/api/v1/platform/users`.
* **APIs Consumed**: None (Foundation provider).
* **Events Published**: `UserCreated`, `RoleAssigned`, `PropertyConfigUpdated`.
* **Events Consumed**: None.
* **Forbidden Files**: Any business logic under `pms/`, `frontoffice/`, `finance/`, `rooms/`.

### 2. PMS Agent
* **Owned Directories**: `apps/api-core/src/modules/pms/`, `packages/database/prisma/schemas/pms.prisma`
* **Owned Domain**: Physical Room master records, Room Types, Rate Plans, Restrictions, Inventory Calendar, Central Reservations.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`, `platform`.
* **APIs Exposed**: `/api/v1/pms/room-types`, `/api/v1/pms/rooms`, `/api/v1/pms/rate-plans`, `/api/v1/pms/inventory`, `/api/v1/pms/reservations`.
* **APIs Consumed**: `/api/v1/platform/properties`, `/api/v1/crm/profiles`.
* **Events Published**: `ReservationCreated`, `ReservationModified`, `ReservationCancelled`, `RatePlanUpdated`.
* **Events Consumed**: `RoomPlacedOOO`, `RoomReturnedToService`.
* **Forbidden Files**: `finance/`, `housekeeping/`, `engineering/`.

### 3. Front Office Agent
* **Owned Directories**: `apps/api-core/src/modules/frontoffice/`, `apps/web-shell/src/app/features/frontdesk/`
* **Owned Domain**: Daily arrival/departure queues, room assignment execution, check-in, check-out orchestration, tape chart backend/UI.
* **Dependencies**: `@hms/shared-contracts`, `pms`, `rooms-ops`, `finance`.
* **APIs Exposed**: `/api/v1/frontoffice/arrivals`, `/api/v1/frontoffice/checkin`, `/api/v1/frontoffice/checkout`, `/api/v1/frontoffice/tape-chart`.
* **APIs Consumed**: `/api/v1/pms/reservations`, `/api/v1/operations/rooms`, `/api/v1/finance/folios`.
* **Events Published**: `RoomAssigned`, `GuestCheckedIn`, `GuestCheckedOut`, `KeycardIssued`.
* **Events Consumed**: `RoomReady`, `RoomCleaned`, `PaymentAuthorized`.
* **Forbidden Files**: `finance_schema.folios` direct SQL, `platform/auth`.

### 4. Rooms & Housekeeping Agent
* **Owned Directories**: `apps/api-core/src/modules/operations/housekeeping/`, `apps/web-shell/src/app/features/housekeeping/`
* **Owned Domain**: Room cleaning status state machine, attendant daily tasks, turn credits, supervisor inspection checklists, linen inventory.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`.
* **APIs Exposed**: `/api/v1/operations/rooms/status`, `/api/v1/housekeeping/tasks`, `/api/v1/housekeeping/inspections`.
* **APIs Consumed**: `/api/v1/platform/staff`, `/api/v1/pms/rooms`.
* **Events Published**: `RoomDirty`, `RoomCleaningStarted`, `RoomCleaned`, `RoomInspectionRequired`, `RoomReady`.
* **Events Consumed**: `GuestCheckedIn`, `GuestCheckedOut`, `MaintenanceCompleted`.
* **Forbidden Files**: `pms/reservations`, `finance/folios`.

### 5. Engineering Agent
* **Owned Directories**: `apps/api-core/src/modules/operations/engineering/`, `apps/web-shell/src/app/features/engineering/`
* **Owned Domain**: Asset register, preventive maintenance schedules, reactive work orders, spare parts.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`.
* **APIs Exposed**: `/api/v1/engineering/assets`, `/api/v1/engineering/work-orders`.
* **APIs Consumed**: `/api/v1/operations/rooms`.
* **Events Published**: `MaintenanceRequested`, `MaintenanceAssigned`, `MaintenanceCompleted`.
* **Events Consumed**: `RoomPlacedOOO`, `ServiceRequestCreated`.
* **Forbidden Files**: `finance/`, `pms/rate-plans`.

### 6. Food & Beverage (F&B) Agent
* **Owned Directories**: `apps/api-core/src/modules/fnb/`, `packages/database/prisma/schemas/fnb.prisma`
* **Owned Domain**: Dining outlets, table configurations, dining reservations, meal plan allowances, room service tickets.
* **Dependencies**: `@hms/shared-contracts`, `finance`, `crm`.
* **APIs Exposed**: `/api/v1/fnb/outlets`, `/api/v1/fnb/tables`, `/api/v1/fnb/reservations`.
* **APIs Consumed**: `/api/v1/finance/folios/validate-room-charge`, `/api/v1/crm/profiles`.
* **Events Published**: `TableReservationCreated`, `MealPlanConsumed`.
* **Events Consumed**: `GuestCheckedIn`, `GuestCheckedOut`.
* **Forbidden Files**: Direct mutation of `finance_schema.folios` (Must post via Finance API).

### 7. Finance Agent
* **Owned Directories**: `apps/api-core/src/modules/finance/`, `packages/database/prisma/schemas/finance.prisma`
* **Owned Domain**: Multi-window folios, transaction ledger, payments, tax calculations, night audit balancing, city ledger AR, invoices.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`.
* **APIs Exposed**: `/api/v1/finance/folios`, `/api/v1/finance/transactions`, `/api/v1/finance/payments`, `/api/v1/finance/night-audit`.
* **APIs Consumed**: `/api/v1/pms/reservations`, `/api/v1/platform/properties`.
* **Events Published**: `ChargePostedToFolio`, `PaymentAuthorized`, `PaymentSettled`, `FolioClosed`, `NightAuditCompleted`.
* **Events Consumed**: `ReservationCreated`, `GuestCheckedOut`.
* **Forbidden Files**: `operations/housekeeping`, `pms/inventory`.

### 8. Commercial Agent (Revenue, Sales & Banqueting)
* **Owned Directories**: `apps/api-core/src/modules/revenue/`, `apps/api-core/src/modules/sales/`
* **Owned Domain**: Dynamic rate pricing rules, hurdle rates, demand forecasts, event spaces, Banquet Event Orders (BEO), group room blocks.
* **Dependencies**: `@hms/shared-contracts`, `pms`, `finance`.
* **APIs Exposed**: `/api/v1/revenue/hurdle-rates`, `/api/v1/sales/events`, `/api/v1/sales/group-blocks`.
* **APIs Consumed**: `/api/v1/pms/inventory`, `/api/v1/analytics/metrics`.
* **Events Published**: `HurdleRateChanged`, `GroupBlockContracted`.
* **Events Consumed**: `ReservationCreated`, `ReservationCancelled`.
* **Forbidden Files**: Core frontdesk operations, cashiering logic.

### 9. CRM & Loyalty Agent
* **Owned Directories**: `apps/api-core/src/modules/crm/`, `packages/database/prisma/schemas/crm.prisma`
* **Owned Domain**: Golden guest profiles, preferences, medical alerts, loyalty accounts, point transactions, tier benefits.
* **Dependencies**: `@hms/shared-contracts`, `packages/database`.
* **APIs Exposed**: `/api/v1/crm/profiles`, `/api/v1/crm/preferences`, `/api/v1/loyalty/accounts`, `/api/v1/loyalty/points`.
* **APIs Consumed**: `/api/v1/pms/reservations`.
* **Events Published**: `GuestProfileUpdated`, `LoyaltyTierUpgraded`, `PointsAccrued`.
* **Events Consumed**: `ReservationCreated`, `GuestCheckedIn`, `GuestCheckedOut`, `ServiceRequestCompleted`.
* **Forbidden Files**: Direct mutation of room statuses or financial folios.

### 10. Mobile Agent
* **Owned Directories**: `apps/app-guest/`, `apps/app-staff/`
* **Owned Domain**: Guest portal/mobile app (Capacitor/Angular), Staff mobile app (Room attendants, maintenance engineers).
* **Dependencies**: `@hms/shared-contracts`, `@hms/ui-design-system`.
* **APIs Consumed**: Consumes all public REST APIs via `@hms/api-client` and WebSocket event streams.
* **APIs Exposed**: None (Client application).
* **Events Published**: None.
* **Events Consumed**: Client WebSocket events (`hms.operations.room.*`, `hms.services.request.*`).
* **Forbidden Files**: Any backend module in `apps/api-core/`.

### 11. QA & Test Agent
* **Owned Directories**: `tests/`, `packages/test-fixtures/`
* **Owned Domain**: Playwright E2E suites, integration contract tests, synthetic load tests, test seed factories.
* **Dependencies**: Consumes all packages and application endpoints.
* **Responsibilities**: Verifying acceptance criteria, detecting regressions, verifying cross-domain event flows in Docker Compose.
* **Forbidden Files**: Production business logic in `apps/api-core/src/modules/`.

### 12. DevOps & Security Agent
* **Owned Directories**: `infra/`, `.github/workflows/`, `docker-compose.yml`, `Dockerfile*`
* **Owned Domain**: CI/CD pipelines, Docker containerization, Kubernetes Helm charts, Cloudflare WAF, SAST security scanners.
* **Responsibilities**: Infrastructure automation, secrets management, deployment health verification, container hardening.
* **Forbidden Files**: Application UI components or domain business rules.

---

## 3. The AI Engineering Constitution (The 10 Non-Negotiable Rules)

1. **Do Not Modify Unrelated Domains**: Respect package boundaries. Agents must never touch files outside their assigned domain scope.
2. **Do Not Bypass API Contracts**: Every client and background worker must communicate through declared, schema-validated contracts.
3. **Zero Direct Cross-Domain Database Joins**: Never query another domain's database schema directly. Use declared Query APIs or event subscribers.
4. **No Undocumented Dependencies**: Introducing a new npm package, external library, or service dependency requires an explicit entry in the dependency registry.
5. **No Architectural Changes Without an ADR**: Any alteration to schema isolation, protocol choice, or framework patterns requires an approved Architecture Decision Record in `docs/adr/`.
6. **No Feature Is Complete Without Automated Tests**: Code without accompanying unit and contract tests will be rejected at the merge gate.
7. **Never Claim Completion Based Solely on UI Rendering**: A UI feature is only complete when it connects to the real API contract and handles loading, error, and offline states.
8. **Never Silently Change Business Rules**: Mathematical formulas for room availability, rate restrictions, tax computation, and cancellation fees must never be altered without explicit human stakeholder approval.
9. **Preserve Backward Compatibility**: API contracts and domain event payloads must follow semantic versioning. Never make breaking changes to an active contract without a deprecation window.
10. **Document All Assumptions Explicitly**: When encountering ambiguity in business requirements, document the assumption in the implementation plan and request human review before writing code.
