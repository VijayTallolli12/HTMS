# Deployment Architecture & Infrastructure Strategy: Enterprise HMS

## 1. Separation of Concerns: Development vs. Production Infrastructure

To prevent premature infrastructure complexity from slowing down development and AI agent engineering, Enterprise HMS strictly separates the **Local Development Baseline** from the **Enterprise Production Target**:

```
+-------------------------------------------------------------------------------+
|                       TIER 1: LOCAL DEVELOPMENT BASELINE                      |
|  - Tooling: Pure Docker Compose (Single docker-compose.yml)                   |
|  - Services: PostgreSQL 16 + Redis 7 + RabbitMQ 3.13 + Mailpit                |
|  - Applications: Node.js / NestJS (Backend) + Angular 18 (Frontend)           |
|  - Zero Kubernetes requirement for local implementation or AI testing!        |
+-------------------------------------------------------------------------------+
                                        | (Progressive Delivery Pipeline)
                                        v
+-------------------------------------------------------------------------------+
|                      TIER 2: ENTERPRISE PRODUCTION TARGET                     |
|  - Managed Compute: Managed Kubernetes (AWS EKS / Azure AKS) Multi-AZ         |
|  - Managed Persistence: AWS Aurora PostgreSQL 16 Multi-AZ with Continuous WAL |
|  - Managed Message Broker: Amazon MQ for RabbitMQ (Clustered)                 |
|  - Managed Distributed Cache: AWS ElastiCache for Redis                       |
|  - Edge & Security: Cloudflare Enterprise WAF, DDoS Shield & Anycast CDN      |
|  - Observability: OpenTelemetry Tracing, Prometheus Metrics, Grafana Loki     |
+-------------------------------------------------------------------------------+
```

---

## 2. Local Development Baseline (Docker Compose)

The local engineering environment boots in under 15 seconds using a single command (`docker compose up -d`).

### Local Service Definitions:
* **`postgres`**: PostgreSQL 16 Alpine running on port `5432` with pre-created domain schemas (`platform_schema`, `pms_schema`, `operations_schema`, `finance_schema`, `audit_schema`).
* **`rabbitmq`**: RabbitMQ 3.13 Alpine with Management Plugin running AMQP on port `5672` and Web UI on port `15672`.
* **`redis`**: Redis 7 Alpine running on port `6379` for session cache and idempotency locks.
* **`mailpit`**: Lightweight SMTP testing server running SMTP on port `1025` and Web UI on port `8025` for email verification.

---

## 3. Enterprise Production Architecture

### 3.1 High Availability & Disaster Recovery
* **Recovery Point Objective (RPO)**: < 1 minute (Synchronous multi-AZ PostgreSQL replication with continuous WAL archiving to air-gapped S3 storage).
* **Recovery Time Objective (RTO)**: < 5 minutes (Automated Aurora database failover and Kubernetes pod self-healing).
* **High Availability Target**: 99.99% operational uptime across portfolio hotels.

### 3.2 Continuous Deployment (CI/CD) Pipeline
GitHub Actions enforces automated quality gates:
1. **Lint & Static Analysis**: ESLint, strict TypeScript compiler check (`tsc --noEmit`).
2. **Automated Test Matrix**: Domain aggregate unit tests (>90% branch coverage), OpenAPI contract verification.
3. **Container Security Scan**: Trivy container vulnerability scanner checking non-root Distroless base images.
4. **Blue/Green Deployment**: Zero-downtime rolling traffic shift on Kubernetes cluster with synthetic health probes.

### 3.3 Observability & Telemetry
* **Tracing**: OpenTelemetry context injected into HTTP and AMQP message headers (`X-Correlation-ID`).
* **Metrics**: Prometheus scraping request latency, DB pool saturation, and Outbox lag.
* **Alerting**: PagerDuty integration for P1 operational incidents (Night audit failure, Payment gateway offline).
