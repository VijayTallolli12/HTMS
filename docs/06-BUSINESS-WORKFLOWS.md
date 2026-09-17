# Core Business Workflows: Enterprise HMS

## 1. Introduction & Methodology
This document defines the 10 critical operational workflows powering Enterprise HMS. Each workflow specifies:
* **Trigger** and **Primary Actor**
* **Preconditions**
* **State Changes & Invariants**
* **Business Rules**
* **Events Generated & Notifications**
* **Downstream Consumers**
* **Failure & Exception Paths**

---

## 2. The 10 Critical Business Workflows

### Workflow 1: Reservation Creation & Confirmation
* **Trigger**: Guest completes direct web booking, OTA transmits channel reservation, or agent takes telephone booking.
* **Actor**: Guest / Central Reservations Agent / OTA Channel Adapter.
* **Preconditions**: 
  1. Room inventory available for requested `RoomType` across all stay nights.
  2. Rate Plan active and restrictions satisfied (e.g., Min Stay, Closed to Arrival).
  3. Valid guarantee payment token or deposit provided.
* **State Changes**: Reservation state created with status `CONFIRMED`. Inventory calendar decrements Available to Sell (`ATS = ATS - 1`).
* **Business Rules**: Overbooking allowed only if property-level overbooking limit has not been breached and authorized by Revenue Manager.
* **Events Generated**: `ReservationCreated`, `InventoryDecremented`.
* **Notifications**: Guest receives confirmation email/SMS with booking code; Central Reservations dashboard increments daily booking volume.
* **Downstream Consumers**: CRM (Guest profile link), Inventory Engine, Revenue Management.
* **Failure Paths**: Card authorization failure -> Booking held in `PENDING_PAYMENT` for 15 minutes, then released to inventory.

---

### Workflow 2: Room Assignment (Manual or Intelligent Automated)
* **Trigger**: Front Desk clerk clicks "Assign Room" or Batch Automated Pre-Allocation runs at 06:00 AM daily.
* **Actor**: Front Desk Supervisor or Background Assignment Engine.
* **Preconditions**: Reservation status is `CONFIRMED`; Target physical room matches reservation `RoomType` (or approved complimentary upgrade).
* **State Changes**: `Reservation.assigned_room_id` set; `PhysicalRoom.is_assigned` flagged.
* **Business Rules**:
  1. Never assign a room currently in `Out of Order (OOO)` status during stay dates.
  2. Prioritize matching guest preferences (high floor, feather-free, quiet room).
  3. VIP tier guests prioritized for best-in-class rooms within category.
* **Events Generated**: `RoomAssigned`.
* **Notifications**: Staff roster dashboard updates; Front Desk queue shows room assigned.
* **Downstream Consumers**: Housekeeping (Priority cleaning queue), Guest Services (Amenity delivery).
* **Failure Paths**: No matching clean room -> Room assigned in `DIRTY` state with automated housekeeping priority rush tag.

---

### Workflow 3: Guest Check-In & Key Encoding
* **Trigger**: Guest arrives at front desk or completes digital mobile check-in.
* **Actor**: Front Desk Agent or Guest (via Mobile App).
* **Preconditions**: 
  1. Assigned room must be in `INSPECTED` (or `CLEAN` with supervisor override) status.
  2. Valid identity document scanned/verified.
  3. Credit card pre-authorization secured for Room + Tax + Estimated Incidentals.
* **State Changes**:
  * Reservation status transitions from `CONFIRMED` to `CHECKED_IN`.
  * Room operational state transitions from `Vacant Inspected` to `Occupied Clean`.
  * Primary guest folio opened with active status.
* **Business Rules**: Room cannot be occupied without an authorized payment guarantee.
* **Events Generated**: `GuestCheckedIn`, `KeycardIssued`, `RoomOccupancyChanged`.
* **Notifications**: Welcome message dispatched to guest mobile device; Butler / VIP team notified of guest in-house.
* **Downstream Consumers**: PBX (Enable phone outbound dialing), In-Room Entertainment (Display guest welcome screen), Door Lock Controller (Activate RFID key).
* **Failure Paths**: Pre-auth declined -> Check-in halted; alternate payment method requested. Room still dirty -> Guest invited to welcome lounge; automated urgent priority alert dispatched to Executive Housekeeper.

---

### Workflow 4: Physical Room Status Lifecycle
* **Trigger**: Physical state transitions triggered by guest actions, cleaning completion, supervisor signoff, or maintenance reports.
* **Actor**: System / Room Attendant / Floor Supervisor / Engineer.
* **State Transitions**:
  ```
  [Vacant Dirty] -> (Attendant Starts) -> [Cleaning In-Progress]
  [Cleaning In-Progress] -> (Attendant Completes) -> [Vacant Clean]
  [Vacant Clean] -> (Supervisor Approves) -> [Vacant Inspected]
  [Vacant Inspected] -> (Guest Check-In) -> [Occupied Clean]
  [Occupied Clean] -> (Daily Stayover / Next Morning) -> [Occupied Dirty]
  [Occupied / Vacant] -> (Defect Logged) -> [Out of Order / Out of Service]
  ```
* **Business Rules**:
  1. Front Desk can only check guests into `INSPECTED` rooms (or `CLEAN` rooms if property configuration permits non-VIP auto-checkin).
  2. Marking a room `Out of Order (OOO)` removes it from PMS sellable inventory; `Out of Service (OOS)` keeps it in inventory.
* **Events Generated**: `RoomDirty`, `RoomCleaningStarted`, `RoomCleaned`, `RoomInspected`, `RoomPlacedOOO`, `RoomReturnedToService`.
* **Notifications**: Housekeeping supervisor dashboard updates; Front Desk room rack updates in real-time via WebSockets.
* **Downstream Consumers**: Front Office, Housekeeping, Revenue Management.
* **Failure Paths**: Inspection failed -> Room status reverts to `DIRTY` with supervisor deficiency checklist sent to attendant.

---

### Workflow 5: Housekeeping Task Allocation & Execution
* **Trigger**: Morning Housekeeping Run (07:00 AM) or ad-hoc checkout departure.
* **Actor**: Housekeeping Dispatch Engine / Room Attendant.
* **Preconditions**: Attendants clocked in and assigned to physical sections/floors.
* **State Changes**: `HousekeepingTask` created with state `ASSIGNED` -> `IN_PROGRESS` -> `COMPLETED`.
* **Business Rules**:
  1. Room credit points balanced across working attendants (e.g., Max 16 credits per 8-hour shift; Stayover = 1 credit, Checkout = 2.5 credits, Suite = 4 credits).
  2. VIP arrival rooms prioritized at the top of the queue.
* **Events Generated**: `HousekeepingTaskAssigned`, `HousekeepingTaskCompleted`.
* **Notifications**: Attendant receives real-time task on mobile handheld; supervisor notified upon completion.
* **Downstream Consumers**: Rooms Operations, Front Office.
* **Failure Paths**: Attendant encounters DND (Do Not Disturb) sign -> Attendant logs DND with timestamp; task placed in `HELD` state; Front Desk notified.

---

### Workflow 6: Engineering Request & Reactive Maintenance
* **Trigger**: Guest reports broken AC, or Housekeeping spots leaking faucet during room clean.
* **Actor**: Guest / Attendant / Front Desk / Engineer.
* **Preconditions**: Target room or asset exists in property register.
* **State Changes**: `MaintenanceWorkOrder` created (`OPEN` -> `DISPATCHED` -> `IN_PROGRESS` -> `RESOLVED`).
* **Business Rules**: Urgent severity (e.g., water leak, no power) requires technician response within 15 minutes.
* **Events Generated**: `MaintenanceRequested`, `MaintenanceAssigned`, `MaintenanceCompleted`.
* **Notifications**: Push notification to duty engineer; high priority SMS alert to Chief Engineer.
* **Downstream Consumers**: Rooms Operations (If room placed OOO), Front Office (Guest service follow-up).
* **Failure Paths**: Parts unavailable -> Work order placed on `PARTS_HOLD`; Chief Engineer re-routes inventory; room placed on temporary Out of Service.

---

### Workflow 7: Guest Service Request & Omnichannel SLA Escalation
* **Trigger**: Guest requests extra bath towels via Mobile App or WhatsApp Concierge.
* **Actor**: Guest / Omnichannel AI Assistant / Concierge Agent.
* **Preconditions**: Guest has active checked-in reservation.
* **State Changes**: `ServiceRequest` created with state `OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `CLOSED`.
* **Business Rules**:
  1. SLA timer starts immediately upon creation (Standard SLA: 10 minutes for luxury amenities).
  2. If unassigned within 3 minutes, escalates to Assistant Manager on Duty.
* **Events Generated**: `ServiceRequestCreated`, `ServiceRequestEscalated`, `ServiceRequestCompleted`.
* **Notifications**: Runner receives vibrating notification on mobile; guest receives delivery confirmation estimate.
* **Downstream Consumers**: CRM (Guest preference tracking), Workforce Management.
* **Failure Paths**: SLA breached -> Automated alert sent to General Manager dashboard; service recovery fruit platter automatically queued.

---

### Workflow 8: Folio Billing & Charge Posting
* **Trigger**: Guest dines at signature restaurant and signs check to room.
* **Actor**: F&B Server / POS Integration Gateway / Night Audit Automated Engine.
* **Preconditions**:
  1. Target room is occupied.
  2. Guest name matches registered reservation occupant.
  3. Folio credit limit has not been exceeded.
* **State Changes**: `FolioTransaction` appended to guest folio; `Folio.balance` incremented.
* **Business Rules**:
  1. Postings are immutable. Adjustments require explicit offsetting credit transactions with audit reason codes.
  2. System verifies exact guest surname before allowing room charges from POS.
* **Events Generated**: `ChargePostedToFolio`.
* **Notifications**: Guest app folio reflects charge within 2 seconds.
* **Downstream Consumers**: Finance Ledger, Night Audit Balancing.
* **Failure Paths**: Guest name mismatch or credit limit exceeded -> POS displays "Charge Rejected"; server requests physical payment card.

---

### Workflow 9: Payment Processing & Authorizations
* **Trigger**: Check-in pre-auth, incremental authorization top-up, or final checkout settlement.
* **Actor**: Payment Gateway / Cashier / Automated Balance Watchdog.
* **Preconditions**: PCI-compliant payment card token available or cash tendered.
* **State Changes**: `PaymentRecord` created; active authorization balance adjusted.
* **Business Rules**:
  1. Credit card numbers never enter or touch Enterprise HMS servers (Strict PCI-DSS SAQ A via iframe tokenization).
  2. Nightly automated batch checks if guest incidental spend exceeds 80% of authorized hold; automatically tops up hold.
* **Events Generated**: `PaymentAuthorized`, `PaymentSettled`, `PaymentDeclined`.
* **Notifications**: Cashier receives approval code; guest receives SMS transaction receipt.
* **Downstream Consumers**: Finance, Front Desk Queue.
* **Failure Paths**: Authorization declined -> Front Desk alert flagged to request secondary payment method before further charges permitted.

---

### Workflow 10: Checkout & Settlement
* **Trigger**: Guest clicks "Check Out" on mobile app or visits front desk.
* **Actor**: Guest / Front Desk Agent.
* **Preconditions**:
  1. Reservation status is `CHECKED_IN`.
  2. All open folios have balance equal to ZERO ($0.00) (Charges offset by settled payments or approved direct corporate billing).
  3. In-room minibar and key return confirmed.
* **State Changes**:
  * Reservation status transitions to `CHECKED_OUT`.
  * Physical room status automatically transitions to `VACANT DIRTY`.
  * Folio status closed.
* **Business Rules**: Checkout is prohibited if there is an unresolved positive balance without guaranteed corporate ledger transfer.
* **Events Generated**: `GuestCheckedOut`, `FolioClosed`, `RoomDirty`.
* **Notifications**: Housekeeping task automatically dispatched to room attendant queue; Bell desk alerted for luggage assist; PDF invoice emailed to guest.
* **Downstream Consumers**: Housekeeping (Cleaning queue), Door Lock Gateway (Revoke key access), CRM (Log stay completed), Loyalty (Calculate points).
* **Failure Paths**: Disputed restaurant charge on bill -> Front Desk Manager issues approved rebate with reason code, bringing balance to zero, and completes checkout.
