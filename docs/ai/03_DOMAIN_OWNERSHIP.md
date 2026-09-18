# 03 — Domain Ownership & Task Boundaries

Concise, non-negotiable boundaries between domains, services, and tasks. Existing documents under `docs/` remain the source of truth.

---

## 1. Domain Ownership Matrix

| Domain / Task | Schema | Owned Aggregates / Tables | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **Organization (W1-T02)** | `platform_schema` | `hotel_groups`, `regions`, `countries`, `properties`, `buildings`, `floors` | Structural organizational hierarchy and multi-property management. Source: `docs/03-ORGANIZATION-MODEL.md`. |
| **Identity & Access (W1-T03)** | `platform_schema` | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `user_credentials` | Authentication, token issuance, password security, scoped authorization. Source: `docs/04-USER-ROLES-PERMISSIONS.md`. |
| **PMS / Inventory (W1-T04)** | `pms_schema` | `room_types`, `rooms` (physical definitions), `rate_plans`, `rate_plan_room_types`, `daily_rates`, `daily_inventory` | Room type configuration, physical room inventory baseline, rate management, Available-to-Sell (ATS) evaluation. Source: `docs/02-DOMAIN-MODEL.md`. |
| **Reservations (W1-T05)** | `pms_schema` | `reservations`, `guests`, `reservation_rate_nights` | Central reservation aggregate, stay pricing snapshots, multi-day booking consumption/release of `booked_count`, reservation idempotency. Source: `docs/02-DOMAIN-MODEL.md`. |
| **Room Operations (W1-T06)** | `pms_schema` | `room_maintenance_blocks`, `room_status_logs`, `rooms` (`housekeepingStatus`, `serviceStatus`, `occupancyStatus`) | Housekeeping state machine, maintenance blocks (OOO/OOS), PostgreSQL GiST exclusion invariant, Effective Operational State resolution, lazy read reconciliation, audit trail. Source: `docs/02-DOMAIN-MODEL.md`. |
| **Front Office (W1-T07 — FUTURE)** | `pms_schema` / `frontoffice_schema` | *Future check-in / assignment tables* | Room assignment algorithms, arrival processing, guest check-in, keycard handoff, registration card issuance. Source: `docs/06-BUSINESS-WORKFLOWS.md`. |
| **Finance / Folios (W1-T08 — FUTURE)** | `finance_schema` | *Future folios, charges, payments* | Guest folios, charges, payment gateways, tax calculation, checkout balance settlement. Source: `docs/06-BUSINESS-WORKFLOWS.md`. |

---

## 2. Non-Negotiable Invariant Prohibitions (NEVER)

1. **NEVER mutate reservations from Room Operations**:
   - `RoomStatusService` and `RoomMaintenanceService` (T06) must NEVER alter `reservations` or manipulate `daily_inventory.bookedCount`.
2. **NEVER implement room assignment or check-in in T06**:
   - T06 provides `effective.isCheckInReady` and `effective.isSellable` flags. It does NOT assign rooms to reservations or execute check-in.
3. **NEVER mutate physical operational state from Reservations**:
   - `ReservationService` (T05) consumes `booked_count` in `daily_inventory`. It must NEVER directly mutate a physical room's `housekeepingStatus` or `serviceStatus`.
4. **NEVER cross schema boundaries via SQL joins**:
   - Relationships between domains (e.g. `Reservation` -> `Guest`, `Reservation` -> `RoomType`) are linked via property-scoped composite identifiers, not cross-schema Prisma relations.
5. **NEVER bypass ownership boundaries for convenience**:
   - Changes to an aggregate's state must be invoked through that aggregate's authoritative domain service.
