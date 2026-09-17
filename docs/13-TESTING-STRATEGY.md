# Comprehensive Testing Strategy & Quality Assurance: Enterprise HMS

## 1. Quality Philosophy & Testing Pyramid
Enterprise HMS operates in a mission-critical, 24/7/365 luxury hospitality environment where software failures directly impact guest satisfaction, staff productivity, and multi-million dollar hotel revenues.
We adhere to a rigorous **Testing Pyramid** where fast, deterministic unit tests provide broad foundational confidence, complemented by contract, integration, and full end-to-end Playwright tests.

```
                  /                  /                   / E2E \           Playwright Suite (Critical Guest Journeys)
               /-------              / Security\         OWASP ZAP, Dependency Audits, RBAC Pen-tests
             /-----------            / Integration \       Testcontainers PostgreSQL, Redis, Outbox Bus
           /---------------          /  API & Contract \     OpenAPI Schema Validation, Mockoon, Supertest
         /-------------------        /     Unit Tests      \   Domain Aggregates, State Machines, Folio Math
       +-----------------------+
```

---

## 2. Test Level Specifications

### 2.1 Unit Tests
* **Focus**: Domain aggregates, pure business logic, finite state machines, rate calculations, folio balance math.
* **Standards**: Zero network calls, zero database connections, execution time < 10ms per test file.
* **Target Coverage**: Minimum 90% branch coverage on core domain packages (`pms`, `operations`, `finance`).

### 2.2 API & Contract Tests
* **Focus**: Verification that every API endpoint conforms strictly to its OpenAPI 3.1 contract.
* **Coverage**: Request payload validation, query parameter parsing, RFC 7807 error responses, idempotency header handling.

### 2.3 Integration Tests (Database & Message Bus)
* **Focus**: Repository queries, multi-property scoping queries, optimistic locking conflicts, transaction rollbacks, and Outbox event publishing.
* **Tooling**: **Testcontainers** running ephemeral PostgreSQL 16 and Redis instances in Docker.

### 2.4 End-to-End (E2E) Browser Tests (Playwright)
* **Focus**: Full front-to-back operational flows across the Angular application shell.
* **Execution**: Headless browser automation running against a fully seeded staging environment.

---

## 3. Critical Business Workflows Coverage Matrix

| Critical Workflow | Required Test Layers | Key Invariants Verified |
| :--- | :--- | :--- |
| **1. Reservation Creation** | Unit + API + Integration + E2E | Inventory decrements by exactly 1; dates validated; confirmation code generated. |
| **2. Room Assignment** | Unit + API + Integration | Room matches room type or upgrade; dirty/OOO rooms cannot be assigned to VIPs. |
| **3. Guest Check-In** | Unit + API + E2E | Room state changes to `Occupied`; payment pre-authorization confirmed; keycard event emitted. |
| **4. Room Status Lifecycle** | Unit + Integration + E2E | State machine prevents invalid transitions (e.g., cannot jump from Dirty directly to Inspected). |
| **5. Housekeeping Task Run**| Unit + Integration | Task points balanced across staff; start/finish timestamps logged. |
| **6. Work Order Dispatch** | Unit + Integration | Urgent tickets notify Chief Engineer; room placed OOO if severity requires. |
| **7. Service Request SLA** | Unit + Integration | Escalation triggers automatically if unassigned after 3 minutes. |
| **8. Folio Charge Posting** | Unit + API + Integration | Immutable ledger entry; tax computed accurately; room occupancy verified. |
| **9. Payment Processing** | API + Integration (Mock Gateway)| Balance updated atomically; card tokens never leak raw PANs. |
| **10. Guest Checkout** | Unit + API + E2E | Balance must be exactly $0.00; room state trips to Dirty; keycard revoked. |

---

## 4. Test Data Management & Deterministic Factories
1. **No Shared Mutable State**: Tests generate isolated tenant and property fixtures via typed factories (`createTestProperty()`, `createTestReservation()`).
2. **Deterministic Time**: Tests mocking checkout or night audit freeze system clocks using standard time mocking utilities (`vi.setSystemTime` or equivalent).
