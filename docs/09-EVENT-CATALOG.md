# Domain Event Catalog & Messaging Architecture: Enterprise HMS

## 1. Architectural Distinction: Commands vs. Domain Events

To prevent architectural ambiguity across engineering teams and AI agents, Enterprise HMS strictly separates **Commands** from **Events**:

```
+-------------------------------------------------------------------------------+
|                                    COMMAND                                    |
|  - Definition: An explicit REQUEST to perform an operation.                   |
|  - Semantics: Can be rejected, validated, or unauthorized.                    |
|  - Naming: Imperative verb phrase (e.g., CheckInGuestCommand, PostChargeCmd). |
|  - Handling: Addressed to a single designated Application Service handler.     |
+-------------------------------------------------------------------------------+
                                        |
                                        v (Executes within ACID Transaction)
+-------------------------------------------------------------------------------+
|                                     EVENT                                     |
|  - Definition: An immutable FACT that an operation has already occurred.      |
|  - Semantics: Cannot be rejected or altered; reflects historical reality.     |
|  - Naming: Past-tense verb phrase (e.g., GuestCheckedInEvent, ChargePostedEvt)|
|  - Handling: Broadcast via RabbitMQ to zero, one, or multiple subscribers.   |
+-------------------------------------------------------------------------------+
```

### Command & Event Lifecycle Example:
```
[Client Request]
       |
       v
CheckInGuestCommand (Contains: reservationId, roomId, paymentToken)
       |
       v [FrontDeskApplicationService]
(Validates room is INSPECTED, authorizes payment, commits DB transaction)
       |
       v [Transactional Outbox Insert]
GuestCheckedInEvent (Payload: reservationId, roomId, guestId, timestamp)
       |
       v [RabbitMQ Topic Exchange: hms.events.topic]
       +-----------------------+-----------------------+
       |                       |                       |
       v                       v                       v
[Rooms Ops Consumer]     [PBX Telecom Consumer]   [Housekeeping Consumer]
(Trips to Occupied)      (Sets Phone Name)        (Updates Section Board)
```

---

## 2. Standardized Naming Conventions

### 2.1 Commands (Imperative Verb Phrases)
* `CreateReservation`
* `ConfirmReservation`
* `ModifyReservation`
* `CancelReservation`
* `AssignRoom`
* `CheckInGuest`
* `CheckOutGuest`
* `PostChargeToFolio`
* `ProcessPayment`
* `StartHousekeepingTask`
* `CompleteHousekeepingTask`
* `InspectRoom`
* `CreateMaintenanceTicket`
* `ResolveMaintenanceTicket`

### 2.2 Domain Events (Past-Tense Factual Phrases)
* `ReservationCreated`
* `ReservationConfirmed`
* `ReservationModified`
* `ReservationCancelled`
* `RoomAssigned`
* `GuestCheckedIn`
* `GuestCheckedOut`
* `ChargePostedToFolio`
* `PaymentAuthorized`
* `PaymentSettled`
* `RoomDirty`
* `RoomCleaningStarted`
* `RoomCleaned`
* `RoomInspectionRequired`
* `RoomReady`
* `MaintenanceRequested`
* `MaintenanceCompleted`
* `ServiceRequestCreated`
* `ServiceRequestCompleted`

---

## 3. End-to-End Event Reliability Model

Enterprise HMS guarantees **At-Least-Once Delivery** and **Strict Consumer Idempotency** via the following pipeline:

```
[Domain Transaction Commits]
       |
       +---> Writes Aggregate State Changes
       +---> Writes Outbox Record (audit_schema.outbox_events)
       |
       v (Atomic Commit)
[Outbox Publisher Worker]
       | (Polls / Tails Outbox)
       v
[RabbitMQ Topic Exchange: hms.events.topic]
       |
       v (Persistent AMQP Queue)
[Consumer Queue: e.g., housekeeping.room_turns.queue]
       |
       v
[Consumer Worker: Idempotency Filter]
       |
       +---> Has event.id already been processed?
       |        |
       |        +--[YES]--> Acknowledge (ack) & Discard (Zero Duplicate Execution)
       |        +--[NO]---> Execute Consumer Business Logic
       |                        |
       |                        +--[SUCCESS]--> Record event.id -> Acknowledge (ack)
       |                        +--[FAILURE]--> Reject (nack) -> Retry Policy
       v
[Retry Policy with Exponential Backoff]
       |-- Attempt 1: Immediate Retry
       |-- Attempt 2: Delay 5 seconds
       |-- Attempt 3: Delay 30 seconds
       |
       v (If all 3 attempts fail)
[Dead Letter Exchange: hms.dlx.topic -> hms.dead_letter.queue]
       |
       v (Administrative Alerting & Manual Replay Tooling)
```

---

## 4. CloudEvents Envelope Specification & Tracing Metadata

Every published event conforms strictly to CloudEvents v1.0 and carries end-to-end tracing metadata:

```json
{
  "specversion": "1.0",
  "id": "evt_018f6c3a-921b-7a11-89dc-5491b281f9a1",
  "source": "https://pms.enterprise-hms.com/properties/prop_tokyo",
  "type": "com.enterprise_hms.frontoffice.guest_checked_in.v1",
  "datacontenttype": "application/json",
  "time": "2026-09-16T12:00:00.123Z",
  "tenantid": "ten_891238",
  "propertyid": "prop_tokyo",
  "correlationid": "corr_982347a-d09f-4312-9c12",
  "causationid": "cmd_812309a-11aa-4589-b102",
  "data": {
    "reservationId": "018f6c3a-921b-7a11-89dc-5491b281f9a1",
    "roomId": "018f6c3a-1111-7a11-89dc-5491b281f9a1",
    "roomNumber": "402",
    "guestId": "018f6c3a-2222-7a11-89dc-5491b281f9a1",
    "folioId": "018f6c3a-3333-7a11-89dc-5491b281f9a1",
    "checkedInBy": "018f6c3a-4444-7a11-89dc-5491b281f9a1"
  }
}
```

### Traceability Definitions:
* **`id`**: Unique UUIDv7 identifier for the specific event instance. Used by consumers for idempotency deduplication.
* **`correlationid`**: Global trace identifier generated at the initial client HTTP request and propagated across all asynchronous services, message queues, and logs.
* **`causationid`**: The identifier of the specific Command or Parent Event that directly caused this event to be published. Enables complete DAG causal graph reconstruction.
* **`type`**: Versioned reverse-DNS event type (`com.enterprise_hms.{domain}.{entity}.{version}`).
* **`source`**: The authoritative URI of the property or service instance emitting the event.

---

## 5. Comprehensive Domain Event Catalog

| Event Name | Routing Key | Producer Domain | Primary Payload Summary | Primary Consumers | Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ReservationCreated` | `hms.pms.reservation.created` | PMS | `reservationId`, `propertyId`, `guestId`, `dates`, `roomType` | CRM, Inventory, Revenue | Async |
| `ReservationConfirmed`| `hms.pms.reservation.confirmed`| PMS | `reservationId`, `confirmationCode`, `paymentStatus` | Messaging, Guest App | Async |
| `ReservationModified` | `hms.pms.reservation.modified` | PMS | `reservationId`, `previousDates`, `newDates`, `previousRoomType` | Inventory, Revenue, CRM | Async |
| `ReservationCancelled`| `hms.pms.reservation.cancelled`| PMS | `reservationId`, `cancellationReason`, `feeCharged` | Inventory, Revenue, Finance | Async |
| `RoomAssigned` | `hms.frontoffice.room.assigned`| Front Office | `reservationId`, `roomId`, `roomNumber`, `floorId` | Housekeeping, Concierge | Async |
| `GuestCheckedIn` | `hms.frontoffice.guest.checked_in`| Front Office | `reservationId`, `roomId`, `guestId`, `folioId` | PBX, In-Room IoT, Rooms Ops | Async |
| `GuestCheckedOut` | `hms.frontoffice.guest.checked_out`| Front Office| `reservationId`, `roomId`, `departureTime`, `settledAmount` | Rooms Ops, Housekeeping, Loyalty | Async |
| `RoomDirty` | `hms.operations.room.dirty` | Rooms Ops | `roomId`, `propertyId`, `reason` (*Checkout / Stayover*) | Housekeeping Dispatch | Async |
| `RoomCleaningStarted` | `hms.housekeeping.task.started` | Housekeeping | `roomId`, `attendantId`, `taskId`, `startTime` | Rooms Ops, Front Desk | Async |
| `RoomCleaned` | `hms.housekeeping.task.cleaned` | Housekeeping | `roomId`, `attendantId`, `taskId`, `finishTime` | Rooms Ops, HK Supervisor | Async |
| `RoomInspectionRequired`| `hms.housekeeping.task.inspection_req`| Housekeeping| `roomId`, `propertyId`, `supervisorQueueId` | HK Supervisor Handheld | Async |
| `RoomReady` | `hms.operations.room.ready` | Rooms Ops | `roomId`, `propertyId`, `status` (*INSPECTED*) | Front Desk Arrival Queue | Async |
| `RoomPlacedOOO` | `hms.operations.room.placed_ooo`| Rooms Ops | `roomId`, `reason`, `startDate`, `endDate` | PMS Inventory (Removes ATS) | Sync / Atomic |
| `RoomReturnedToService`| `hms.operations.room.restored` | Rooms Ops | `roomId`, `propertyId` | PMS Inventory (Restores ATS) | Sync / Atomic |
| `MaintenanceRequested`| `hms.engineering.ticket.created`| Engineering | `workOrderId`, `roomId`, `assetId`, `severity` | Chief Engineer, Duty Tech | Async |
| `MaintenanceCompleted`| `hms.engineering.ticket.resolved`| Engineering | `workOrderId`, `roomId`, `technicianId`, `resolutionNotes` | Rooms Ops (Clears OOS/OOO) | Async |
| `ChargePostedToFolio` | `hms.finance.folio.charge_posted`| Finance | `folioId`, `transactionId`, `transCode`, `amount` | Guest App, Night Audit Ledger | Async |
| `PaymentAuthorized` | `hms.finance.payment.authorized`| Finance | `paymentId`, `folioId`, `amount`, `authCode` | Front Desk, Guest App | Async |
| `PaymentSettled` | `hms.finance.payment.settled` | Finance | `paymentId`, `folioId`, `amount`, `settledAt` | Finance AR, Invoicing | Async |
| `ServiceRequestCreated`| `hms.services.request.created` | Guest Services| `requestId`, `roomId`, `guestId`, `category`, `slaDeadline` | Service Runner Mobile App | Async |
| `ServiceRequestCompleted`| `hms.services.request.completed`| Guest Services| `requestId`, `runnerId`, `completionTime` | CRM Preference Engine | Async |
