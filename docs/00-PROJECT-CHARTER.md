# Project Charter: Enterprise Hospitality Operating Platform (Enterprise HMS)

## 1. Executive Summary & Business Intent
The Enterprise Hospitality Operating Platform is a next-generation, cloud-native hospitality management and orchestration system engineered for luxury hotel groups, multi-property resort destinations, and high-touch boutique collections. 

Legacy Property Management Systems (PMS) suffer from rigid database silos, fragmented departmental applications, delayed operational synchronization, and brittle point-to-point integrations. This project establishes a unified, event-driven, multi-tenant hospitality platform that bridges corporate governance, regional oversight, and on-property luxury guest service delivery.

## 2. Platform Vision & Strategic Objectives
* **Unified Multi-Property Operations**: Single pane of glass for corporate executive leadership down to on-premise room attendants.
* **Flawless Guest Centricity**: Real-time guest lifecycle tracking from reservation through departure, capturing guest preferences, personalized itineraries, and loyalty history.
* **Real-time Event-Driven Coordination**: Instant operational handoffs between Front Office, Housekeeping, Engineering, Food & Beverage, Spa, and Concierge via an asynchronous event bus.
* **Enterprise Security & Compliance**: Strict role-based and organization-scoped data segregation, PCI-DSS compliance scope isolation (tokenized payments), and GDPR/DPDP-compliant PII governance.
* **Extensible & AI-Ready Architecture**: Clean hexagonal domain boundaries designed for future autonomous concierge agents, predictive maintenance models, and automated revenue optimization.

## 3. Project Scope
### In Scope
1. **Multi-Property Core Hierarchy**: Group -> Region -> Country -> Property -> Building -> Floor -> Room / Outlet / Facility.
2. **Core Domain Foundations**: Property Management System (PMS), Front Desk & Cashiering, Housekeeping Management, Engineering & Work Orders, Guest Services & Concierge, Profiles & Folios.
3. **Omni-Channel API Contracts**: Standardized RESTful and Event-driven APIs serving Web Admin, Guest Portal/App, Staff Mobile Handhelds, and Manager Tablets.
4. **Identity, Access & Multi-Tenant Scoping**: Unified Corporate/Regional/Property/Departmental RBAC model with context-switching capabilities.
5. **Operational Event Bus**: Outbox-pattern backed domain event catalog driving cross-departmental reactive workflows.
6. **Extensible Integration Gateway**: Webhook and adapter contracts for Channel Managers (OTA), GDS, Payment Gateways (Stripe/Adyen), Keyless Lock Systems (Assa Abloy / Salto), PBX, and POS.

### Out of Scope (Initial Foundation Phase)
1. Building custom accounting/general ledger engines (integration hooks provided for SAP/Oracle NetSuite).
2. Building standalone full-scale airline GDS engines.
3. Premature microservices explosion prior to domain stabilization.

## 4. Key Stakeholders & Governance
| Role | Responsibility | Key Concerns |
| :--- | :--- | :--- |
| **Corporate Leadership (C-Suite / VP Ops)** | Portfolio health, brand standards, consolidated reporting | Group-level visibility, revenue aggregate, brand compliance |
| **Regional Directors / Area GMs** | Regional performance, cluster operations, cross-property staff allocation | Regional yield, audit consistency, SLA adherence |
| **General Managers (Property)** | On-property P&L, guest satisfaction index (GSI), operational uptime | Real-time dashboards, crisis alerts, VIP movements |
| **Front Office & Rooms Directors** | Check-in throughput, room readiness, upselling, guest satisfaction | Instant room status changes, fast folio settlement, zero walk-ins |
| **Executive Housekeeper & Supervisors** | Turnaround speed, room hygiene standards, deep cleaning audits | Real-time dirty/clean transitions, task allocation, linen inventory |
| **Chief Engineer & Facilities** | Preventive maintenance, guest room issue resolution, asset lifecycle | Fast work order dispatch, MTTR (Mean Time to Resolution) |
| **F&B & Spa Directors** | Outlet reservations, charge-to-room verifications, table turns | Seamless folio cross-charging, guest preference sharing |
| **Lead AI & Engineering Agents** | System integrity, domain boundary enforcement, zero regression | Strict architectural contracts, test coverage, modular decoupling |

## 5. Architectural Guiding Principles
1. **Modular Monolith First**: Enforce strict domain boundaries within a modular codebase. Avoid premature network hops, operational orchestration overhead, and distributed transaction complexity until scale necessitates microservice extraction.
2. **Contract-First & API-Driven**: Every frontend, mobile client, and background worker consumes versioned, documented, schema-validated OpenAPI contracts.
3. **Event-Driven Asynchronous Coupling**: Synchronous operations are confined within domain transaction boundaries. Cross-domain notifications and side effects flow exclusively via durable domain events.
4. **Zero-Trust Multi-Tenancy**: Every database transaction, cache key, and event payload is strictly scoped to the tenant/property hierarchy.
5. **Resilient Offline-Tolerant Mobile Patterns**: Ground-level staff applications (housekeeping runners, maintenance engineers) must handle transient Wi-Fi dead zones gracefully.

## 6. Success Metrics & KPIs
* **Operational Latency**: Sub-100ms API response time for critical Front Desk search and room assignment queries.
* **Room Turnaround Time**: 25% reduction in room turnaround notification delays between Housekeeping clean completion and Front Desk check-in availability.
* **Check-in Efficiency**: VIP check-in flow completed in under 45 seconds via tablet / mobile key delivery.
* **Cross-Departmental SLA**: 100% of guest service requests acknowledged within 3 minutes and routed to correct teams.
* **Architectural Quality**: 0 cross-domain database foreign key violations, 100% ADR compliance, >85% automated test coverage across domain workflows.
