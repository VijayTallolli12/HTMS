// AUTO-EXTRACTED canonical IAM baseline.
// Source of truth: packages/database/src/seed/seed-iam.ts (W1). Regenerate by
// re-running the W2 extraction script if the seed roster changes. The runtime
// IamBaselineService uses this data to ensure roles/permissions exist on a
// virgin database WITHOUT executing the demo seed.

export interface RoleDefinition {
  code: string;
  name: string;
  description?: string;
}

export interface PermissionDefinition {
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export const CANONICAL_SYSTEM_ROLES: RoleDefinition[] = [
  {
    "code": "PLATFORM_OWNER",
    "name": "Platform Owner",
    "description": "Product owner with system reset capability for new client onboarding"
  },
  {
    "code": "CORP_ADMIN",
    "name": "Corporate Platform Admin",
    "description": "Full system configuration, global user provisioning, global audit log access"
  },
  {
    "code": "PROPERTY_GM",
    "name": "General Manager",
    "description": "Full property operational control, VIP approvals, financial override approvals"
  },
  {
    "code": "FOM",
    "name": "Front Office Manager",
    "description": "Room allocation oversight, overbooking limits, upgrade approvals"
  },
  {
    "code": "FDA",
    "name": "Front Desk Agent",
    "description": "Guest check-in/out, room assignment, incidental authorizations"
  },
  {
    "code": "HK_SUPERVISOR",
    "name": "Housekeeping Supervisor",
    "description": "Room inspection approval, attendant assignment dispatch"
  },
  {
    "code": "ROOM_ATTENDANT",
    "name": "Room Attendant",
    "description": "Room cleaning state updates, minibar usage reporting"
  },
  {
    "code": "MAINT_TECH",
    "name": "Maintenance Technician",
    "description": "On-ground repair execution, work order completion"
  },
  {
    "code": "NIGHT_AUDITOR",
    "name": "Night Auditor",
    "description": "Daily rollover execution, room charge postings, ledger balancing"
  },
  {
    "code": "FNB_MANAGER",
    "name": "Restaurant / F&B Manager",
    "description": "Food & Beverage operations oversight, menu management, outlet operations"
  },
  {
    "code": "SPA_MANAGER",
    "name": "Spa Manager",
    "description": "Spa & Wellness operations oversight, treatment management, therapist scheduling"
  }
];

export const CANONICAL_PERMISSIONS: PermissionDefinition[] = [
  {
    "code": "platform:system_reset",
    "name": "System Reset",
    "description": "Reset the installation to NOT_INITIALIZED state for new client onboarding",
    "module": "PLATFORM"
  },
  {
    "code": "organization.group.manage",
    "name": "Manage Hotel Groups",
    "description": "Create, update, and delete hotel groups (corporate/platform level)",
    "module": "ORGANIZATION"
  },
  {
    "code": "organization.region.manage",
    "name": "Manage Regions",
    "description": "Create, update, and delete regions within hotel groups",
    "module": "ORGANIZATION"
  },
  {
    "code": "organization.country.manage",
    "name": "Manage Countries",
    "description": "Create, update, and delete countries within regions",
    "module": "ORGANIZATION"
  },
  {
    "code": "organization.property.manage",
    "name": "Manage Properties",
    "description": "Create, update, and delete properties within the authorized organization scope",
    "module": "ORGANIZATION"
  },
  {
    "code": "organization.building.manage",
    "name": "Manage Buildings",
    "description": "Create, update, and delete buildings within authorized properties",
    "module": "ORGANIZATION"
  },
  {
    "code": "organization.floor.manage",
    "name": "Manage Floors",
    "description": "Create, update, and delete floors within authorized buildings",
    "module": "ORGANIZATION"
  },
  {
    "code": "front_office.reservation.read",
    "name": "View Reservations",
    "description": "View reservations and guest arrival lists",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.reservation.create",
    "name": "Create Reservations",
    "description": "Create new individual or group reservations",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.reservation.cancel",
    "name": "Cancel Reservations",
    "description": "Cancel an existing reservation",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.room_assignment.manage",
    "name": "Manage Room Assignment",
    "description": "Assign or reassign rooms to reservations",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.room_assignment.upgrade",
    "name": "Upgrade Room Assignment",
    "description": "Upgrade a room assignment to a higher category",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.checkin.execute",
    "name": "Execute Check-In",
    "description": "Execute guest check-in and room key issuance",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "front_office.checkin.clean_override",
    "name": "Override Clean Check-In",
    "description": "Check in a guest to a room that has not passed inspection",
    "module": "FRONT_OFFICE"
  },
  {
    "code": "room-type:read",
    "name": "View Room Types",
    "description": "View room type definitions and rate configurations",
    "module": "ROOM_TYPES"
  },
  {
    "code": "room-type:create",
    "name": "Create Room Types",
    "description": "Create new room type definitions",
    "module": "ROOM_TYPES"
  },
  {
    "code": "room-type:update",
    "name": "Update Room Types",
    "description": "Update existing room type definitions",
    "module": "ROOM_TYPES"
  },
  {
    "code": "room-type:delete",
    "name": "Delete Room Types",
    "description": "Delete room type definitions",
    "module": "ROOM_TYPES"
  },
  {
    "code": "room_operations.status.read",
    "name": "View Room Status",
    "description": "View current room operational status and housekeeping state",
    "module": "ROOM_OPERATIONS"
  },
  {
    "code": "room_operations.status.update",
    "name": "Update Room Status",
    "description": "Update room operational status (e.g. out-of-order, inspection)",
    "module": "ROOM_OPERATIONS"
  },
  {
    "code": "room_operations.maintenance.create",
    "name": "Create Maintenance Request",
    "description": "Create a maintenance work order for a room",
    "module": "ROOM_OPERATIONS"
  },
  {
    "code": "room_operations.maintenance.cancel",
    "name": "Cancel Maintenance Request",
    "description": "Cancel an in-progress maintenance work order",
    "module": "ROOM_OPERATIONS"
  },
  {
    "code": "folio:view",
    "name": "View Folio",
    "description": "Inspect guest charges, tax breakdown, and open balances",
    "module": "FINANCE"
  },
  {
    "code": "folio:post_charge",
    "name": "Post Folio Charge",
    "description": "Post a charge entry to a guest folio",
    "module": "FINANCE"
  },
  {
    "code": "folio:post_payment",
    "name": "Post Folio Payment",
    "description": "Post a payment or credit entry to a guest folio",
    "module": "FINANCE"
  },
  {
    "code": "frontdesk:checkout",
    "name": "Execute Checkout",
    "description": "Execute guest checkout and close the folio",
    "module": "FINANCE"
  },
  {
    "code": "housekeeping.room.update",
    "name": "Update Room Cleaning State",
    "description": "Update physical room cleaning status (Dirty -> Cleaning -> Clean)",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.room.inspect",
    "name": "Inspect Room",
    "description": "Inspect and certify room readiness for guest arrival",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.view",
    "name": "View Housekeeping Tasks",
    "description": "View housekeeping task list and details",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.assign",
    "name": "Assign Housekeeping Tasks",
    "description": "Assign or reassign housekeeping tasks to attendants",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.claim",
    "name": "Claim Housekeeping Task",
    "description": "Self-claim an unassigned housekeeping task",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.start",
    "name": "Start Cleaning",
    "description": "Mark housekeeping task as in-progress (start cleaning)",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.complete",
    "name": "Complete Cleaning",
    "description": "Mark housekeeping task as cleaned",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "housekeeping.task.inspect",
    "name": "Inspect Housekeeping Task",
    "description": "Inspect a cleaned room and pass or reject",
    "module": "HOUSEKEEPING"
  },
  {
    "code": "maintenance.ticket.create",
    "name": "Create Maintenance Ticket",
    "description": "Report physical defects or equipment breakdowns",
    "module": "MAINTENANCE"
  },
  {
    "code": "inventory:read",
    "name": "Read Inventory & Availability",
    "description": "View daily inventory calendar and stay availability quotes",
    "module": "INVENTORY"
  },
  {
    "code": "revenue.dashboard.view",
    "name": "View Revenue Dashboard",
    "description": "View global revenue KPIs and summaries",
    "module": "REVENUE"
  },
  {
    "code": "revenue.rate.view",
    "name": "View Rates",
    "description": "Read daily rate information",
    "module": "REVENUE"
  },
  {
    "code": "revenue.rate.manage",
    "name": "Manage Rates",
    "description": "Create/Update daily rates with OCC",
    "module": "REVENUE"
  },
  {
    "code": "revenue.inventory.view",
    "name": "View Inventory",
    "description": "Read inventory/ATS data for revenue calculations",
    "module": "REVENUE"
  },
  {
    "code": "revenue.inventory.manage",
    "name": "Manage Inventory",
    "description": "Update inventory (not used in this sprint, read‑only)",
    "module": "REVENUE"
  },
  {
    "code": "revenue.kpi.view",
    "name": "View Revenue KPIs",
    "description": "View revenue KPIs (Occupancy, ADR, RevPAR, Pickup, etc.)",
    "module": "REVENUE"
  },
  {
    "code": "revenue.forecast.view",
    "name": "View Revenue Forecast",
    "description": "View deterministic occupancy and demand forecasts",
    "module": "REVENUE"
  },
  {
    "code": "revenue.pricing.view",
    "name": "View Pricing Recommendations",
    "description": "View rules-based pricing recommendations",
    "module": "REVENUE"
  },
  {
    "code": "revenue.market-rate.view",
    "name": "View Market Rates",
    "description": "View competitor market rates and compset data",
    "module": "REVENUE"
  },
  {
    "code": "revenue.market-rate.manage",
    "name": "Manage Market Rates",
    "description": "Manage market rate providers and competitor sets",
    "module": "REVENUE"
  },
  {
    "code": "platform.audit_log.read",
    "name": "View Audit Log",
    "description": "Inspect immutable system security and activity audit records",
    "module": "PLATFORM"
  },
  {
    "code": "user.manage.read",
    "name": "View Users & Property Scopes",
    "description": "List and view staff user accounts and their assigned property scopes",
    "module": "PLATFORM"
  },
  {
    "code": "user.manage.write",
    "name": "Manage Users & Property Scopes",
    "description": "Create, update, assign properties, and activate/deactivate staff user accounts",
    "module": "PLATFORM"
  },
  {
    "code": "engineering.asset.view",
    "name": "View Assets",
    "description": "View equipment, appliances, and facility asset records",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.asset.manage",
    "name": "Manage Assets",
    "description": "Create, update, or retire facility assets",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.view",
    "name": "View Work Orders",
    "description": "View maintenance work orders and repair status",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.create",
    "name": "Create Work Orders",
    "description": "Report maintenance defects and create repair work orders",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.assign",
    "name": "Assign Work Orders",
    "description": "Dispatch and assign work orders to technicians",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.status_update",
    "name": "Update Work Order Status",
    "description": "Start, complete, or update progress on work orders",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.close",
    "name": "Close Work Orders",
    "description": "Verify and formally close completed work orders",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.work_order.note",
    "name": "Add Work Order Notes",
    "description": "Add progress logs and technician notes to work orders",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.schedule.view",
    "name": "View Maintenance Schedules",
    "description": "View preventive maintenance schedules and due dates",
    "module": "ENGINEERING"
  },
  {
    "code": "engineering.schedule.manage",
    "name": "Manage Maintenance Schedules",
    "description": "Create and update recurring preventive maintenance schedules",
    "module": "ENGINEERING"
  },
  {
    "code": "night_audit:view",
    "name": "View Night Audit & Business Date",
    "description": "View current hotel business date, audit status, and historical logs",
    "module": "NIGHT_AUDIT"
  },
  {
    "code": "night_audit:run",
    "name": "Run Night Audit",
    "description": "Execute pre-audit validation and hotel business date rollover",
    "module": "NIGHT_AUDIT"
  },
  {
    "code": "night_audit:approve",
    "name": "Approve Night Audit Overrides",
    "description": "Acknowledge and override operational validation warnings during audit",
    "module": "NIGHT_AUDIT"
  },
  {
    "code": "night_audit:recover",
    "name": "Recover Night Audit",
    "description": "Reset or recover an aborted or locked night audit process",
    "module": "NIGHT_AUDIT"
  },
  {
    "code": "fnb.outlet.view",
    "name": "View F&B Outlets",
    "description": "View restaurant outlets and tables",
    "module": "FNB"
  },
  {
    "code": "fnb.menu.view",
    "name": "View F&B Menus",
    "description": "View menu categories and food & beverage items",
    "module": "FNB"
  },
  {
    "code": "fnb.menu.manage",
    "name": "Manage F&B Menus",
    "description": "Create and update menu categories, items and pricing",
    "module": "FNB"
  },
  {
    "code": "fnb.table.view",
    "name": "View F&B Tables",
    "description": "View restaurant floor tables and occupancy statuses",
    "module": "FNB"
  },
  {
    "code": "fnb.order.view",
    "name": "View F&B Orders",
    "description": "View active and past restaurant orders",
    "module": "FNB"
  },
  {
    "code": "fnb.order.create",
    "name": "Create F&B Orders",
    "description": "Open table orders and add ordered items",
    "module": "FNB"
  },
  {
    "code": "fnb.order.manage",
    "name": "Manage F&B Orders",
    "description": "Transition order statuses (submit, kitchen, serve, cancel)",
    "module": "FNB"
  },
  {
    "code": "fnb.order.close",
    "name": "Close F&B Orders & Settle",
    "description": "Settle order bill and post room charges to guest folio",
    "module": "FNB"
  },
  {
    "code": "fnb.catalog.view",
    "name": "View F&B Catalog",
    "description": "View menu items, variants, modifiers, and availability",
    "module": "FNB"
  },
  {
    "code": "fnb.catalog.manage",
    "name": "Manage F&B Catalog",
    "description": "Create and update menu items, variants, and modifier groups",
    "module": "FNB"
  },
  {
    "code": "fnb.pricing.view",
    "name": "View F&B Pricing",
    "description": "View menu item and variant pricing",
    "module": "FNB"
  },
  {
    "code": "fnb.pricing.manage",
    "name": "Manage F&B Pricing",
    "description": "Create and update menu item and variant prices",
    "module": "FNB"
  },
  {
    "code": "fnb.availability.manage",
    "name": "Manage F&B Availability",
    "description": "Update menu item and variant availability status",
    "module": "FNB"
  },
  {
    "code": "spa.service.view",
    "name": "View Spa Services",
    "description": "View spa treatments, services, and pricing",
    "module": "SPA"
  },
  {
    "code": "spa.service.manage",
    "name": "Manage Spa Services",
    "description": "Create and update spa treatment services",
    "module": "SPA"
  },
  {
    "code": "spa.catalog.view",
    "name": "View Spa Catalog",
    "description": "View spa service categories, services, and addons",
    "module": "SPA"
  },
  {
    "code": "spa.catalog.manage",
    "name": "Manage Spa Catalog",
    "description": "Create and update spa service categories and addons",
    "module": "SPA"
  },
  {
    "code": "spa.pricing.view",
    "name": "View Spa Pricing",
    "description": "View spa service pricing and price history",
    "module": "SPA"
  },
  {
    "code": "spa.pricing.manage",
    "name": "Manage Spa Pricing",
    "description": "Create and update spa service prices",
    "module": "SPA"
  },
  {
    "code": "spa.availability.manage",
    "name": "Manage Spa Availability",
    "description": "Update spa service availability status",
    "module": "SPA"
  },
  {
    "code": "spa.therapist.view",
    "name": "View Spa Therapists",
    "description": "View therapist profiles, schedules, and specialties",
    "module": "SPA"
  },
  {
    "code": "spa.room.view",
    "name": "View Spa Treatment Rooms",
    "description": "View spa treatment rooms and availability",
    "module": "SPA"
  },
  {
    "code": "spa.appointment.view",
    "name": "View Spa Appointments",
    "description": "View spa appointment bookings and schedule calendar",
    "module": "SPA"
  },
  {
    "code": "spa.appointment.create",
    "name": "Book Spa Appointments",
    "description": "Book treatment appointments for hotel guests and visitors",
    "module": "SPA"
  },
  {
    "code": "spa.appointment.manage",
    "name": "Manage Spa Appointments",
    "description": "Update appointment status and schedule details",
    "module": "SPA"
  },
  {
    "code": "spa.appointment.complete",
    "name": "Complete Spa Appointment & Settle",
    "description": "Mark appointment completed and post charges to guest folio",
    "module": "SPA"
  },
  {
    "code": "events.venue.view",
    "name": "View Event Venues",
    "description": "View banquet halls, ballrooms, and meeting spaces",
    "module": "EVENTS"
  },
  {
    "code": "events.venue.manage",
    "name": "Manage Event Venues",
    "description": "Create and update banquet venues and capacity configurations",
    "module": "EVENTS"
  },
  {
    "code": "events.package.view",
    "name": "View Event Packages",
    "description": "View catering packages, menus, and per-guest pricing",
    "module": "EVENTS"
  },
  {
    "code": "events.package.manage",
    "name": "Manage Event Packages",
    "description": "Create and update catering and banquet packages",
    "module": "EVENTS"
  },
  {
    "code": "events.booking.view",
    "name": "View Event Bookings",
    "description": "View banquet bookings, event details, and calendar",
    "module": "EVENTS"
  },
  {
    "code": "events.booking.create",
    "name": "Create Event Bookings",
    "description": "Create new banquet and event reservations",
    "module": "EVENTS"
  },
  {
    "code": "events.booking.manage",
    "name": "Manage Event Bookings",
    "description": "Update event schedules, guest counts, and resource allocations",
    "module": "EVENTS"
  },
  {
    "code": "events.booking.confirm",
    "name": "Confirm Event Bookings",
    "description": "Confirm tentative bookings with collision checks",
    "module": "EVENTS"
  },
  {
    "code": "events.booking.complete",
    "name": "Complete Event Bookings & Settle",
    "description": "Complete event execution and post charges to guest folio",
    "module": "EVENTS"
  },
  {
    "code": "crm.guest.view",
    "name": "View Guest CRM Profile",
    "description": "View guest CRM profile, VIP status, notes, and communication preferences",
    "module": "CRM"
  },
  {
    "code": "crm.guest.manage",
    "name": "Manage Guest CRM Profile",
    "description": "Create and update guest CRM profiles, VIP flags, and tags",
    "module": "CRM"
  },
  {
    "code": "crm.preference.view",
    "name": "View Guest Preferences",
    "description": "View guest preferences across categories",
    "module": "CRM"
  },
  {
    "code": "crm.preference.manage",
    "name": "Manage Guest Preferences",
    "description": "Create, update, and delete guest preferences",
    "module": "CRM"
  },
  {
    "code": "loyalty.membership.view",
    "name": "View Loyalty Membership",
    "description": "View loyalty membership, tier, and points balance",
    "module": "LOYALTY"
  },
  {
    "code": "loyalty.membership.manage",
    "name": "Manage Loyalty Membership",
    "description": "Create and update loyalty memberships and tiers",
    "module": "LOYALTY"
  },
  {
    "code": "loyalty.points.view",
    "name": "View Loyalty Points",
    "description": "View loyalty points balance and transaction history",
    "module": "LOYALTY"
  },
  {
    "code": "loyalty.points.adjust",
    "name": "Adjust Loyalty Points",
    "description": "Award, redeem, or manually adjust loyalty points",
    "module": "LOYALTY"
  },
  {
    "code": "procurement.supplier.view",
    "name": "View Suppliers",
    "description": "View suppliers and vendor profiles",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.supplier.manage",
    "name": "Manage Suppliers",
    "description": "Create and update supplier profiles",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.item.view",
    "name": "View Inventory Items",
    "description": "View procurement catalog items and stock definitions",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.item.manage",
    "name": "Manage Inventory Items",
    "description": "Create and update inventory items and reorder thresholds",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.po.view",
    "name": "View Purchase Orders",
    "description": "View purchase order details and status",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.po.create",
    "name": "Create Purchase Orders",
    "description": "Create purchase orders with line items",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.po.approve",
    "name": "Approve Purchase Orders",
    "description": "Approve purchase orders for vendor fulfillment",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.receipt.view",
    "name": "View Goods Receipts",
    "description": "View goods receipt records and received item quantities",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.receipt.create",
    "name": "Receive Goods",
    "description": "Process goods receipts against approved purchase orders",
    "module": "PROCUREMENT"
  },
  {
    "code": "procurement.stock.view",
    "name": "View Stock Balances",
    "description": "View current on-hand, reserved, and available stock levels",
    "module": "PROCUREMENT"
  },
  {
    "code": "hr.employee.view",
    "name": "View Employees",
    "description": "View employee directory and profiles",
    "module": "HR"
  },
  {
    "code": "hr.employee.manage",
    "name": "Manage Employees",
    "description": "Create and update employee records",
    "module": "HR"
  },
  {
    "code": "hr.compensation.view",
    "name": "View Employee Compensation",
    "description": "View employee salary and allowance details",
    "module": "HR"
  },
  {
    "code": "hr.compensation.manage",
    "name": "Manage Employee Compensation",
    "description": "Create and update employee compensation records",
    "module": "HR"
  },
  {
    "code": "payroll.period.view",
    "name": "View Payroll Periods",
    "description": "View payroll period definitions and status",
    "module": "PAYROLL"
  },
  {
    "code": "payroll.period.manage",
    "name": "Manage Payroll Periods",
    "description": "Create and update payroll periods",
    "module": "PAYROLL"
  },
  {
    "code": "payroll.run.view",
    "name": "View Payroll Runs",
    "description": "View payroll run details, calculations, and payslips",
    "module": "PAYROLL"
  },
  {
    "code": "payroll.run.process",
    "name": "Process Payroll Runs",
    "description": "Calculate and process payroll runs",
    "module": "PAYROLL"
  },
  {
    "code": "payroll.run.finalize",
    "name": "Finalize Payroll Runs",
    "description": "Finalize calculated payroll runs",
    "module": "PAYROLL"
  },
  {
    "code": "payroll.payslip.view",
    "name": "View Payslips",
    "description": "View individual employee payslips",
    "module": "PAYROLL"
  },
  {
    "code": "channel:read",
    "name": "View Channel Manager",
    "description": "View demo channel state, mappings, and sync logs",
    "module": "CHANNEL_MANAGER"
  },
  {
    "code": "channel:create",
    "name": "Configure Demo Channel",
    "description": "Create explicitly labelled demo channel configurations",
    "module": "CHANNEL_MANAGER"
  },
  {
    "code": "channel:update",
    "name": "Update Demo Channel",
    "description": "Update demo property, room, and rate mappings",
    "module": "CHANNEL_MANAGER"
  },
  {
    "code": "channel:delete",
    "name": "Delete Demo Channel",
    "description": "Disable and remove demo channel configurations",
    "module": "CHANNEL_MANAGER"
  },
  {
    "code": "channel:sync",
    "name": "Run Demo Channel Sync",
    "description": "Ingest demo reservations and run or retry simulated syncs",
    "module": "CHANNEL_MANAGER"
  },
  {
    "code": "channel:reconcile",
    "name": "Reconcile Demo Channel",
    "description": "Reconcile demo channel reservation records",
    "module": "CHANNEL_MANAGER"
  },
  { "code": "payment_gateway:view", "name": "View Payment Gateways", "description": "View property gateway catalog and configuration", "module": "PAYMENT_GATEWAY" },
  { "code": "payment_gateway:configure", "name": "Configure Payment Gateways", "description": "Configure property gateway credentials and methods", "module": "PAYMENT_GATEWAY" },
  { "code": "payment_gateway:test", "name": "Test Payment Gateway", "description": "Test the registered property gateway adapter", "module": "PAYMENT_GATEWAY" },
  { "code": "payment_gateway:enable", "name": "Enable Payment Gateway", "description": "Enable a verified adapter for a property", "module": "PAYMENT_GATEWAY" },
  { "code": "payment_gateway:disable", "name": "Disable Payment Gateway", "description": "Disable a property gateway", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:intent:create", "name": "Create Payment Intent", "description": "Create a property payment intent", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:authorize", "name": "Authorize Payment", "description": "Authorize an enabled gateway payment", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:capture", "name": "Capture Payment", "description": "Capture an authorized gateway payment", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:cancel", "name": "Cancel Payment Intent", "description": "Cancel an open gateway payment intent", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:reconcile", "name": "Reconcile Gateway Payments", "description": "Generate property reconciliation reports", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:read", "name": "View Gateway Payments", "description": "Read property gateway configuration and payments", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:create", "name": "Create Gateway Configuration", "description": "Create property gateway configurations", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:update", "name": "Update Gateway Configuration", "description": "Update property gateway configurations", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:delete", "name": "Delete Gateway Configuration", "description": "Delete property gateway configurations", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:refund", "name": "Refund Gateway Payment", "description": "Refund property gateway payments", "module": "PAYMENT_GATEWAY" },
  { "code": "payment:webhook", "name": "Receive Gateway Webhook", "description": "Receive cryptographically verified provider callbacks", "module": "PAYMENT_GATEWAY" }
];

export const CANONICAL_ROLE_PERMISSIONS: Array<{ roleCode: string; permCodes: string[] }> = [
  {
    "roleCode": "PLATFORM_OWNER",
    "permCodes": [
      "platform:system_reset",
      "platform.audit_log.read",
      "organization.group.manage",
      "organization.region.manage",
      "organization.country.manage",
      "organization.property.manage",
      "organization.building.manage",
      "organization.floor.manage",
      "channel:read",
      "payment_gateway:view"
    ]
  },
  {
    "roleCode": "CORP_ADMIN",
    "permCodes": [
      "organization.group.manage",
      "organization.region.manage",
      "organization.country.manage",
      "organization.property.manage",
      "organization.building.manage",
      "organization.floor.manage",
      "front_office.reservation.read",
      "front_office.reservation.create",
      "front_office.reservation.cancel",
      "front_office.room_assignment.manage",
      "front_office.room_assignment.upgrade",
      "front_office.checkin.execute",
      "front_office.checkin.clean_override",
      "room-type:read",
      "room-type:create",
      "room-type:update",
      "room-type:delete",
      "room_operations.status.read",
      "room_operations.status.update",
      "room_operations.maintenance.create",
      "room_operations.maintenance.cancel",
      "folio:view",
      "folio:post_charge",
      "folio:post_payment",
      "frontdesk:checkout",
      "housekeeping.room.update",
      "housekeeping.room.inspect",
      "housekeeping.task.view",
      "housekeeping.task.assign",
      "housekeeping.task.claim",
      "housekeeping.task.start",
      "housekeeping.task.complete",
      "housekeeping.task.inspect",
      "maintenance.ticket.create",
      "inventory:read",
      "revenue.dashboard.view",
      "revenue.rate.view",
      "revenue.rate.manage",
      "revenue.inventory.view",
      "revenue.inventory.manage",
      "revenue.kpi.view",
      "revenue.forecast.view",
      "revenue.pricing.view",
      "revenue.market-rate.view",
      "revenue.market-rate.manage",
      "platform.audit_log.read",
      "engineering.asset.view",
      "engineering.asset.manage",
      "engineering.work_order.view",
      "engineering.work_order.create",
      "engineering.work_order.assign",
      "engineering.work_order.status_update",
      "engineering.work_order.close",
      "engineering.work_order.note",
      "engineering.schedule.view",
      "engineering.schedule.manage",
      "night_audit:view",
      "night_audit:run",
      "night_audit:approve",
      "night_audit:recover",
      "fnb.outlet.view",
      "fnb.menu.view",
      "fnb.menu.manage",
      "fnb.table.view",
      "fnb.order.view",
      "fnb.order.create",
      "fnb.order.manage",
      "fnb.order.close",
      "fnb.catalog.view",
      "fnb.catalog.manage",
      "fnb.pricing.view",
      "fnb.pricing.manage",
      "fnb.availability.manage",
      "spa.service.view",
      "spa.service.manage",
      "spa.catalog.view",
      "spa.catalog.manage",
      "spa.pricing.view",
      "spa.pricing.manage",
      "spa.availability.manage",
      "spa.therapist.view",
      "spa.room.view",
      "spa.appointment.view",
      "spa.appointment.create",
      "spa.appointment.manage",
      "spa.appointment.complete",
      "events.venue.view",
      "events.venue.manage",
      "events.package.view",
      "events.package.manage",
      "events.booking.view",
      "events.booking.create",
      "events.booking.manage",
      "events.booking.confirm",
      "events.booking.complete",
      "crm.guest.view",
      "crm.guest.manage",
      "crm.preference.view",
      "crm.preference.manage",
      "loyalty.membership.view",
      "loyalty.membership.manage",
      "loyalty.points.view",
      "loyalty.points.adjust",
      "procurement.supplier.view",
      "procurement.supplier.manage",
      "procurement.item.view",
      "procurement.item.manage",
      "procurement.po.view",
      "procurement.po.create",
      "procurement.po.approve",
      "procurement.receipt.view",
      "procurement.receipt.create",
      "procurement.stock.view",
      "hr.employee.view",
      "hr.employee.manage",
      "hr.compensation.view",
      "hr.compensation.manage",
      "payroll.period.view",
      "payroll.period.manage",
      "payroll.run.view",
      "payroll.run.process",
      "payroll.run.finalize",
      "payroll.payslip.view",
      "channel:read",
      "channel:create",
      "channel:update",
      "channel:delete",
      "channel:sync",
      "channel:reconcile",
      "payment_gateway:view",
      "payment_gateway:configure",
      "payment_gateway:test",
      "payment_gateway:enable",
      "payment_gateway:disable",
      "payment:intent:create",
      "payment:authorize",
      "payment:capture",
      "payment:cancel",
      "payment:reconcile",
      "payment:read",
      "payment:create",
      "payment:update",
      "payment:delete",
      "payment:refund",
      "payment:webhook",
      "user.manage.read",
      "user.manage.write"
    ]
  },
  {
    "roleCode": "PROPERTY_GM",
    "permCodes": [
      "front_office.reservation.read",
      "front_office.reservation.create",
      "front_office.reservation.cancel",
      "front_office.room_assignment.manage",
      "front_office.checkin.execute",
      "room-type:read",
      "room_operations.status.read",
      "room_operations.status.update",
      "housekeeping.room.update",
      "housekeeping.room.inspect",
      "maintenance.ticket.create",
      "inventory:read",
      "folio:view",
      "folio:post_charge",
      "folio:post_payment",
      "frontdesk:checkout",
      "engineering.asset.view",
      "engineering.asset.manage",
      "engineering.work_order.view",
      "engineering.work_order.create",
      "engineering.work_order.assign",
      "engineering.work_order.status_update",
      "engineering.work_order.close",
      "engineering.work_order.note",
      "engineering.schedule.view",
      "engineering.schedule.manage",
      "night_audit:view",
      "night_audit:run",
      "night_audit:approve",
      "night_audit:recover",
      "fnb.outlet.view",
      "fnb.menu.view",
      "fnb.menu.manage",
      "fnb.table.view",
      "fnb.order.view",
      "fnb.order.create",
      "fnb.order.manage",
      "fnb.order.close",
      "fnb.catalog.view",
      "fnb.catalog.manage",
      "fnb.pricing.view",
      "fnb.pricing.manage",
      "fnb.availability.manage",
      "spa.service.view",
      "spa.service.manage",
      "spa.catalog.view",
      "spa.catalog.manage",
      "spa.pricing.view",
      "spa.pricing.manage",
      "spa.availability.manage",
      "spa.therapist.view",
      "spa.room.view",
      "spa.appointment.view",
      "spa.appointment.create",
      "spa.appointment.manage",
      "spa.appointment.complete",
      "revenue.dashboard.view",
      "revenue.kpi.view",
      "revenue.rate.view",
      "revenue.rate.manage",
      "revenue.inventory.view",      "revenue.inventory.manage",
      "revenue.forecast.view",
      "revenue.pricing.view",
      "revenue.market-rate.view",
      "revenue.market-rate.manage",
      "crm.guest.view",
      "crm.guest.manage",
      "crm.preference.view",
      "crm.preference.manage",
      "loyalty.membership.view",
      "loyalty.membership.manage",
      "loyalty.points.view",
      "loyalty.points.adjust",
      "procurement.supplier.view",
      "procurement.supplier.manage",
      "procurement.item.view",
      "procurement.item.manage",
      "procurement.po.view",
      "procurement.po.create",
      "procurement.po.approve",
      "procurement.receipt.view",
      "procurement.receipt.create",
      "procurement.stock.view",
      "hr.employee.view",
      "hr.employee.manage",
      "hr.compensation.view",
      "hr.compensation.manage",
      "payroll.period.view",
      "payroll.period.manage",
      "payroll.run.view",
      "payroll.run.process",
      "payroll.run.finalize",
      "payroll.payslip.view",
      "organization.building.manage",
      "organization.floor.manage",
      "channel:read",
      "channel:create",
      "channel:update",
      "channel:delete",
      "channel:sync",
      "channel:reconcile",
      "payment_gateway:view",
      "payment_gateway:configure",
      "payment_gateway:test",
      "payment_gateway:enable",
      "payment_gateway:disable",
      "payment:intent:create",
      "payment:authorize",
      "payment:capture",
      "payment:cancel",
      "payment:reconcile",
      "payment:read",
      "payment:create",
      "payment:update",
      "payment:delete",
      "payment:refund",
      "payment:webhook",
      "user.manage.read",
      "user.manage.write"
    ]
  },
  {
    "roleCode": "NIGHT_AUDITOR",
    "permCodes": [
      "night_audit:view",
      "night_audit:run",
      "night_audit:approve",
      "night_audit:recover",
      "front_office.reservation.read",
      "room_operations.status.read",
      "inventory:read",
      "folio:view",
      "folio:post_charge",
      "folio:post_payment",
      "frontdesk:checkout"
    ]
  },
  {
    "roleCode": "FDA",
    "permCodes": [
      "front_office.reservation.read",
      "front_office.reservation.create",
      "front_office.reservation.cancel",
      "front_office.room_assignment.manage",
      "front_office.checkin.execute",
      "front_office.checkin.clean_override",
      "room-type:read",
      "room_operations.status.read",
      "room_operations.status.update",
      "inventory:read",
      "folio:view",
      "folio:post_charge",
      "folio:post_payment",
      "frontdesk:checkout",
      "engineering.work_order.view",
      "engineering.work_order.create",
      "engineering.work_order.note",
      "fnb.outlet.view",
      "fnb.menu.view",
      "fnb.table.view",
      "fnb.order.view",
      "fnb.order.create",
      "fnb.order.manage",
      "fnb.order.close",
      "spa.service.view",
      "spa.catalog.view",
      "spa.therapist.view",
      "spa.room.view",
      "spa.appointment.view",
      "spa.appointment.create",
      "spa.appointment.manage",
      "spa.appointment.complete",
      "revenue.dashboard.view",
      "revenue.kpi.view",
      "revenue.rate.view",
      "revenue.inventory.view",
      "events.venue.view",
      "events.package.view",
      "events.booking.view",
      "events.booking.create",
      "events.booking.manage",
      "events.booking.confirm",
      "events.booking.complete",
      "crm.guest.view",
      "crm.guest.manage",
      "crm.preference.view",
      "crm.preference.manage",
      "loyalty.membership.view",
      "loyalty.membership.manage",
      "loyalty.points.view",
      "loyalty.points.adjust"
    ]
  },
  {
    "roleCode": "HK_SUPERVISOR",
    "permCodes": [
      "housekeeping.room.update",
      "housekeeping.room.inspect",
      "housekeeping.task.view",
      "housekeeping.task.assign",
      "housekeeping.task.inspect",
      "engineering.work_order.view",
      "engineering.work_order.create",
      "engineering.work_order.note"
    ]
  },
  {
    "roleCode": "MAINT_TECH",
    "permCodes": [
      "engineering.asset.view",
      "engineering.work_order.view",
      "engineering.work_order.status_update",
      "engineering.work_order.note",
      "engineering.schedule.view",
      "maintenance.ticket.create"
    ]
  },
  {
    "roleCode": "ROOM_ATTENDANT",
    "permCodes": [
      "housekeeping.room.update",
      "housekeeping.task.view",
      "housekeeping.task.claim",
      "housekeeping.task.start",
      "housekeeping.task.complete"
    ]
  },
  {
    "roleCode": "FNB_MANAGER",
    "permCodes": [
      "fnb.outlet.view",
      "fnb.menu.view",
      "fnb.menu.manage",
      "fnb.table.view",
      "fnb.order.view",
      "fnb.order.create",
      "fnb.order.manage",
      "fnb.order.close",
      "fnb.catalog.view",
      "fnb.catalog.manage",
      "fnb.pricing.view",
      "fnb.pricing.manage",
      "fnb.availability.manage",
      "crm.guest.view",
      "crm.guest.manage",
      "crm.preference.view",
      "crm.preference.manage",
      "loyalty.membership.view",
      "loyalty.membership.manage",
      "loyalty.points.view",
      "loyalty.points.adjust"
    ]
  },
  {
    "roleCode": "SPA_MANAGER",
    "permCodes": [
      "spa.service.view",
      "spa.service.manage",
      "spa.catalog.view",
      "spa.catalog.manage",
      "spa.pricing.view",
      "spa.pricing.manage",
      "spa.availability.manage",
      "spa.therapist.view",
      "spa.room.view",
      "spa.appointment.view",
      "spa.appointment.create",
      "spa.appointment.manage",
      "spa.appointment.complete",
      "crm.guest.view",
      "crm.guest.manage",
      "crm.preference.view",
      "crm.preference.manage",
      "loyalty.membership.view",
      "loyalty.membership.manage",
      "loyalty.points.view",
      "loyalty.points.adjust"
    ]
  }
];
