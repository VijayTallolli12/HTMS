# User Roles, Permissions & Access Control Architecture

## 1. Access Control Paradigm: Scoped RBAC + ABAC
Enterprise HMS implements a hybrid **Role-Based Access Control (RBAC)** augmented with **Attribute-Based Scoping (ABAC)**. 
A permission string grants an operational capability (e.g., `folio:rebate`), but the user's hierarchical scope (Tenant, Region, Property, Department) strictly constrains the records they can act upon.

```
+-------------------------------------------------------------------------------+
|                             User Identity Token                               |
|  User ID: usr_8921 | Base Property: prop_tokyo | Role: FRONT_DESK_AGENT       |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                             Authorization Policy Engine                       |
|  1. Permission Check: Does Role contain 'reservation:check_in'? (YES)        |
|  2. Scope Check: Is Context Header 'prop_tokyo' allowed for User? (YES)       |
|  3. Attribute Check: Is Cashier Drawer currently open for User? (YES)         |
+-------------------------------------------------------------------------------+
                                        |
                                        v Access Granted
```

---

## 2. Standard Role Hierarchy & Capabilities

| Role Code | Role Title | Hierarchy Level | Primary Operational Responsibilities |
| :--- | :--- | :--- | :--- |
| `CORP_ADMIN` | Corporate Platform Admin | Group / Brand | Full system configuration, brand setup, global user provisioning, global audit log access. |
| `CORP_REV_DIR`| Corporate Revenue Director | Group / Brand | Global rate plan authoring, channel distribution rules, yield algorithm overrides. |
| `REGIONAL_VP`| Regional Vice President | Region | Cross-property performance auditing, regional yield monitoring, cluster management. |
| `PROPERTY_GM`| General Manager | Property | Full property operational control, VIP approvals, financial override approvals, disaster overrides. |
| `FIN_CONTROLLER`| Financial Controller | Property | Daily night audit sign-off, high-value rebate approvals, tax setup, city ledger AR management. |
| `FOM` | Front Office Manager | Property | Room allocation oversight, overbooking limits, upgrade approvals, VIP welcome coordination. |
| `FDA` | Front Desk Agent | Property / Front Desk | Guest check-in/out, room assignment, keycard encoding, incidental payment authorizations. |
| `NIGHT_AUDITOR`| Night Auditor | Property / Finance | Daily rollover execution, room charge postings, daily ledger balancing, discrepancy clearing. |
| `EXEC_HOUSEKEEPER`| Executive Housekeeper | Property / Housekeeping| Housekeeping section planning, turn credits, inspection audits, linen par-level oversight. |
| `HK_SUPERVISOR`| Housekeeping Supervisor | Property / Housekeeping| Room inspection approval (`Clean` -> `Inspected`), attendant assignment dispatch, lost & found. |
| `ROOM_ATTENDANT`| Room Attendant | Property / Housekeeping| Room cleaning state updates (`Dirty` -> `Cleaning` -> `Clean`), minibar usage reporting. |
| `CHIEF_ENGINEER`| Chief Engineer | Property / Engineering | Asset preventive schedules, vendor contracts, critical work order dispatch. |
| `MAINT_TECH` | Maintenance Technician | Property / Engineering | On-ground repair execution, work order completion, spare parts consumption logging. |
| `FB_SERVER` | Food & Beverage Server | Property / Outlets | Table orders, room charge verification, instant folio posting. |
| `CONCIERGE` | Concierge & Transport | Property / Services | Chauffeur booking, luggage tag tracking, guest service request dispatch. |
| `GUEST` | Hotel Guest | Personal | Personal reservation viewing, digital check-in, mobile key access, in-room service ordering. |

---

## 3. Granular Permission Catalog

### 3.1 Reservations & PMS Inventory
* `reservation:view` - View reservations and guest arrival lists.
* `reservation:create` - Create new individual or group reservations.
* `reservation:modify` - Modify stay dates, room types, or guest details.
* `reservation:cancel` - Cancel a reservation and calculate cancellation fees.
* `reservation:override_rate` - Override pre-configured rate plan pricing (Requires supervisor override).
* `reservation:assign_room` - Manually or automatically assign a room number to a booking.

### 3.2 Front Office & Guest Movements
* `frontdesk:checkin` - Execute guest check-in, verify ID, and generate registration cards.
* `frontdesk:checkout` - Process departure, finalize billing, and release room lock.
* `frontdesk:issue_key` - Transmit keycard encoding commands to door lock gateway.
* `frontdesk:walk_in` - Create an immediate arrival reservation for walk-in guests.

### 3.3 Rooms Operations & Housekeeping
* `room_status:view` - Access real-time room status board.
* `room_status:update_clean` - Mark a room as `Clean` or `Pickup`.
* `room_status:inspect` - Inspect and certify a room as `Inspected` (Ready for VIP Check-in).
* `room_status:set_ooo` - Place a room Out of Order (removes physical room from available inventory).
* `housekeeping:assign_tasks` - Auto-generate and distribute daily cleaning task sheets.

### 3.4 Engineering & Facilities
* `maintenance:create_ticket` - Report physical defects or equipment breakdowns.
* `maintenance:assign_worker` - Dispatch work order to internal technician or external contractor.
* `maintenance:resolve` - Mark repair completed and return room/asset to operational readiness.

### 3.5 Finance, Cashiering & Billing
* `folio:view` - Inspect guest charges, tax breakdown, and open balances.
* `folio:post_charge` - Post manual room charges, restaurant tickets, or phone charges.
* `folio:post_payment` - Process cash, credit card authorization, or corporate billing.
* `folio:rebate` - Issue credit adjustment or discount on posted charges (Tiered threshold).
* `folio:split` - Separate folio charges across multiple billing windows or sub-folios.
* `night_audit:execute` - Trigger end-of-day rollover and post automated room & tax charges.

---

## 4. Separation of Duties & Dual Approval Governance

To prevent fraud and maintain strict fiscal control:
1. **Financial Rebate Tiering**:
   * Up to $50: Front Desk Agent allowed with mandatory reason code.
   * $51 to $500: Front Office Manager or Duty Manager approval required.
   * Above $500: Financial Controller or General Manager dual-signature approval required.
2. **Night Audit Lockdown**:
   * During the automated night audit run, all active front desk cashiering transactions are temporarily paused in the active property.
3. **Out-of-Order Authorization**:
   * Setting a room to `Out of Order` for more than 48 hours requires Chief Engineer and General Manager concurrence.
