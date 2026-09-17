# AI Developer Contract & Engineering Governance: Enterprise HMS

## 1. Purpose & Scope
This contract establishes the mandatory legal, architectural, and operational rules governing all AI developer agents participating in the engineering of Enterprise HMS. Adherence to this contract is automatically enforced by repository pre-commit hooks, CI quality gates, and the Lead Architect Agent.

---

## 2. Agent Identity & Role Registration
Every AI developer agent must declare its assigned role upon session initialization:
* `architect-agent`: Root architecture, contracts, ADRs, gate approvals.
* `platform-agent`: Core platform, organization hierarchy, authentication, RBAC, tenant scoping.
* `pms-agent`: Room types, rate plans, availability calendar, reservation aggregate.
* `frontoffice-agent`: Front desk arrivals/departures, room assignment, check-in, check-out, tape chart.
* `rooms-hk-agent`: Room status state machine, housekeeping dispatch, inspection checklists.
* `engineering-agent`: Asset register, preventive maintenance, work orders.
* `fnb-agent`: Dining outlets, tables, restaurant reservations, meal plans.
* `finance-agent`: Folios, cashiering, payment gateways, tax engine, night audit.
* `commercial-agent`: Dynamic revenue rules, sales banqueting, group blocks.
* `crm-loyalty-agent`: Guest profiles, preferences, loyalty points ledger.
* `mobile-agent`: Guest mobile/web app, staff handheld app.
* `qa-agent`: E2E Playwright tests, contract validation, regression test suites.
* `devops-agent`: Docker, Kubernetes, CI/CD pipelines, infrastructure security.

---

## 3. Domain Ownership & Directory Boundaries

| Agent Role | Allowed Directories (Read/Write) | Strictly Forbidden Directories |
| :--- | :--- | :--- |
| **Platform Agent** | `apps/api-core/src/modules/platform/`, `packages/database/prisma/schemas/platform.prisma` | Any business module under `pms/`, `frontoffice/`, `finance/`, `operations/` |
| **PMS Agent** | `apps/api-core/src/modules/pms/`, `packages/database/prisma/schemas/pms.prisma` | `finance/`, `housekeeping/`, `engineering/`, `apps/web-shell/` |
| **Front Office Agent** | `apps/api-core/src/modules/frontoffice/`, `apps/web-shell/src/app/features/frontdesk/` | Direct SQL on `finance_schema`, `platform/auth/`, `operations/engineering/` |
| **Rooms / HK Agent** | `apps/api-core/src/modules/operations/housekeeping/`, `apps/web-shell/src/app/features/housekeeping/` | `pms/reservations/`, `finance/folios/`, `platform/` |
| **Engineering Agent** | `apps/api-core/src/modules/operations/engineering/`, `apps/web-shell/src/app/features/engineering/` | `pms/rate-plans/`, `finance/`, `crm/` |
| **F&B Agent** | `apps/api-core/src/modules/fnb/`, `packages/database/prisma/schemas/fnb.prisma` | Direct modification of `finance_schema.folios` |
| **Finance Agent** | `apps/api-core/src/modules/finance/`, `packages/database/prisma/schemas/finance.prisma` | `operations/housekeeping/`, `pms/inventory/` |
| **Commercial Agent** | `apps/api-core/src/modules/revenue/`, `apps/api-core/src/modules/sales/` | Core cashiering, room cleaning logic |
| **CRM / Loyalty Agent**| `apps/api-core/src/modules/crm/`, `packages/database/prisma/schemas/crm.prisma` | Direct modification of room status or folio balances |
| **Mobile Agent** | `apps/app-guest/`, `apps/app-staff/` | Any backend module under `apps/api-core/` |
| **QA Agent** | `tests/`, `packages/test-fixtures/` | Production application logic under `apps/api-core/src/modules/` |
| **DevOps Agent** | `infra/`, `.github/workflows/`, `docker-compose.yml`, `Dockerfile*` | Application domain logic or UI components |

---

## 4. API & Contract Governance
1. **Contract-First Development**: No controller or endpoint may be implemented without a pre-existing or accompanying OpenAPI 3.1 schema definition in `@hms/shared-contracts`.
2. **Standard Envelopes**: All endpoints must return standard JSON response envelopes (`{ success, data, meta }`) or RFC 7807 problem details on error.
3. **Idempotency**: All mutating `POST` and `PUT` endpoints altering financial or operational state must support the `Idempotency-Key` header.
4. **No Cross-Domain Direct Imports**: Modules must import external contracts solely through `@hms/shared-contracts` or declared internal query services.

---

## 5. Database Ownership & Access Rules
1. **Schema Exclusivity**: An agent may only modify tables residing in its assigned domain schema.
2. **Zero Cross-Schema Joins**: Cross-domain SQL queries are prohibited. Cross-domain relationships are stored as logical UUIDs.
3. **Prisma vs. Kysely Policy** ([ADR-0007](adr/ADR-0007-database-access-orm-query-builder-policy.md)):
   * Use **Prisma** for standard CRUD, migrations, and aggregate persistence.
   * Use **Kysely** only for pre-approved complex queries (Tape Chart, availability search, reporting).
   * Raw SQL is strictly forbidden without an approved Architecture Escalation.
4. **Ledger Immutability**: Financial transactions and audit logs are append-only. Never issue `DELETE` or `UPDATE` on ledger records.

---

## 6. Event Ownership & Messaging Rules
1. **Command vs. Event Distinction**: Commands represent requests (`CheckInGuest`); Events represent facts (`GuestCheckedIn`). Never emit a command over a public event exchange.
2. **Transactional Outbox Mandatory**: Events must be written to `audit_schema.outbox_events` inside the local database transaction. Direct publishing to RabbitMQ during an open transaction is strictly prohibited.
3. **Idempotent Consumers**: Every event consumer must record the CloudEvent `id` to guarantee deduplication upon redelivery.

---

## 7. Git Branching & Worktree Isolation Rules
1. **Branch Naming Standard**:
   `feature/{agent-role}/{domain}-{issue-id}`
   * Example: `feature/pms-agent/inventory-allocation-fix`
   * Example: `feature/frontoffice-agent/checkin-tapechart-integration`
2. **Worktree Isolation**: Each agent operates within a dedicated git worktree located at `.worktrees/{agent-role}`. Agents must never check out branches in a shared working directory.

---

## 8. Pull Request (PR) & Merge Rules
1. **Single-Domain Scope**: A PR must touch files in only one business domain (plus shared contracts if updating public DTOs).
2. **Automated CI Gates**:
   * Lint & Type-Check: 0 errors, 0 warnings.
   * Unit Tests: 100% pass, minimum 90% branch coverage on modified domain services.
   * Boundary Check: Automated script verifies that no forbidden files were modified.
3. **Approval Requirements**:
   * Peer review by QA Agent (automated tests verified).
   * Review and signoff by Lead Architect Agent.

---

## 9. Testing & Quality Requirements
1. **No Code Without Tests**: Submitting production logic without accompanying unit tests is considered a breach of this contract.
2. **Deterministic Time**: Tests must freeze system time when verifying reservations, night audits, or SLA timers.
3. **No Network Dependencies in Unit Tests**: Unit tests must not connect to external networks or live databases.

---

## 10. Architecture Escalation Process
If an AI developer agent encounters:
* An ambiguous business requirement.
* A perceived need to query across domain database schemas.
* A performance bottleneck requiring raw SQL or Kysely.
* A need to modify shared contracts or public event payloads.

**The agent MUST halt work and submit an Architecture Escalation Request**:
1. Post a structured issue with:
   * Current restriction.
   * Proposed change.
   * Impact analysis on downstream domains.
2. Await formal sign-off from the **Lead Architect Agent** (and human stakeholders if financial/security-critical) before proceeding.
