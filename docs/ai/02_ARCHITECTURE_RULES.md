# 02 — Architecture Rules & Standards

Compact reference for architectural principles, boundaries, and system patterns. Existing documents under `docs/` remain the source of truth.

---

## 1. System Paradigm: Event-Driven Modular Monolith

- **Modular Monolith**: Single deployable backend (`apps/api-core`) structured into cleanly isolated domain modules (`organization`, `identity`, `pms`, `frontoffice`, `operations`, `finance`). Source of truth: `docs/adr/ADR-0001-modular-monolith-architecture.md`, `docs/01-PRODUCT-VISION.md`.
- **Package Isolation**: Shared DTOs, contracts, and constants live in `packages/api-contracts` and `packages/shared`. Cross-module communication occurs via explicit application query services or asynchronous events. Source of truth: `docs/AI-DEVELOPER-CONTRACT.md`.

---

## 2. API & Contract Standards

- **OpenAPI 3.1 First**: All endpoints must conform to contracts defined in `@hms/api-contracts`. Source of truth: `docs/08-API-CONTRACTS.md`.
- **Response Envelopes**: Standard success envelope `{ success: true, data: T, meta?: Record<string, unknown> }`. Source of truth: `docs/08-API-CONTRACTS.md`.
- **Error Format**: RFC 7807 Problem Details (`{ type, title, status, detail, instance, invalidParams }`). Source of truth: `docs/08-API-CONTRACTS.md`.
- **Mobile-Ready**: Design all payloads compact, avoiding deep nested relational graphs; support pagination on all list endpoints. Source of truth: `docs/08-API-CONTRACTS.md`.

---

## 3. Messaging, Events & Transactional Outbox

- **Commands vs. Events**: Commands indicate intent (`CreateReservation`); Events represent immutable historical facts (`com.enterprise_hms.pms.reservation.created.v1`). Source of truth: `docs/09-EVENT-CATALOG.md`.
- **CloudEvents v1.0**: All domain events follow the CloudEvents v1.0 standard with `id`, `source`, `type`, `time`, `propertyId`, and typed `data`. Source of truth: `docs/09-EVENT-CATALOG.md`.
- **Transactional Outbox**: Events must be written to `audit_schema.outbox_events` in the same interactive transaction as the aggregate state change. Never emit directly to RabbitMQ during an open transaction. Source of truth: `docs/adr/ADR-0003-event-driven-outbox-pattern.md`.
- **Broker & Deduplication**: RabbitMQ 3.13+ with Topic Exchanges and Dead Letter Exchanges. Consumers must deduplicate using the event `id`. Source of truth: `docs/adr/ADR-0003-event-driven-outbox-pattern.md`.

---

## 4. Organizational Hierarchy & Scoping

- **Strict Tree**: `HotelGroup` -> `Region` -> `Country` -> `Property` -> `Building` -> `Floor` -> `Room`. Source of truth: `docs/03-ORGANIZATION-MODEL.md`.
- **Mandatory Property Scoping**: All operational tables (`rooms`, `daily_inventory`, `reservations`, `room_maintenance_blocks`) must include `property_id` with composite foreign keys to guarantee physical isolation. Source of truth: `docs/03-ORGANIZATION-MODEL.md`, `docs/adr/ADR-0002-multi-property-tenant-isolation-strategy.md`.

---

## 5. Security & Authorization

- **Stateless Tokens**: JWT RS256 verified per request with public key caching in Redis. Source of truth: `docs/12-SECURITY-ARCHITECTURE.md`.
- **Scoped Guards**: Routes protected by `@RequirePropertyContext()`, `@RequirePermissions(...)`, and `ScopedRbacGuard`. Cross-property access is blocked at the guard layer. Source of truth: `docs/adr/ADR-0005-unified-identity-rbac-scoping.md`, `docs/04-USER-ROLES-PERMISSIONS.md`.

---

## 6. Persistence & Caching

- **PostgreSQL 16+ Multi-Schema**: Separate domain schemas (`platform_schema`, `pms_schema`, `audit_schema`). Source of truth: `docs/07-DATABASE-ARCHITECTURE.md`.
- **UUIDv7 Primary Keys**: Time-ordered UUIDv7 generated application-side. Source of truth: `docs/07-DATABASE-ARCHITECTURE.md`.
- **Redis 7**: Session stores, token blacklists, cache, and distributed locks. Source of truth: `docs/07-DATABASE-ARCHITECTURE.md`.

---

## 7. Environments & Deployment

- **Development**: Docker Compose (`infra/docker-compose.yml`) running PostgreSQL, RabbitMQ, Redis, Mailpit. Source of truth: `docs/14-DEPLOYMENT-ARCHITECTURE.md`.
- **Production Target**: Managed Kubernetes (EKS/AKS) + Amazon Aurora Multi-AZ + Amazon MQ (RabbitMQ). Source of truth: `docs/14-DEPLOYMENT-ARCHITECTURE.md`.
