# 08 — Testing Rules & Quality Gates

Authoritative expectations for test suites, concurrency verifications, and quality gates. Existing documents under `docs/` remain the source of truth.

---

## 1. Testing Pyramid & Structure

- **Unit Tests (`tests/unit/`)**: Fast, pure in-memory execution using Jest mocks. Tests state machine logic, pure restriction evaluators, DTO validators, and calculations. Zero live network or database calls. Source: `docs/13-TESTING-STRATEGY.md`.
- **Integration Tests (`tests/integration/`)**: Real database execution against the local PostgreSQL container. Tests Prisma transactions, composite foreign keys, partial indexes, PostgreSQL GiST exclusion constraints, and OCC collisions. Runs with `--runInBand`. Source: `docs/13-TESTING-STRATEGY.md`.
- **E2E Tests (`tests/e2e-playwright/`)**: Playwright browser tests verifying end-to-end user journeys across the Angular shell and API backend. Source: `docs/13-TESTING-STRATEGY.md`.

---

## 2. Mandatory Verification Categories per Task

Every implementation task must include automated tests covering:

1. **Happy Path & Lifecycle**: Valid entity creation, state transitions, updates, queries, and soft deletions.
2. **State Machine Invariants**: Forbidden transitions must throw HTTP 400 `BadRequestException` and verify zero database mutations.
3. **Optimistic Concurrency Control (OCC)**: Version mismatch updates must throw HTTP 409 `ConflictException`.
4. **Concurrency & Race Conditions**: Parallel conflicting requests (e.g. 10 concurrent requests for the same room/date) must verify that **EXACTLY ONE** succeeds and all others fail with HTTP 409 `ConflictException`.
5. **Database Exclusion / Unique Rollback**: Verify that failing exclusion transactions perform complete ACID rollbacks (no partial inventory or outbox row creation).
6. **Idempotency Verification**: Repeated requests with the same `Idempotency-Key` must return identical responses without side effects.
7. **Scoped Authorization & Isolation**: Cross-property requests must be rejected with HTTP 403 / 404.
8. **Transactional Outbox Event Generation**: Verify that correct CloudEvents v1.0 records are written to `audit_schema.outbox_events`.
9. **Full Regression Suite**: All tests from previously completed tasks must execute and pass 100%.

---

## 3. Mandatory Quality Gates

Before presenting work for human commit approval, all five gates must pass cleanly:

```bash
# 1. Linting (0 errors, 0 warnings)
npm run lint

# 2. TypeScript Compilation (0 errors)
npm run typecheck

# 3. Code Formatting (100% compliant)
npm run format

# 4. Package & Application Builds
npm run build:packages
npm run build:api

# 5. Full Test Execution
npm run test:unit
npm run test:integration -- tests/integration/<target-suite>.spec.ts
```
