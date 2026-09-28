import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import {
  CANONICAL_SYSTEM_ROLES,
  CANONICAL_PERMISSIONS,
  CANONICAL_ROLE_PERMISSIONS,
  RoleDefinition,
  PermissionDefinition,
} from '../data/iam-baseline.data';


/**
 * Ensures the canonical IAM baseline (system roles + permissions + mappings)
 * exists and is idempotent. This is the runtime equivalent of seed-iam.ts and
 * is safe to execute repeatedly on any database state.
 *
 * Guarantees:
 * - Roles are matched by (code, hotelGroupId = null) — no duplicates.
 * - Permissions are matched by unique code — no duplicates.
 * - Existing role IDs are preserved; only missing mappings are inserted.
 */
@Injectable()
export class IamBaselineService {
  private readonly logger = new Logger(IamBaselineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureBaseline(): Promise<void> {
    const roleMap = new Map<string, string>();
    for (const roleDef of CANONICAL_SYSTEM_ROLES) {
      const existing = await this.prisma.role.findFirst({
        where: { code: roleDef.code, hotelGroupId: null },
      });
      if (existing) {
        roleMap.set(roleDef.code, existing.id);
      } else {
        const created = await this.prisma.role.create({
          data: {
            id: generateUuidV7(),
            hotelGroupId: null,
            code: roleDef.code,
            name: roleDef.name,
            description: bestEffortRoleDescription(roleDef),
            isSystem: true,
          },
        });
        roleMap.set(roleDef.code, created.id);
        this.logger.log(`IAM baseline: created system role ${roleDef.code}`);
      }
    }

    const permMap = new Map<string, string>();
    for (const permDef of CANONICAL_PERMISSIONS) {
      const existing = await this.prisma.permission.findUnique({
        where: { code: permDef.code },
      });
      if (existing) {
        permMap.set(permDef.code, existing.id);
      } else {
        const created = await this.prisma.permission.create({
          data: {
            id: generateUuidV7(),
            code: permDef.code,
            name: permDef.name,
            description: permDef.description ?? null,
            module: permDef.module ?? null,
          },
        });
        permMap.set(permDef.code, created.id);
      }
    }

    // Insert only missing role-permission mappings (preserve existing IDs).
    for (const assignment of CANONICAL_ROLE_PERMISSIONS) {
      const roleId = roleMap.get(assignment.roleCode);
      if (!roleId) continue;

      const existingMappings = await this.prisma.rolePermission.findMany({
        where: { roleId },
        select: { permissionId: true },
      });
      const existingPermIds = new Set(existingMappings.map((m) => m.permissionId));

      for (const permCode of assignment.permCodes) {
        const permId = permMap.get(permCode);
        if (!permId || existingPermIds.has(permId)) continue;

        await this.prisma.rolePermission.create({
          data: { id: generateUuidV7(), roleId, permissionId: permId },
        });
      }
    }
  }

  async countSystemRoles(): Promise<number> {
    return this.prisma.role.count({ where: { hotelGroupId: null, isSystem: true } });
  }
}

function bestEffortRoleDescription(roleDef: RoleDefinition): string {
  if (roleDef.description) return roleDef.description;
  return roleDef.name;
}

// Re-exported for tests; see data file for canonical definitions.
export type { RoleDefinition, PermissionDefinition };
export { CANONICAL_PERMISSIONS as SETUP_CANONICAL_PERMISSIONS };
