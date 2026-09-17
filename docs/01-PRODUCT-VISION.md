# Product Vision & Architectural Blueprint: Enterprise HMS

## 1. Executive Summary
The Enterprise Hospitality Operating Platform (Enterprise HMS) is an enterprise-grade hospitality operating platform architected for luxury hotel chains, multi-property resort groups, and high-end hospitality portfolios. It unifies corporate governance, multi-property cluster management, on-property departmental operations, and omnichannel guest touchpoints into a cohesive, event-driven ecosystem.

---

## 2. Product Boundaries & Architectural Paradigm
Enterprise HMS establishes clear functional boundaries, decoupling operational domains, and providing real-time data synchronization.

### Recommended Architectural Pattern: Event-Driven Modular Monolith
We adopt an **Event-Driven Modular Monolith** rather than a distributed microservices cluster for the foundation phase (see [ADR-0001](adr/ADR-0001-modular-monolith-architecture.md)).

```
+-------------------------------------------------------------------------------+
|                             Client & Channel Layer                            |
|  [Corporate Admin Web]  [Property Desk Web]  [Staff App]  [Guest Native/Web]  |
+-------------------------------------------------------------------------------+
                                        | (HTTPS / WSS)
+---------------------------------------v---------------------------------------+
|                             API Gateway & Security                           |
|        Authentication (OIDC/JWT) | RBAC Scope Resolver | Rate Limiter        |
+-------------------------------------------------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                          Enterprise HMS Core Monolith                         |
|                                                                               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |    CORE PLATFORM    |  |         PMS         |  |    FRONT OFFICE     |    |
|  | Org, Auth, Config   |  | Inventory, Rates    |  | Check-in, Desk      |    |
|  +---------------------+  +---------------------+  +---------------------+    |
|             |                        |                        |               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |  ROOMS OPERATIONS   |  |     HOUSEKEEPING    |  |     ENGINEERING     |    |
|  | Room State Machine  |  | Attendant, Clean    |  | Work Orders, Assets |    |
|  +---------------------+  +---------------------+  +---------------------+    |
|             |                        |                        |               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |    F&B & OUTLETS    |  |    SPA & WELLNESS   |  |   SALES & EVENTS    |    |
|  | Tables, POS Bridge  |  | Therapists, Slots   |  | Banquets, BEO       |    |
|  +---------------------+  +---------------------+  +---------------------+    |
|             |                        |                        |               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  | REVENUE MANAGEMENT  |  |       FINANCE       |  |     PROCUREMENT     |    |
|  | Dynamic Pricing     |  | Folio, Cashier, AR  |  | Inventory, Stock    |    |
|  +---------------------+  +---------------------+  +---------------------+    |
|             |                        |                        |               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |     CRM & GUEST     |  |       LOYALTY       |  |   GUEST SERVICES    |    |
|  | Profiles, Prefs     |  | Tiers, Points, Vouchers| Concierge, Transport |   |
|  +---------------------+  +---------------------+  +---------------------+    |
|             |                        |                        |               |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |    HR/WORKFORCE     |  |      ANALYTICS      |  | INTEGRATIONS GATEWAY|    |
|  | Shifts, Rostering   |  | Reporting, OLAP     |  | OTA, POS, Locks, PBX|    |
|  +---------------------+  +---------------------+  +---------------------+    |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                  Transactional Outbox Publisher Engine                  |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
           |                                                      |
+----------v-----------------------------+   +--------------------v-------------+
|    PostgreSQL Multi-Tenant Database    |   |     RabbitMQ AMQP Message Broker |
|  (Domain Schemas & Audit Outbox)       |   |  (Topic Exchanges & Dead Letters)|
+----------------------------------------+   +----------------------------------+
                                                                  |
                                             +--------------------v-------------+
                                             | Redis (Cache, Idemp Locks & WSS) |
                                             +----------------------------------+
```

---

## 3. Reconciled Domain Taxonomy (The 18 Canonical Domains)

The system decomposes into **18 distinct domain modules** categorized by architectural classification:

### Tier 1: Platform Capabilities
1. **CORE PLATFORM & IDENTITY** (Platform Capability)
   * *Scope*: Multi-property organizational hierarchy (Group -> Region -> Country -> Property -> Building -> Floor -> Room/Outlet), Tenant configuration, Scoped RBAC/ABAC authorization engine, immutable system audit logging.
   * *Data Ownership*: `platform_schema` (`organizations`, `regions`, `properties`, `users`, `roles`, `permissions`, `audit_logs`).

2. **HR & WORKFORCE MANAGEMENT** (Platform Capability)
   * *Scope*: Multi-department staff rosters, shift scheduling, clock-in/out, skill certifications.
   * *Data Ownership*: `platform_schema` (`employees`, `shifts`, `rosters`, `certifications`).

3. **ANALYTICS & REPORTING** (Platform Capability)
   * *Scope*: Managerial KPI aggregations (RevPAR, ADR, TrevPAR, Occupancy), daily business snapshots, export pipelines.
   * *Data Ownership*: `analytics_schema` (`daily_property_metrics`, `historical_snapshots`).

### Tier 2: Core Business Domains (The Operational Engines)
4. **PROPERTY MANAGEMENT SYSTEM (PMS)** (Core Business Domain)
   * *Scope*: Physical room master records, room types, rate plans, restrictions (Min Stay, CTA, CTD), room availability calendar, central reservation aggregate.
   * *Data Ownership*: `pms_schema` (`room_types`, `physical_rooms`, `rate_plans`, `inventory_days`, `reservations`).

5. **FRONT OFFICE** (Core Business Domain)
   * *Scope*: Daily front desk operations, arrivals/departures processing, room assignment execution, walk-in reservations, keycard issuance triggers, night audit rollover.
   * *Data Ownership*: `pms_schema` (`daily_arrival_queue`, `registration_cards`, `night_audit_runs`).

6. **ROOMS OPERATIONS** (Core Business Domain)
   * *Scope*: Authoritative physical room status finite state machine (`Dirty`, `Pick-up`, `Clean`, `Inspected`, `Occupied`, `Out of Order`, `Out of Service`), room transition audit history.
   * *Data Ownership*: `operations_schema` (`room_status_records`, `room_status_history`).

7. **FINANCE & CASHIERING** (Core Business Domain)
   * *Scope*: Multi-window guest folios (Master, Incidentals, Company Billing), immutable transaction postings, payment processing, city ledger accounts receivable (AR), tax calculations, fiscal invoice generation.
   * *Data Ownership*: `finance_schema` (`folios`, `folio_transactions`, `payment_records`, `tax_rules`, `invoices`).

8. **CRM & GUEST PROFILES** (Core Business Domain)
   * *Scope*: Golden guest record, VIP tiering, contact preferences, cross-stay historical spend, allergy/medical warnings, preference profile curation.
   * *Data Ownership*: `crm_schema` (`guest_profiles`, `guest_preferences`, `stay_histories`).

### Tier 3: Supporting Hospitality Domains
9. **HOUSEKEEPING** (Supporting Domain)
   * *Scope*: Room attendant shift task balancing, cleaning credits, stayover/departure tasks, supervisor inspection workflows, linen par inventory.
   * *Data Ownership*: `operations_schema` (`housekeeping_tasks`, `attendant_sections`, `inspection_checklists`).

10. **ENGINEERING & MAINTENANCE** (Supporting Domain)
    * *Scope*: Equipment asset register, preventive maintenance schedules, reactive guest room work orders, spare parts consumption.
    * *Data Ownership*: `operations_schema` (`asset_items`, `maintenance_work_orders`, `preventive_schedules`).

11. **GUEST SERVICES & CONCIERGE** (Supporting Domain)
    * *Scope*: Omnichannel guest service tickets, SLA timers and escalation rules, bell desk luggage tracking, chauffeur dispatch, valet tickets.
    * *Data Ownership*: `operations_schema` (`service_requests`, `valet_tickets`, `luggage_tags`).

12. **FOOD & BEVERAGE (F&B)** (Supporting Domain)
    * *Scope*: Restaurant/bar outlets, table layout and reservation seating, meal plan entitlements (CP/MAP/AP), room service ordering bridge.
    * *Data Ownership*: `fnb_schema` (`dining_outlets`, `dining_tables`, `table_reservations`, `meal_plans`).

13. **SPA & WELLNESS** (Supporting Domain)
    * *Scope*: Treatment catalogs, therapist rosters, appointment scheduling, treatment room allocation.
    * *Data Ownership*: `spa_schema` (`treatment_catalog`, `therapist_rosters`, `spa_appointments`).

14. **SALES & BANQUETING** (Supporting Domain)
    * *Scope*: Event spaces, conference room bookings, Banquet Event Orders (BEO), group room blocks, corporate master agreements.
    * *Data Ownership*: `sales_schema` (`event_bookings`, `banquet_event_orders`, `group_blocks`).

15. **REVENUE MANAGEMENT** (Supporting Domain)
    * *Scope*: Dynamic pricing algorithms, demand forecasting models, hurdle rates, competitor benchmark feeds.
    * *Data Ownership*: `revenue_schema` (`pricing_rules`, `hurdle_rates`, `demand_forecasts`).

16. **PROCUREMENT & INVENTORY** (Supporting Domain)
    * *Scope*: Central storerooms, departmental stock requisitions, purchase orders, goods receipt notes (GRN), par-stock level alerts.
    * *Data Ownership*: `procurement_schema` (`inventory_items`, `stock_requisitions`, `purchase_orders`).

17. **LOYALTY** (Supporting Domain)
    * *Scope*: Membership tier qualification rules, points accrual ledger, rewards voucher redemption, airline mileage partnership bridge.
    * *Data Ownership*: `crm_schema` (`loyalty_accounts`, `points_transactions`, `tier_benefits`).

### Tier 4: Integration Capabilities
18. **INTEGRATION GATEWAY** (Integration Capability)
    * *Scope*: Hexagonal adapters for external Channel Managers/OTAs, GDS, Payment Gateways (Stripe/Adyen), Keyless Lock Systems, PBX Telecom, and Restaurant POS.
    * *Data Ownership*: `integration_schema` (`integration_credentials`, `webhook_subscriptions`, `inbound_event_logs`).

---

## 4. Cross-Cutting Services: AI and Event Broker
* **AI Concierge & Operations Service**: Cross-cutting intelligence layer governed by [ADR-0006](adr/ADR-0006-ai-operational-safety-boundaries.md). AI does not own entities; it consumes public APIs and domain events under strict human supervision.
* **Event Broker (RabbitMQ)**: Authoritative AMQP 0-9-1 message broker governed by [ADR-0003](adr/ADR-0003-event-driven-outbox-pattern.md).
