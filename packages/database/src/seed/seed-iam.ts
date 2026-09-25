import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export async function seedIamBaseline() {
  const prisma = getPrismaClient();

  console.log('Seeding minimal canonical IAM baseline (System Roles & Permissions)...');

  // 1. System Roles (hotelGroupId is null, isSystem is true)
  const systemRoles = [
    {
      code: 'CORP_ADMIN',
      name: 'Corporate Platform Admin',
      description: 'Full system configuration, global user provisioning, global audit log access',
    },
    {
      code: 'PROPERTY_GM',
      name: 'General Manager',
      description: 'Full property operational control, VIP approvals, financial override approvals',
    },
    {
      code: 'FOM',
      name: 'Front Office Manager',
      description: 'Room allocation oversight, overbooking limits, upgrade approvals',
    },
    {
      code: 'FDA',
      name: 'Front Desk Agent',
      description: 'Guest check-in/out, room assignment, incidental authorizations',
    },
    {
      code: 'HK_SUPERVISOR',
      name: 'Housekeeping Supervisor',
      description: 'Room inspection approval, attendant assignment dispatch',
    },
    {
      code: 'ROOM_ATTENDANT',
      name: 'Room Attendant',
      description: 'Room cleaning state updates, minibar usage reporting',
    },
    {
      code: 'MAINT_TECH',
      name: 'Maintenance Technician',
      description: 'On-ground repair execution, work order completion',
    },
    {
      code: 'NIGHT_AUDITOR',
      name: 'Night Auditor',
      description: 'Daily rollover execution, room charge postings, ledger balancing',
    },
  ];

  const roleMap = new Map<string, string>();

  for (const roleDef of systemRoles) {
    let role = await prisma.role.findFirst({
      where: {
        code: roleDef.code,
        hotelGroupId: null,
      },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          id: generateUuidV7(),
          hotelGroupId: null,
          code: roleDef.code,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });
      console.log(`Created System Role: ${role.name} (${role.code})`);
    }
    roleMap.set(roleDef.code, role.id);
  }

  // 2. Canonical Granular Permissions
  const permissions = [
    // ── Front Office ──────────────────────────────────────────────────
    {
      code: 'front_office.reservation.read',
      name: 'View Reservations',
      description: 'View reservations and guest arrival lists',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.reservation.create',
      name: 'Create Reservations',
      description: 'Create new individual or group reservations',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.reservation.cancel',
      name: 'Cancel Reservations',
      description: 'Cancel an existing reservation',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.room_assignment.manage',
      name: 'Manage Room Assignment',
      description: 'Assign or reassign rooms to reservations',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.room_assignment.upgrade',
      name: 'Upgrade Room Assignment',
      description: 'Upgrade a room assignment to a higher category',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.checkin.execute',
      name: 'Execute Check-In',
      description: 'Execute guest check-in and room key issuance',
      module: 'FRONT_OFFICE',
    },
    {
      code: 'front_office.checkin.clean_override',
      name: 'Override Clean Check-In',
      description: 'Check in a guest to a room that has not passed inspection',
      module: 'FRONT_OFFICE',
    },
    // ── Room Types ────────────────────────────────────────────────────
    {
      code: 'room-type:read',
      name: 'View Room Types',
      description: 'View room type definitions and rate configurations',
      module: 'ROOM_TYPES',
    },
    {
      code: 'room-type:create',
      name: 'Create Room Types',
      description: 'Create new room type definitions',
      module: 'ROOM_TYPES',
    },
    {
      code: 'room-type:update',
      name: 'Update Room Types',
      description: 'Update existing room type definitions',
      module: 'ROOM_TYPES',
    },
    {
      code: 'room-type:delete',
      name: 'Delete Room Types',
      description: 'Delete room type definitions',
      module: 'ROOM_TYPES',
    },
    // ── Room Operations ───────────────────────────────────────────────
    {
      code: 'room_operations.status.read',
      name: 'View Room Status',
      description: 'View current room operational status and housekeeping state',
      module: 'ROOM_OPERATIONS',
    },
    {
      code: 'room_operations.status.update',
      name: 'Update Room Status',
      description: 'Update room operational status (e.g. out-of-order, inspection)',
      module: 'ROOM_OPERATIONS',
    },
    {
      code: 'room_operations.maintenance.create',
      name: 'Create Maintenance Request',
      description: 'Create a maintenance work order for a room',
      module: 'ROOM_OPERATIONS',
    },
    {
      code: 'room_operations.maintenance.cancel',
      name: 'Cancel Maintenance Request',
      description: 'Cancel an in-progress maintenance work order',
      module: 'ROOM_OPERATIONS',
    },
    // ── Finance / Folio ───────────────────────────────────────────────
    {
      code: 'folio:view',
      name: 'View Folio',
      description: 'Inspect guest charges, tax breakdown, and open balances',
      module: 'FINANCE',
    },
    {
      code: 'folio:post_charge',
      name: 'Post Folio Charge',
      description: 'Post a charge entry to a guest folio',
      module: 'FINANCE',
    },
    {
      code: 'folio:post_payment',
      name: 'Post Folio Payment',
      description: 'Post a payment or credit entry to a guest folio',
      module: 'FINANCE',
    },
    {
      code: 'frontdesk:checkout',
      name: 'Execute Checkout',
      description: 'Execute guest checkout and close the folio',
      module: 'FINANCE',
    },
    // ── Housekeeping ──────────────────────────────────────────────────
    {
      code: 'housekeeping.room.update',
      name: 'Update Room Cleaning State',
      description: 'Update physical room cleaning status (Dirty -> Cleaning -> Clean)',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.room.inspect',
      name: 'Inspect Room',
      description: 'Inspect and certify room readiness for guest arrival',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.view',
      name: 'View Housekeeping Tasks',
      description: 'View housekeeping task list and details',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.assign',
      name: 'Assign Housekeeping Tasks',
      description: 'Assign or reassign housekeeping tasks to attendants',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.claim',
      name: 'Claim Housekeeping Task',
      description: 'Self-claim an unassigned housekeeping task',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.start',
      name: 'Start Cleaning',
      description: 'Mark housekeeping task as in-progress (start cleaning)',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.complete',
      name: 'Complete Cleaning',
      description: 'Mark housekeeping task as cleaned',
      module: 'HOUSEKEEPING',
    },
    {
      code: 'housekeeping.task.inspect',
      name: 'Inspect Housekeeping Task',
      description: 'Inspect a cleaned room and pass or reject',
      module: 'HOUSEKEEPING',
    },
    // ── Maintenance ───────────────────────────────────────────────────
    {
      code: 'maintenance.ticket.create',
      name: 'Create Maintenance Ticket',
      description: 'Report physical defects or equipment breakdowns',
      module: 'MAINTENANCE',
    },
    // ── Inventory ────────────────────────────────────────────────────
    {
      code: 'inventory:read',
      name: 'Read Inventory & Availability',
      description: 'View daily inventory calendar and stay availability quotes',
      module: 'INVENTORY',
    },
    // ── Platform ──────────────────────────────────────────────────────
    {
      code: 'platform.audit_log.read',
      name: 'View Audit Log',
      description: 'Inspect immutable system security and activity audit records',
      module: 'PLATFORM',
    },
    // ── Engineering / Maintenance ─────────────────────────────────────
    {
      code: 'engineering.asset.view',
      name: 'View Assets',
      description: 'View equipment, appliances, and facility asset records',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.asset.manage',
      name: 'Manage Assets',
      description: 'Create, update, or retire facility assets',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.view',
      name: 'View Work Orders',
      description: 'View maintenance work orders and repair status',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.create',
      name: 'Create Work Orders',
      description: 'Report maintenance defects and create repair work orders',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.assign',
      name: 'Assign Work Orders',
      description: 'Dispatch and assign work orders to technicians',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.status_update',
      name: 'Update Work Order Status',
      description: 'Start, complete, or update progress on work orders',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.close',
      name: 'Close Work Orders',
      description: 'Verify and formally close completed work orders',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.work_order.note',
      name: 'Add Work Order Notes',
      description: 'Add progress logs and technician notes to work orders',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.schedule.view',
      name: 'View Maintenance Schedules',
      description: 'View preventive maintenance schedules and due dates',
      module: 'ENGINEERING',
    },
    {
      code: 'engineering.schedule.manage',
      name: 'Manage Maintenance Schedules',
      description: 'Create and update recurring preventive maintenance schedules',
      module: 'ENGINEERING',
    },
    // ── Night Audit ──────────────────────────────────────────────────
    {
      code: 'night_audit:view',
      name: 'View Night Audit & Business Date',
      description: 'View current hotel business date, audit status, and historical logs',
      module: 'NIGHT_AUDIT',
    },
    {
      code: 'night_audit:run',
      name: 'Run Night Audit',
      description: 'Execute pre-audit validation and hotel business date rollover',
      module: 'NIGHT_AUDIT',
    },
    {
      code: 'night_audit:approve',
      name: 'Approve Night Audit Overrides',
      description: 'Acknowledge and override operational validation warnings during audit',
      module: 'NIGHT_AUDIT',
    },
    {
      code: 'night_audit:recover',
      name: 'Recover Night Audit',
      description: 'Reset or recover an aborted or locked night audit process',
      module: 'NIGHT_AUDIT',
    },
    // ── Food & Beverage (F&B / Restaurant) ───────────────────────────
    {
      code: 'fnb.outlet.view',
      name: 'View F&B Outlets',
      description: 'View restaurant outlets and tables',
      module: 'FNB',
    },
    {
      code: 'fnb.menu.view',
      name: 'View F&B Menus',
      description: 'View menu categories and food & beverage items',
      module: 'FNB',
    },
    {
      code: 'fnb.menu.manage',
      name: 'Manage F&B Menus',
      description: 'Create and update menu categories, items and pricing',
      module: 'FNB',
    },
    {
      code: 'fnb.table.view',
      name: 'View F&B Tables',
      description: 'View restaurant floor tables and occupancy statuses',
      module: 'FNB',
    },
    {
      code: 'fnb.order.view',
      name: 'View F&B Orders',
      description: 'View active and past restaurant orders',
      module: 'FNB',
    },
    {
      code: 'fnb.order.create',
      name: 'Create F&B Orders',
      description: 'Open table orders and add ordered items',
      module: 'FNB',
    },
    {
      code: 'fnb.order.manage',
      name: 'Manage F&B Orders',
      description: 'Transition order statuses (submit, kitchen, serve, cancel)',
      module: 'FNB',
    },
    {
      code: 'fnb.order.close',
      name: 'Close F&B Orders & Settle',
      description: 'Settle order bill and post room charges to guest folio',
      module: 'FNB',
    },
    // ── Spa Operations ───────────────────────────────────────────────
    {
      code: 'spa.service.view',
      name: 'View Spa Services',
      description: 'View spa treatments, services, and pricing',
      module: 'SPA',
    },
    {
      code: 'spa.service.manage',
      name: 'Manage Spa Services',
      description: 'Create and update spa treatment services',
      module: 'SPA',
    },
    {
      code: 'spa.therapist.view',
      name: 'View Spa Therapists',
      description: 'View therapist profiles, schedules, and specialties',
      module: 'SPA',
    },
    {
      code: 'spa.room.view',
      name: 'View Spa Treatment Rooms',
      description: 'View spa treatment rooms and availability',
      module: 'SPA',
    },
    {
      code: 'spa.appointment.view',
      name: 'View Spa Appointments',
      description: 'View spa appointment bookings and schedule calendar',
      module: 'SPA',
    },
    {
      code: 'spa.appointment.create',
      name: 'Book Spa Appointments',
      description: 'Book treatment appointments for hotel guests and visitors',
      module: 'SPA',
    },
    {
      code: 'spa.appointment.manage',
      name: 'Manage Spa Appointments',
      description: 'Update appointment status and schedule details',
      module: 'SPA',
    },
    {
      code: 'spa.appointment.complete',
      name: 'Complete Spa Appointment & Settle',
      description: 'Mark appointment completed and post charges to guest folio',
      module: 'SPA',
    },
    // ── Events & Banquets ─────────────────────────────────────────────
    {
      code: 'events.venue.view',
      name: 'View Event Venues',
      description: 'View banquet halls, ballrooms, and meeting spaces',
      module: 'EVENTS',
    },
    {
      code: 'events.venue.manage',
      name: 'Manage Event Venues',
      description: 'Create and update banquet venues and capacity configurations',
      module: 'EVENTS',
    },
    {
      code: 'events.package.view',
      name: 'View Event Packages',
      description: 'View catering packages, menus, and per-guest pricing',
      module: 'EVENTS',
    },
    {
      code: 'events.package.manage',
      name: 'Manage Event Packages',
      description: 'Create and update catering and banquet packages',
      module: 'EVENTS',
    },
    {
      code: 'events.booking.view',
      name: 'View Event Bookings',
      description: 'View banquet bookings, event details, and calendar',
      module: 'EVENTS',
    },
    {
      code: 'events.booking.create',
      name: 'Create Event Bookings',
      description: 'Create new banquet and event reservations',
      module: 'EVENTS',
    },
    {
      code: 'events.booking.manage',
      name: 'Manage Event Bookings',
      description: 'Update event schedules, guest counts, and resource allocations',
      module: 'EVENTS',
    },
    {
      code: 'events.booking.confirm',
      name: 'Confirm Event Bookings',
      description: 'Confirm tentative bookings with collision checks',
      module: 'EVENTS',
    },
    {
      code: 'events.booking.complete',
      name: 'Complete Event Bookings & Settle',
      description: 'Complete event execution and post charges to guest folio',
      module: 'EVENTS',
    },
    // ── CRM & Loyalty ─────────────────────────────────────────────────
    {
      code: 'crm.guest.view',
      name: 'View Guest CRM Profile',
      description: 'View guest CRM profile, VIP status, notes, and communication preferences',
      module: 'CRM',
    },
    {
      code: 'crm.guest.manage',
      name: 'Manage Guest CRM Profile',
      description: 'Create and update guest CRM profiles, VIP flags, and tags',
      module: 'CRM',
    },
    {
      code: 'crm.preference.view',
      name: 'View Guest Preferences',
      description: 'View guest preferences across categories',
      module: 'CRM',
    },
    {
      code: 'crm.preference.manage',
      name: 'Manage Guest Preferences',
      description: 'Create, update, and delete guest preferences',
      module: 'CRM',
    },
    {
      code: 'loyalty.membership.view',
      name: 'View Loyalty Membership',
      description: 'View loyalty membership, tier, and points balance',
      module: 'LOYALTY',
    },
    {
      code: 'loyalty.membership.manage',
      name: 'Manage Loyalty Membership',
      description: 'Create and update loyalty memberships and tiers',
      module: 'LOYALTY',
    },
    {
      code: 'loyalty.points.view',
      name: 'View Loyalty Points',
      description: 'View loyalty points balance and transaction history',
      module: 'LOYALTY',
    },
    {
      code: 'loyalty.points.adjust',
      name: 'Adjust Loyalty Points',
      description: 'Award, redeem, or manually adjust loyalty points',
      module: 'LOYALTY',
    },
  ];

  const permMap = new Map<string, string>();

  for (const permDef of permissions) {
    let perm = await prisma.permission.findUnique({
      where: { code: permDef.code },
    });

    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          id: generateUuidV7(),
          code: permDef.code,
          name: permDef.name,
          description: permDef.description,
          module: permDef.module,
        },
      });
      console.log(`Created Permission: ${perm.name} (${perm.code})`);
    }
    permMap.set(permDef.code, perm.id);
  }

  // 3. Map System Roles to Permissions
  const rolePermissionAssignments: Array<{ roleCode: string; permCodes: string[] }> = [
    {
      roleCode: 'CORP_ADMIN',
      permCodes: permissions.map((p) => p.code),
    },
    {
      roleCode: 'PROPERTY_GM',
      permCodes: [
        'front_office.reservation.read',
        'front_office.reservation.create',
        'front_office.reservation.cancel',
        'front_office.room_assignment.manage',
        'front_office.checkin.execute',
        'room-type:read',
        'room_operations.status.read',
        'room_operations.status.update',
        'housekeeping.room.update',
        'housekeeping.room.inspect',
        'maintenance.ticket.create',
        'inventory:read',
        'folio:view',
        'folio:post_charge',
        'folio:post_payment',
        'frontdesk:checkout',
        'engineering.asset.view',
        'engineering.asset.manage',
        'engineering.work_order.view',
        'engineering.work_order.create',
        'engineering.work_order.assign',
        'engineering.work_order.status_update',
        'engineering.work_order.close',
        'engineering.work_order.note',
        'engineering.schedule.view',
        'engineering.schedule.manage',
        'night_audit:view',
        'night_audit:run',
        'night_audit:approve',
        'night_audit:recover',
        'fnb.outlet.view',
        'fnb.menu.view',
        'fnb.menu.manage',
        'fnb.table.view',
        'fnb.order.view',
        'fnb.order.create',
        'fnb.order.manage',
        'fnb.order.close',
        'spa.service.view',
        'spa.service.manage',
        'spa.therapist.view',
        'spa.room.view',
        'spa.appointment.view',
        'spa.appointment.create',
        'spa.appointment.manage',
        'spa.appointment.complete',
        'crm.guest.view',
        'crm.guest.manage',
        'crm.preference.view',
        'crm.preference.manage',
        'loyalty.membership.view',
        'loyalty.membership.manage',
        'loyalty.points.view',
        'loyalty.points.adjust',
      ],
    },
    {
      roleCode: 'NIGHT_AUDITOR',
      permCodes: [
        'night_audit:view',
        'night_audit:run',
        'night_audit:approve',
        'night_audit:recover',
        'front_office.reservation.read',
        'room_operations.status.read',
        'inventory:read',
        'folio:view',
        'folio:post_charge',
        'folio:post_payment',
        'frontdesk:checkout',
      ],
    },
    {
      roleCode: 'FDA',
      permCodes: [
        'front_office.reservation.read',
        'front_office.reservation.create',
        'front_office.reservation.cancel',
        'front_office.room_assignment.manage',
        'front_office.checkin.execute',
        'front_office.checkin.clean_override',
        'room-type:read',
        'room_operations.status.read',
        'room_operations.status.update',
        'inventory:read',
        'folio:view',
        'folio:post_charge',
        'folio:post_payment',
        'frontdesk:checkout',
        'engineering.work_order.view',
        'engineering.work_order.create',
        'engineering.work_order.note',
        'fnb.outlet.view',
        'fnb.menu.view',
        'fnb.table.view',
        'fnb.order.view',
        'fnb.order.create',
        'fnb.order.manage',
        'fnb.order.close',
        'spa.service.view',
        'spa.therapist.view',
        'spa.room.view',
        'spa.appointment.view',
        'spa.appointment.create',
        'spa.appointment.manage',
        'spa.appointment.complete',
        'events.venue.view',
        'events.package.view',
        'events.booking.view',
        'events.booking.create',
        'events.booking.manage',
        'events.booking.confirm',
        'events.booking.complete',
        'crm.guest.view',
        'crm.guest.manage',
        'crm.preference.view',
        'crm.preference.manage',
        'loyalty.membership.view',
        'loyalty.membership.manage',
        'loyalty.points.view',
        'loyalty.points.adjust',
      ],
    },
    {
      roleCode: 'HK_SUPERVISOR',
      permCodes: [
        'housekeeping.room.update',
        'housekeeping.room.inspect',
        'housekeeping.task.view',
        'housekeeping.task.assign',
        'housekeeping.task.inspect',
        'engineering.work_order.view',
        'engineering.work_order.create',
        'engineering.work_order.note',
      ],
    },
    {
      roleCode: 'MAINT_TECH',
      permCodes: [
        'engineering.asset.view',
        'engineering.work_order.view',
        'engineering.work_order.status_update',
        'engineering.work_order.note',
        'engineering.schedule.view',
        'maintenance.ticket.create',
      ],
    },
    {
      roleCode: 'ROOM_ATTENDANT',
      permCodes: [
        'housekeeping.room.update',
        'housekeeping.task.view',
        'housekeeping.task.claim',
        'housekeeping.task.start',
        'housekeeping.task.complete',
      ],
    },
  ];

  for (const assignment of rolePermissionAssignments) {
    const roleId = roleMap.get(assignment.roleCode);
    if (!roleId) continue;

    for (const permCode of assignment.permCodes) {
      const permId = permMap.get(permCode);
      if (!permId) continue;

      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permId,
          },
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            id: generateUuidV7(),
            roleId,
            permissionId: permId,
          },
        });
      }
    }
  }

  console.log('IAM baseline seeding completed successfully.');
}

if (require.main === module) {
  seedIamBaseline()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      const prisma = getPrismaClient();
      await prisma.$disconnect();
    });
}
