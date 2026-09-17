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
      code: 'front_office.checkin.execute',
      name: 'Execute Check-In',
      description: 'Execute guest check-in and room key issuance',
      module: 'FRONT_OFFICE',
    },
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
      code: 'maintenance.ticket.create',
      name: 'Create Maintenance Ticket',
      description: 'Report physical defects or equipment breakdowns',
      module: 'MAINTENANCE',
    },
    {
      code: 'finance.folio.read',
      name: 'View Folio',
      description: 'Inspect guest charges, tax breakdown, and open balances',
      module: 'FINANCE',
    },
    {
      code: 'platform.audit_log.read',
      name: 'View Audit Log',
      description: 'Inspect immutable system security and activity audit records',
      module: 'PLATFORM',
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
        'front_office.checkin.execute',
        'housekeeping.room.update',
        'housekeeping.room.inspect',
        'maintenance.ticket.create',
        'finance.folio.read',
      ],
    },
    {
      roleCode: 'FDA',
      permCodes: [
        'front_office.reservation.read',
        'front_office.reservation.create',
        'front_office.checkin.execute',
      ],
    },
    {
      roleCode: 'HK_SUPERVISOR',
      permCodes: ['housekeeping.room.update', 'housekeeping.room.inspect'],
    },
    {
      roleCode: 'ROOM_ATTENDANT',
      permCodes: ['housekeeping.room.update'],
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
