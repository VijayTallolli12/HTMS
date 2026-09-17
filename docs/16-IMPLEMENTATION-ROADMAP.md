# Implementation Roadmap & Phased Execution Plan: Enterprise HMS

## 1. Roadmap Overview & Phased Strategy
To guarantee stability, architectural integrity, and rapid delivery of enterprise hospitality capabilities, Enterprise HMS follows a disciplined 6-phase implementation roadmap.

```
[Phase 0: Foundation] -> [Phase 1: Platform & PMS] -> [Phase 2: Rooms & HK]
                                                               |
[Phase 5: F&B & Spa]  <- [Phase 4: Guest & Mobile]  <- [Phase 3: Finance & Integrations]
         |
         v
[Phase 6: AI Agents & Predictive Optimization]
```

---

## 2. Detailed Phase Breakdown

### Phase 0: Architectural & Engineering Foundation (Weeks 1 - 2)
* **Focus**: Architectural blueprinting, repository scaffolding, CI/CD pipeline, and developer constitution.
* **Key Deliverables**:
  * Complete foundational architecture documentation (`docs/00` to `docs/16`).
  * Architecture Decision Records (ADR-0001 through ADR-0005).
  * Monorepo workspace scaffolding (NX workspace with `@hms/core`, `@hms/api-client`, `@hms/shared-contracts`).
  * Local development environment with Docker Compose (PostgreSQL 16, Redis, RabbitMQ, Mailpit).
* **Exit Criteria**: Clean local build, zero lint errors, test pipeline green.

### Phase 1: Core Platform & PMS Engine (Weeks 3 - 6)
* **Focus**: Organizational hierarchy, identity & RBAC, inventory, rate plans, and reservation engine.
* **Key Deliverables**:
  * Multi-property hierarchy model (Group -> Region -> Property -> Building -> Floor -> Room).
  * Authentication & authorization service (JWT + OAuth2 + Property Context header resolution).
  * PMS Inventory Engine (Room types, physical rooms, daily availability calendar).
  * Rate Engine (Base rates, seasonal rates, minimum stay & CTA/CTD rules).
  * Core Reservation Aggregate (Create, modify, cancel, and calculate deposits).
* **Exit Criteria**: >90% unit test coverage on reservation invariants; successful execution of automated booking workflows.

### Phase 2: Rooms Operations & Service Delivery (Weeks 7 - 10)
* **Focus**: Physical room state machine, housekeeping dispatch, engineering work orders, and guest service requests.
* **Key Deliverables**:
  * Rooms Operations state machine (`Dirty` -> `Cleaning` -> `Clean` -> `Inspected` -> `Occupied`).
  * Housekeeping Task Management (Automatic morning task generation, credit balancing, supervisor inspection board).
  * Engineering Maintenance Ticket Engine (Work order dispatch, severity alerting, asset downtime tracking).
  * Guest Service Request SLA Tracker (Omnichannel requests, runner dispatch, automated 3-minute escalation).
* **Exit Criteria**: Real-time room status updates functioning across WebSocket channels with sub-100ms UI sync.

### Phase 3: Finance, Folios, Cashiering & Integrations (Weeks 11 - 14)
* **Focus**: Multi-window billing folios, payment gateways, tax calculation, and channel manager connectivity.
* **Key Deliverables**:
  * Guest Folio Ledger (Master, Incidentals, and Company billing windows).
  * Immutable Transaction Posting Engine (Room & tax charges, F&B tickets, phone charges, allowances).
  * Payment Gateway Adapter (Stripe / Adyen hosted tokenization, pre-authorizations, settlement).
  * Automated Night Audit Run (End-of-day rollover, automated room charge postings, ledger discrepancy checks).
  * Channel Manager Adapter (2-way sync for Booking.com & Expedia ARI).
* **Exit Criteria**: Night audit balances to zero cents across all properties; PCI-DSS tokenized payments settle successfully.

### Phase 4: Guest Digital Experience & Mobile Handhelds (Weeks 15 - 18)
* **Focus**: Omni-channel guest portal, guest native mobile app, and staff operational handheld apps.
* **Key Deliverables**:
  * Responsive Guest Portal (Mobile-first web for direct booking, profile curation, and invoice downloads).
  * Guest Mobile Application (Digital check-in, BLE mobile door key, in-room service ordering).
  * Staff Mobile Application (Room attendant task list, maintenance runner work order updates).
  * Door Lock Integration Gateway (Assa Abloy / Salto keycard encoding and BLE delivery).
* **Exit Criteria**: End-to-end digital check-in completed on mobile device with digital key unlocking simulated door lock.

### Phase 5: Luxury Amenities: F&B, Spa & Events (Weeks 19 - 22)
* **Focus**: On-property revenue centers, table reservations, spa appointments, and banquet management.
* **Key Deliverables**:
  * F&B Outlet Management (Dining tables, seating reservation, POS room charge verification bridge).
  * Spa & Wellness Engine (Treatment menus, therapist rosters, appointment scheduling).
  * Sales & Banqueting (Event spaces, Banquet Event Orders - BEO, group room blocks).
* **Exit Criteria**: Seamless cross-charging from restaurant POS directly to in-house guest folio.

### Phase 6: Autonomous AI Agents & Predictive Optimization (Weeks 23 - 26)
* **Focus**: Autonomous concierge agents, predictive maintenance, and dynamic yield optimization.
* **Key Deliverables**:
  * Omnichannel AI Concierge (Natural language guest recommendations, dining bookings, housekeeping dispatch).
  * Predictive Maintenance Anomaly Detector (HVAC energy signature monitoring).
  * Dynamic Revenue Yield Engine (Automated hurdle rate recommendations based on market demand).
* **Exit Criteria**: Autonomous concierge resolves >60% of common guest requests without human agent intervention.
