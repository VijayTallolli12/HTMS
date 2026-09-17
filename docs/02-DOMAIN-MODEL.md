# Domain Model & Entity Architecture: Enterprise HMS

## 1. Architectural Philosophy & Aggregate Boundaries
The Enterprise HMS conceptual domain model defines business entities, invariants, aggregate roots, and cross-domain associations.
To prevent coupling and maintain strict modularity:
* **Aggregate Roots** encapsulate all modifications to internal entity states.
* Cross-aggregate references are maintained via **strongly typed IDs** (UUIDv7), not direct object references or cross-schema foreign keys.
* Every entity is scoped to its hierarchical owner (Group, Property, or Tenant).

---

## 2. Core Domain Entities & Aggregates

### 2.1 Core Platform & Identity
`
+-------------------+           1..* +-------------------+
| OrganizationGroup | <------------> |      Region       |
+-------------------+                +-------------------+
         | 1                                  | 1
         |                                    |
         v 1..*                               v 1..*
+-------------------+                +-------------------+
|      Tenant       |                |     Property      |
+-------------------+                +-------------------+
         | 1                                  | 1
         v 1..*                               v 1..*
+-------------------+                +-------------------+
|       User        |                |     Building      |
+-------------------+                +-------------------+
         | 1..*                               | 1
         v 1..*                               v 1..*
+-------------------+                +-------------------+
|   RoleAssignment  |                |       Floor       |
+-------------------+                +-------------------+
`
* **OrganizationGroup**: The overarching holding company or hotel brand (e.g., *Grandeur Luxury Hospitality*).
* **Region**: Continental or geographical cluster (e.g., *Middle East & APAC*, *Americas Luxury*).
* **Property**: Individual luxury hotel, resort, or lodge (e.g., *The Grandeur Palace Paris*).
* **Building**: Physical architectural tower, wing, or villa cluster (e.g., *West Wing*, *Royal Villas*).
* **Floor**: Physical level within a building (e.g., *Floor 04*, *Penthouse Deck*).
* **Department**: Operational unit within a property or corporate division (e.g., *Front Desk*, *Engineering*).
* **Employee**: Personnel profile containing employment contract, base property, and shift eligibility.
* **User**: System identity holding credentials, active sessions, and multi-factor authentication bindings.
* **Role & Permission**: Granular operational capabilities bound to hierarchical scopes.

---

### 2.2 Property Management System (PMS) & Inventory
* **RoomType**: Aggregate root defining room categories (e.g., *Deluxe Ocean View*, *Presidential Suite*). Attributes: base occupancy, max rollaway beds, square footage, amenity sets.
* **PhysicalRoom**: Individual physical room unit (e.g., *Room 402*). References Building, Floor, and current RoomType. Contains hardware lock ID, phone extension, and physical features (e.g., balcony, accessible).
* **RatePlan**: Aggregate root for pricing strategies (e.g., *Best Available Rate - Room Only*, *Gourmet Package MAP*). Defines cancellation terms, deposit requirements, and meal inclusions.
* **InventoryDay**: Snapshot of daily room inventory by RoomType per Property. Tracks Total Rooms, Physical Out of Order, Booked Count, Overbooking Limit, and Available to Sell (ATS).
* **Reservation**: Aggregate root for guest bookings.
  * **Invariants**: Check-out date must be strictly after Check-in date; Room allocated must match or upgrade the booked RoomType.
  * **Child Entities**: ReservationGuest, ReservationRateNight, SpecialRequest, AddOnPackage.

---

### 2.3 Rooms Operations & Housekeeping
`
+-------------------------------------------------------------------------+
|                         Physical Room States                            |
|                                                                         |
|   +--------------+      Housekeeper Cleans       +------------------+   |
|   |    Dirty     | ----------------------------> |      Clean       |   |
|   +--------------+                               +------------------+   |
|          ^                                                |             |
|          | Guest Departs                                  | Supervisor  |
|          | or Daily Stayover                              | Inspects    |
|          |                                                v             |
|   +--------------+      Front Desk Check-in      +------------------+   |
|   |   Occupied   | <---------------------------- |     Inspected    |   |
|   +--------------+                               +------------------+   |
|          |                                                ^             |
|          |                                                | Maintenance |
|          v Issue Reported                                 | Cleared     |
|   +-----------------------------------------------------------------+   |
|   |         Out of Order (OOO) / Out of Service (OOS)               |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
`
* **RoomStatusRecord**: Single source of truth for the room's physical condition (Dirty, Pick-up, Clean, Inspected, Out-of-Order, Out-of-Service) and occupancy state (Vacant, Occupied).
* **HousekeepingTask**: Work assignment given to a Room Attendant. Captures Task Type (*Stayover Cleaning*, *Departure Full Turn*, *Turndown*, *Deep Clean*), target credit points, actual start/completion timestamps, and linen replenish count.
* **RoomInspectionRecord**: Quality assurance checklist performed by a Floor Supervisor before advancing a room from Clean to Inspected (VIP ready).

---

### 2.4 Engineering & Facilities
* **AssetItem**: Physical equipment registered in the hotel (e.g., *Chiller Unit #3*, *Elevator B*, *Suite 501 HVAC Unit*). Tracks serial number, warranty, installation date, and maintenance log.
* **MaintenanceWorkOrder**: Urgent repair or corrective maintenance ticket. Contains Priority (Urgent/Guest Impacting, High, Normal, Low), reporter details, assigned technician, parts consumed, and resolution notes.
* **PreventiveSchedule**: Recurring cadence rules for equipment servicing (e.g., quarterly HVAC filter changes).

---

### 2.5 Finance, Folios & Cashiering
* **Folio**: Financial billing ledger associated with a reservation, group, or corporate client. A single reservation may have multiple folios:
  * *Folio 01 (Room & Tax - Master / Corporate Billing)*
  * *Folio 02 (Incidentals - Guest Personal Card)*
  * *Folio 03 (Disputed Charges / Allowances)*
* **FolioTransaction**: Immutable ledger posting line item. Records posting datetime, transaction code (e.g., 1001-RoomCharge, 2001-InRoomDining, 3001-SpaTreatment), net amount, tax breakdown, and cashier user ID.
* **PaymentRecord**: Processed payment transaction. Stores payment method (CreditCardToken, Cash, CityLedger, BankTransfer), gateway authorization reference, settled status, and currency conversion rate.
* **Invoice**: Final closed tax invoice generated upon departure or corporate settlement, compliant with local fiscal laws.

---

### 2.6 Guest Profile & CRM
* **GuestProfile**: Golden record of a human guest. Stores unique identifier, legal name, contact details, language preference, VIP tier, and consent preferences.
* **GuestPreference**: Granular preference item classified by domain (e.g., *Food & Beverage: Lactose intolerant, prefers sparkling water*; *Housekeeping: Feather-free hypoallergenic pillows, 22°C room temp*; *Room: High floor, away from elevator*).
* **StayHistorySummary**: Denormalized aggregate of lifetime spend, total stays, cancellation frequency, and Net Promoter Score (NPS) ratings across all chain properties.

---

### 2.7 Food & Beverage (F&B) & Spa Outlets
* **DiningOutlet**: Restaurant, bar, pool club, or lounge venue within a property.
* **DiningTable**: Physical seating unit with capacity, shape, and section location.
* **TableReservation**: Scheduled guest dining reservation linked to GuestProfile or Reservation.
* **SpaAppointment**: Scheduled wellness therapy booking binding a treatment room, therapist, guest, and service duration.

---

### 2.8 Guest Service Requests & Concierge
* **ServiceRequest**: Omnichannel guest request (e.g., extra towels, ice bucket, wake-up call, luggage pickup).
  * Invariant: Must transition from Open -> Assigned -> In-Progress -> Resolved -> Closed.
  * Enforces an SLA timer with automatic escalation if unacknowledged within threshold.

---

## 3. Comprehensive Entity Dictionary

| Domain | Entity Name | Type | Key Identifiers & Attributes | Primary Invariants & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Platform** | Property | Aggregate Root | id, group_id, code, 
ame, 	imezone, currency, 	ax_id | Property code must be unique across the group. |
| **PMS** | Reservation | Aggregate Root | id, property_id, confirmation_number, status, rrival_date, departure_date | Confirmation number is globally unique; departure >= arrival. |
| **PMS** | PhysicalRoom | Entity | id, property_id, 
oom_number, 
oom_type_id, loor_id, status | Room number unique per property. |
| **Operations**| RoomStatusRecord| Entity | 
oom_id, clean_status, occupancy_status, is_ooo, is_oos | Cannot set Occupied unless a valid checked-in reservation exists. |
| **Finance** | Folio | Aggregate Root | id, 
eservation_id, olio_number, status, currency, alance | Folio balance must equal sum of FolioTransactions minus Payments. |
| **Finance** | FolioTransaction| Value / Entity | id, olio_id, 	rans_code, mount, 	ax_amount, is_void | Transactions are append-only. Voids create reversing credit entries. |
| **Housekeeping**| HousekeepingTask| Entity | id, 
oom_id, ttendant_id, 	ask_type, priority, status | Task cannot be marked Completed without recording finish timestamp. |
| **Engineering**| MaintenanceWorkOrder| Aggregate Root | id, property_id, sset_id, 
oom_id, severity, status | Urgent severity generates instant notification to Chief Engineer. |
| **CRM** | GuestProfile | Aggregate Root | id, irst_name, last_name, email, phone, ip_code | Email/Phone normalized for duplicate profile matching. |
