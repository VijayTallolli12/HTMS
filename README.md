# Enterprise Hospitality Management System (Enterprise HMS)

> **Wave 1 — Core Operating Loop Baseline**  
> Architecture Freeze Ratified: September 16, 2026

Enterprise HMS is a mission-critical, high-availability hospitality operating platform engineered as an **Event-Driven Modular Monolith** for enterprise luxury hotel chains. It unifies Property Management (PMS), Front Desk tape charts, Housekeeping task balancing, Financial folios, and Multi-Property Scoped RBAC into a single coherent system.

---

## Architecture Summary

| Tier / Component | Technology | Responsibility | Frozen Spec / ADR |
| :--- | :--- | :--- | :--- |
| **System Paradigm** | Event-Driven Modular Monolith | Single deployable monolith with strict package boundaries | [ADR-0001](docs/adr/ADR-0001-modular-monolith-architecture.md) |
| **Backend Core** | NestJS 10.3+ / TypeScript (Strict) | Layered architecture: Controllers → Application Services → Repositories | [ADR-0008](docs/adr/ADR-0008-backend-framework-nestjs-typescript.md) |
| **Frontend Shell** | Angular 18+ Standalone & Signals | Reactive domain shell, virtual scrolling tape charts, luxury design tokens | [ADR-0004](docs/adr/ADR-0004-angular-enterprise-frontend-architecture.md) |
| **Persistence** | PostgreSQL 16 (Domain Schemas) | Isolated schemas (`platform_schema`, `pms_schema`, etc.), UUIDv7 PKs | [ADR-0002](docs/adr/ADR-0002-multi-property-tenant-isolation-strategy.md) |
| **Message Broker** | RabbitMQ 3.13 (AMQP 0-9-1) | Asynchronous domain events, Transactional Outbox pattern, DLX | [ADR-0003](docs/adr/ADR-0003-event-driven-outbox-pattern.md) |
| **Distributed Cache** | Redis 7 | High-performance cache, idempotency locks (`idemp:*`), session cache | [ADR-0003](docs/adr/ADR-0003-event-driven-outbox-pattern.md) |
| **Email Testing** | Mailpit | Local SMTP capture (port 1025) and Web inspection mailbox (port 8025) | [14-DEPLOYMENT-ARCHITECTURE.md](docs/14-DEPLOYMENT-ARCHITECTURE.md) |

---

## Monorepo Layout

```
enterprise-hms/
├── apps/
│   ├── api-core/               # NestJS Core Monolith API (/api/v1)
│   └── web-shell/              # Angular 18+ Signals Management Shell
├── packages/
│   ├── database/               # PostgreSQL connection pooling & schema readiness
│   ├── shared/                 # UUIDv7 generators, Result types, domain constants
│   ├── api-contracts/          # Health contracts, RFC 7807 problem details, response envelopes
│   ├── ui/                     # Design tokens, luxury color palette, typography
│   └── config/                 # Environment validation and typed configurations
├── tests/
│   ├── unit/                   # Unit test suite
│   ├── integration/            # Infrastructure connectivity integration tests
│   └── e2e-playwright/         # Playwright smoke tests
├── infra/
│   ├── docker/
│   │   └── postgres/
│   │       └── init-schemas.sql # PostgreSQL domain schema initializer
│   └── scripts/
│       └── verify-infrastructure.js # Standalone infrastructure diagnostic script
├── .github/
│   └── workflows/ci.yml        # CI Pipeline (Lint, Typecheck, Build, Test)
├── docker-compose.yml          # Local infrastructure stack (Postgres, RabbitMQ, Redis, Mailpit)
├── .env.example                # Canonical environment variable specification
├── tsconfig.base.json          # Root TypeScript configuration with path aliases
└── package.json                # npm workspaces root configuration
```

---

## Prerequisites

Before running Enterprise HMS locally, ensure the following are installed:

- **Node.js**: `v20.x` or `v22.x` (`v22.16.0` tested)
- **npm**: `v10.x` or `v11.x` (`v11.5.2` tested)
- **Docker**: `20.10+` with Docker Compose (`v2.x+` or `v5.x+`)

---

## Quick Start & Local Setup

### 1. Clone & Environment Configuration

```bash
# Clone the repository
git clone <repository-url>
cd enterprise-hms

# Switch to the foundation branch
git checkout feature/platform/w1-t01-foundation

# Copy the environment template
cp .env.example .env
```

> **Host Port Strategy Notice**:  
> In `.env`, `POSTGRES_PORT` defaults to `5433` to prevent collisions on machines where a host PostgreSQL service is already active on port `5432`. Inside the Docker network, PostgreSQL runs on standard port `5432`. If host port 5432 is free, you may set `POSTGRES_PORT=5432`.

### 2. Install Dependencies

```bash
npm install
```

### 3. Launch Local Infrastructure

```bash
npm run infra:up
```

Verify that all containers are healthy:
```bash
npm run infra:ps
```

Expected output:
```
NAME                      IMAGE                             STATUS
enterprise-hms-postgres   postgres:16-alpine                Up (healthy)
enterprise-hms-rabbitmq   rabbitmq:3.13-management-alpine   Up (healthy)
enterprise-hms-redis      redis:7-alpine                    Up (healthy)
enterprise-hms-mailpit    axllent/mailpit:v1.21.8           Up (healthy)
```

Run the standalone verification diagnostic:
```bash
node infra/scripts/verify-infrastructure.js
```

### 4. Build Monorepo

```bash
npm run build
```

### 5. Start Applications

Run both API Core and Web Shell simultaneously:
```bash
npm run dev
```

Or run them individually:
```bash
# Start NestJS API Core (http://localhost:3000)
npm run dev:api

# Start Angular Web Shell (http://localhost:4200)
npm run dev:web
```

---

## Verification & Health Check Endpoints

| Service / UI | URL | Description |
| :--- | :--- | :--- |
| **Angular Web Shell** | `http://localhost:4200` | Management UI & real-time infrastructure health dashboard |
| **API Health Check** | `http://localhost:3000/api/v1/health` | Aggregated health probe evaluating Postgres, RabbitMQ, Redis, Mailpit |
| **API Liveness** | `http://localhost:3000/api/v1/health/liveness` | Process liveness probe |
| **API Readiness** | `http://localhost:3000/api/v1/health/readiness` | Dependency readiness probe |
| **Swagger UI** | `http://localhost:3000/api/docs` | Interactive OpenAPI 3.1 contract documentation |
| **RabbitMQ Management** | `http://localhost:15672` | RabbitMQ web management console (`hms_rabbit` / `hms_rabbit_dev_pass_2026`) |
| **Mailpit Web Mailbox** | `http://localhost:8025` | In-browser email inbox for captured transactional emails |

---

## Monorepo Commands Reference

| Command | Description |
| :--- | :--- |
| `npm run infra:up` | Boot Docker Compose services in the background |
| `npm run infra:down` | Stop and tear down Docker Compose services |
| `npm run infra:ps` | List running infrastructure containers and health statuses |
| `npm run infra:logs` | Follow infrastructure container logs |
| `npm run dev` | Start both NestJS API and Angular Web Shell concurrently |
| `npm run build` | Build all packages and applications |
| `npm run test` | Run all unit tests |
| `npm run test:integration` | Run integration tests against running Docker stack |
| `npm run lint` | Run ESLint across packages, apps, and tests |
| `npm run format` | Check formatting compliance using Prettier |
| `npm run format:fix` | Fix formatting using Prettier |
| `npm run typecheck` | Execute strict TypeScript compiler check (`tsc --noEmit`) |

---

## Troubleshooting

### 1. Port 5432 already in use
If you encounter `bind: address already in use` for PostgreSQL, a local PostgreSQL instance is likely running on your host machine.
* Leave `POSTGRES_PORT=5433` in `.env`.
* Docker Compose binds the container's internal port `5432` to host port `5433`.
* NestJS and the test suite automatically read `POSTGRES_PORT` from `.env`.

### 2. RabbitMQ taking a few seconds to report healthy
RabbitMQ alpine container performs internal node clustering checks upon startup. The healthcheck includes a 15-second `start_period`. Give the container ~10–15 seconds to report `(healthy)`.

### 3. Redis authentication error
Verify that `REDIS_PASSWORD` in `.env` matches the password configured in `docker-compose.yml`. Docker Compose loads `REDIS_PASSWORD` directly from `.env`.
