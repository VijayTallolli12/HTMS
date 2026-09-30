import { IamBaselineService } from '../../apps/api-core/src/modules/setup/application/services/iam-baseline.service';
import {
  CANONICAL_SYSTEM_ROLES,
  CANONICAL_PERMISSIONS,
  CANONICAL_ROLE_PERMISSIONS,
} from '../../apps/api-core/src/modules/setup/application/data/iam-baseline.data';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

describe('IamBaselineService (W2 Phase 1)', () => {
  let service: IamBaselineService;
  let prismaMock: any;

  const makeRole = (code: string) => ({ id: generateUuidV7(), code, hotelGroupId: null, isSystem: true });
  const makePerm = (code: string) => ({ id: generateUuidV7(), code });

  beforeEach(() => {
    prismaMock = {
      role: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      permission: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      rolePermission: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new IamBaselineService(prismaMock as unknown as PrismaService);
  });

  it('canonical data preserves the W1 roles and includes scoped Channel Manager permissions', () => {
    expect(CANONICAL_SYSTEM_ROLES.map((r) => r.code)).toEqual([
      'PLATFORM_OWNER',
      'CORP_ADMIN',
      'PROPERTY_GM',
      'FOM',
      'FDA',
      'HK_SUPERVISOR',
      'ROOM_ATTENDANT',
      'MAINT_TECH',
      'NIGHT_AUDITOR',
      'FNB_MANAGER',
      'SPA_MANAGER',
    ]);
    expect(CANONICAL_PERMISSIONS.length).toBeGreaterThanOrEqual(130);
    expect(CANONICAL_PERMISSIONS.map((permission) => permission.code)).toEqual(expect.arrayContaining([
      'channel:read', 'channel:create', 'channel:update', 'channel:delete', 'channel:sync', 'channel:reconcile',
    ]));
    expect(CANONICAL_ROLE_PERMISSIONS).toHaveLength(10);
  });

  it('creates missing roles and preserves existing role IDs', async () => {
    const existingGm = makeRole('PROPERTY_GM');
    prismaMock.role.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.code === 'PROPERTY_GM' ? existingGm : null),
    );
    prismaMock.role.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: generateUuidV7(), ...data }),
    );
    prismaMock.permission.findUnique.mockResolvedValue(null);
    prismaMock.permission.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: generateUuidV7(), ...data }),
    );
    prismaMock.rolePermission.findMany.mockResolvedValue([]);
    prismaMock.rolePermission.create.mockResolvedValue({});

    await service.ensureBaseline();

    // PROPERTY_GM reused, not recreated
    expect(prismaMock.role.create).toHaveBeenCalledTimes(10);
    expect(prismaMock.role.create.mock.calls.every((c: any) => c[0].data.code !== 'PROPERTY_GM')).toBe(true);
    // The canonical baseline includes six explicitly scoped Channel Manager permissions.
    expect(prismaMock.permission.create).toHaveBeenCalledTimes(CANONICAL_PERMISSIONS.length);
  });

  it('is idempotent: second run creates nothing new', async () => {
    const roles = new Map(CANONICAL_SYSTEM_ROLES.map((r) => [r.code, makeRole(r.code)]));
    const perms = new Map(CANONICAL_PERMISSIONS.map((p) => [p.code, makePerm(p.code)]));

    prismaMock.role.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(roles.get(where.code) ?? null),
    );
    prismaMock.permission.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(perms.get(where.code) ?? null),
    );
    // Every role already has all its mapped permissions
    prismaMock.rolePermission.findMany.mockImplementation(() =>
      Promise.resolve(
        CANONICAL_PERMISSIONS.map((p) => ({ permissionId: perms.get(p.code)!.id })),
      ),
    );
    prismaMock.rolePermission.create.mockResolvedValue({});

    await service.ensureBaseline();

    expect(prismaMock.role.create).not.toHaveBeenCalled();
    expect(prismaMock.permission.create).not.toHaveBeenCalled();
    expect(prismaMock.rolePermission.create).not.toHaveBeenCalled();
  });

  it('skips permission mappings that already exist (no duplicate rolePermissions)', async () => {
    const permIds = new Map(CANONICAL_PERMISSIONS.map((p) => [p.code, `perm-${p.code}`]));
    const fdaAssignment = CANONICAL_ROLE_PERMISSIONS.find((a) => a.roleCode === 'FDA')!;
    const existingFdaIds = fdaAssignment.permCodes.slice(0, 5).map((code) => permIds.get(code)!);
    const totalMapped = CANONICAL_ROLE_PERMISSIONS.reduce((n, a) => n + a.permCodes.length, 0);

    prismaMock.role.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: `role-${where.code}`, code: where.code, hotelGroupId: null, isSystem: true }),
    );
    prismaMock.permission.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: permIds.get(where.code), code: where.code }),
    );
    prismaMock.rolePermission.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.roleId === 'role-FDA' ? existingFdaIds.map((permissionId) => ({ permissionId })) : []),
    );
    prismaMock.rolePermission.create.mockResolvedValue({});

    await service.ensureBaseline();

    // All mapped permissions minus the 5 pre-existing FDA ones.
    expect(prismaMock.rolePermission.create).toHaveBeenCalledTimes(totalMapped - 5);

    // None of the inserts duplicate a pre-existing FDA (role, permission) pair.
    // (The same permission code may legitimately be inserted for OTHER roles.)
    const insertedPairs = prismaMock.rolePermission.create.mock.calls.map(
      (c: any) => `${c[0].data.roleId}:${c[0].data.permissionId}`,
    );
    for (const existingId of existingFdaIds) {
      expect(insertedPairs).not.toContain(`role-FDA:${existingId}`);
    }
  });
});
