import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserManagementService } from '../../apps/api-core/src/modules/identity/application/services/user-management.service';
import {
  SecurityContext,
  UserRoleSnapshot,
  UserScopeSnapshot,
  ManagedUserDetailDto,
} from '@hms/api-contracts';
import { generateUuidV7 } from '@hms/shared';

describe('UserManagementService Unit Tests', () => {
  let service: UserManagementService;
  let mockPrisma: any;
  let mockAuthorizationCache: any;
  let mockHierarchyValidation: any;
  let mockCredentialService: any;
  let mockPasswordPolicyService: any;
  let mockAuditSink: any;

  const hotelGroupId = '01a00000-0000-7000-0000-000000000001';
  const propertyIdA = '01a00000-0000-7000-0000-000000000011';
  const propertyIdB = '01a00000-0000-7000-0000-000000000012';
  const unauthorizedPropertyId = '01a00000-0000-7000-0000-000000000099';

  const globalAdminActorId = '01a00000-0000-7000-0000-000000000100';
  const corpAdminActorId = '01a00000-0000-7000-0000-000000000101';
  const propertyGmActorId = '01a00000-0000-7000-0000-000000000102';
  const staffActorId = '01a00000-0000-7000-0000-000000000103';

  const role = (code: string): UserRoleSnapshot => ({
    id: `role-${code}`,
    code,
    name: code,
    isSystem: true,
    hotelGroupId,
  });

  const scope = (
    scopeType: UserScopeSnapshot['scopeType'],
    roleCode: string,
    opts: { propertyId?: string | null; hotelGroupId?: string | null } = {},
  ): UserScopeSnapshot => ({
    id: `scope-${roleCode}-${scopeType}-${opts.propertyId ?? 'na'}`,
    roleId: `role-${roleCode}`,
    roleCode,
    scopeType,
    hotelGroupId: opts.hotelGroupId ?? hotelGroupId,
    regionId: null,
    countryId: null,
    propertyId: opts.propertyId ?? null,
    departmentCode: null,
    permissions: ['user.manage.read', 'user.manage.write'],
  });

  const makeActor = (
    id: string,
    email: string,
    roles: UserRoleSnapshot[],
    scopes: UserScopeSnapshot[],
    opts: { isGlobalAdmin?: boolean; activeHotelGroupId?: string | null; activePropertyId?: string | null; permissions?: string[] } = {},
  ): SecurityContext => ({
    userId: id,
    sessionId: `session-${id}`,
    correlationId: `corr-${id}`,
    activeContext: {
      hotelGroupId: opts.activeHotelGroupId ?? hotelGroupId,
      propertyId: opts.activePropertyId ?? propertyIdA,
    },
    user: { id, email, firstName: 'Test', lastName: 'Actor', status: 'ACTIVE' },
    isGlobalAdmin: opts.isGlobalAdmin ?? false,
    roles: Object.freeze(roles),
    permissions: new Set(opts.permissions ?? ['user.manage.read', 'user.manage.write']),
    scopes: Object.freeze(scopes),
  });

  const globalAdminActor = makeActor(globalAdminActorId, 'owner@example.com', [role('PLATFORM_OWNER')], [], {
    isGlobalAdmin: true,
    activeHotelGroupId: null,
    activePropertyId: null,
  });

  const corpAdminActor = makeActor(corpAdminActorId, 'corpadmin@example.com', [role('CORP_ADMIN')], [
    scope('GROUP', 'CORP_ADMIN'),
  ]);

  // CORP_ADMIN whose group scope carries no resolvable hotelGroupId. Built
  // explicitly (helpers coalesce null -> default) so hotelGroupId stays null.
  const corpAdminNoGroupActor: SecurityContext = {
    userId: '01a00000-0000-7000-0000-000000000104',
    sessionId: 'session-corp-nogroup',
    correlationId: 'corr-corp-nogroup',
    activeContext: { hotelGroupId: null, propertyId: null },
    user: {
      id: '01a00000-0000-7000-0000-000000000104',
      email: 'corpadmin-nogroup@example.com',
      firstName: 'Corp',
      lastName: 'NoGroup',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([role('CORP_ADMIN')]),
    permissions: new Set(['user.manage.read', 'user.manage.write']),
    scopes: Object.freeze([
      {
        id: 'scope-corp-nogroup',
        roleId: 'role-CORP_ADMIN',
        roleCode: 'CORP_ADMIN',
        scopeType: 'GROUP',
        hotelGroupId: null,
        regionId: null,
        countryId: null,
        propertyId: null,
        departmentCode: null,
        permissions: ['user.manage.read', 'user.manage.write'],
      } as UserScopeSnapshot,
    ]),
  };

  const propertyGmActor = makeActor(propertyGmActorId, 'gm@example.com', [role('PROPERTY_GM')], [
    scope('PROPERTY', 'PROPERTY_GM', { propertyId: propertyIdA }),
  ]);

  // Operational role that merely holds a GROUP scope record (must NOT be admin).
  const operationalWithGroupScopeActor = makeActor(
    '01a00000-0000-7000-0000-000000000105',
    'fda-group@example.com',
    [role('FDA')],
    [scope('GROUP', 'FDA')],
  );

  const staffActor = makeActor(staffActorId, 'staff@example.com', [role('FDA')], [
    scope('PROPERTY', 'FDA', { propertyId: propertyIdA }),
  ], { permissions: [] });

  const targetUser = (
    id: string,
    roleCodes: string[],
    propertyIds: Array<string | null>,
    extra: Record<string, any> = {},
  ) => ({
    id,
    email: `${id}@example.com`,
    firstName: 'Target',
    lastName: 'User',
    phone: null,
    status: 'ACTIVE',
    deletedAt: null,
    defaultPropertyId: propertyIds.find((p) => p) ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleScopes: roleCodes.map((code, idx) => ({
      id: `rs-${id}-${idx}`,
      userId: id,
      roleId: `role-${code}`,
      role: { id: `role-${code}`, code, name: code },
      scopeType: propertyIds[idx] ? 'PROPERTY' : 'GROUP',
      propertyId: propertyIds[idx] ?? null,
      hotelGroupId,
      property: propertyIds[idx]
        ? { id: propertyIds[idx], code: `PROP-${idx}`, name: `Property ${idx}` }
        : null,
    })),
    ...extra,
  });

  const makeDetail = (partial: Partial<ManagedUserDetailDto> = {}): ManagedUserDetailDto => ({
    id: 'detail-id',
    email: 'detail@example.com',
    firstName: 'Detail',
    lastName: 'User',
    phone: null,
    status: 'ACTIVE',
    role: { id: 'role-FDA', code: 'FDA', name: 'FDA' },
    assignedProperties: [],
    defaultPropertyId: null,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopes: [],
    ...partial,
  });

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(mockPrisma);
        }
        return Promise.all(callback);
      }),
      property: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.id === propertyIdA || where?.id === propertyIdB) {
            return {
              id: where.id,
              code: where.id === propertyIdA ? 'PROP-A' : 'PROP-B',
              name: 'Property',
              city: 'City',
              country: { region: { hotelGroupId } },
            };
          }
          return null;
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        })),
        update: jest.fn().mockImplementation(async ({ data, where }: any) => ({
          id: where.id,
          ...data,
          updatedAt: new Date(),
        })),
      },
      organizationMembership: {
        create: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      role: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          const known = ['CORP_ADMIN', 'PROPERTY_GM', 'FOM', 'FDA', 'PLATFORM_OWNER', 'FNB_MANAGER'];
          if (known.includes(where?.code)) {
            return { id: `role-${where.code}`, code: where.code, name: where.code };
          }
          return null;
        }),
      },
      userRoleScope: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: generateUuidV7(), ...data })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockAuthorizationCache = {
      invalidateUser: jest.fn().mockResolvedValue(1),
      invalidateRole: jest.fn().mockResolvedValue(1),
    };

    mockHierarchyValidation = {
      getPropertyHierarchy: jest.fn().mockImplementation(async (propertyId: string) => ({
        propertyId,
        propertyCode: 'PROP',
        countryId: 'country-1',
        regionId: 'region-1',
        hotelGroupId,
        status: 'ACTIVE',
      })),
      validatePropertyInGroup: jest.fn().mockResolvedValue(true),
    };

    mockCredentialService = {
      createCredential: jest.fn().mockResolvedValue({ id: 'cred-1', userId: 'u', status: 'ACTIVE' }),
    };

    mockPasswordPolicyService = {
      assertValidAndNotBreached: jest.fn().mockResolvedValue(undefined),
      validateOrThrow: jest.fn(),
      isBreached: jest.fn().mockResolvedValue(false),
    };

    mockAuditSink = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new UserManagementService(
      mockPrisma,
      mockAuthorizationCache,
      mockHierarchyValidation,
      mockCredentialService,
      mockPasswordPolicyService,
      mockAuditSink,
    );
  });

  describe('Accessible Properties for Management', () => {
    it('returns all properties in group for CORP_ADMIN', async () => {
      mockPrisma.property.findMany.mockResolvedValueOnce([
        { id: propertyIdA, code: 'PROP-A', name: 'A', city: 'X', country: { region: { hotelGroupId } } },
        { id: propertyIdB, code: 'PROP-B', name: 'B', city: 'Y', country: { region: { hotelGroupId } } },
      ]);
      const properties = await service.getAccessiblePropertiesForManagement(corpAdminActor);
      expect(properties).toHaveLength(2);
    });

    it('returns empty list for non-admin actor without admin role', async () => {
      const properties = await service.getAccessiblePropertiesForManagement(staffActor);
      expect(properties).toEqual([]);
    });
  });

  describe('Listing Users', () => {
    it('restricts PROPERTY_GM to their assigned property users', async () => {
      await service.listUsers(propertyGmActor, {});
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleScopes: { some: { propertyId: { in: [propertyIdA] } } },
          }),
        }),
      );
    });

    it('throws ForbiddenException if PROPERTY_GM filters by unassigned property', async () => {
      await expect(
        service.listUsers(propertyGmActor, { propertyId: unauthorizedPropertyId }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // FIX 1 — Protected target roles (tests 1, 2, 3)
  // ==========================================================================
  describe('Protected Target Role Boundaries', () => {
    const platformOwnerId = 'target-platform-owner';
    const corpAdminTargetId = 'target-corp-admin';
    const gmTargetId = 'target-gm';

    it('test 1: CORP_ADMIN cannot manage a PLATFORM_OWNER account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(platformOwnerId, ['PLATFORM_OWNER'], [propertyIdA]),
      );
      await expect(service.getUserById(corpAdminActor, platformOwnerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('test 1b: PROPERTY_GM cannot manage a PLATFORM_OWNER account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(platformOwnerId, ['PLATFORM_OWNER'], [propertyIdA]),
      );
      await expect(service.getUserById(propertyGmActor, platformOwnerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('test 1c: a global admin MAY manage a PLATFORM_OWNER account (control)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(platformOwnerId, ['PLATFORM_OWNER'], [propertyIdA]),
      );
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: platformOwnerId }));
      await expect(service.getUserById(globalAdminActor, platformOwnerId)).resolves.toBeDefined();
    });

    it('test 2: CORP_ADMIN cannot manage another CORP_ADMIN account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(corpAdminTargetId, ['CORP_ADMIN'], [propertyIdA]),
      );
      await expect(service.getUserById(corpAdminActor, corpAdminTargetId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('test 2b: PROPERTY_GM cannot manage a CORP_ADMIN account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(corpAdminTargetId, ['CORP_ADMIN'], [propertyIdA]),
      );
      await expect(service.getUserById(propertyGmActor, corpAdminTargetId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('test 3: PROPERTY_GM cannot manage another PROPERTY_GM account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(gmTargetId, ['PROPERTY_GM'], [propertyIdA]),
      );
      await expect(service.getUserById(propertyGmActor, gmTargetId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('test 3b: PROPERTY_GM cannot deactivate a protected CORP_ADMIN target', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(corpAdminTargetId, ['CORP_ADMIN'], [propertyIdA]),
      );
      await expect(
        service.updateUserStatus(propertyGmActor, corpAdminTargetId, { status: 'INACTIVE' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows CORP_ADMIN to manage an operational user in scope', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser('target-fda', ['FDA'], [propertyIdA]),
      );
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: 'target-fda' }));
      await expect(service.getUserById(corpAdminActor, 'target-fda')).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // FIX 2 — updateUser scope preservation (tests 4, 5, 6)
  // ==========================================================================
  describe('Update User Scope Preservation', () => {
    const mixedTargetId = 'mixed-target-001';

    const mixedTarget = () => ({
      id: mixedTargetId,
      email: 'mixed@example.com',
      firstName: 'Mixed',
      lastName: 'Scopes',
      phone: null,
      status: 'ACTIVE',
      deletedAt: null,
      defaultPropertyId: propertyIdA,
      createdAt: new Date(),
      updatedAt: new Date(),
      roleScopes: [
        {
          id: 'rs-group',
          userId: mixedTargetId,
          roleId: 'role-FDA',
          role: { id: 'role-FDA', code: 'FDA', name: 'FDA' },
          scopeType: 'GROUP',
          propertyId: null,
          hotelGroupId,
        },
        {
          id: 'rs-prop-a',
          userId: mixedTargetId,
          roleId: 'role-FDA',
          role: { id: 'role-FDA', code: 'FDA', name: 'FDA' },
          scopeType: 'PROPERTY',
          propertyId: propertyIdA,
          hotelGroupId,
        },
        {
          id: 'rs-prop-b',
          userId: mixedTargetId,
          roleId: 'role-FDA',
          role: { id: 'role-FDA', code: 'FDA', name: 'FDA' },
          scopeType: 'PROPERTY',
          propertyId: propertyIdB,
          hotelGroupId,
        },
      ],
    });

    it('test 4: never deletes non-PROPERTY scopes when changing role', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mixedTarget());
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: mixedTargetId }));

      await service.updateUser(corpAdminActor, mixedTargetId, { roleCode: 'FOM' });

      // Only PROPERTY scopes may be deleted.
      const deleteCalls = mockPrisma.userRoleScope.deleteMany.mock.calls;
      expect(deleteCalls.length).toBeGreaterThan(0);
      for (const call of deleteCalls) {
        expect(call[0].where).toEqual(
          expect.objectContaining({ userId: mixedTargetId, scopeType: 'PROPERTY' }),
        );
      }
    });

    it('test 5: preserves multiple property assignments', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mixedTarget());
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: mixedTargetId }));

      await service.updateUser(corpAdminActor, mixedTargetId, { roleCode: 'FOM' });

      const created = mockPrisma.userRoleScope.create.mock.calls.map((c: any[]) => c[0].data);
      const createdPropertyIds = created.map((d: any) => d.propertyId).sort();
      expect(createdPropertyIds).toEqual([propertyIdA, propertyIdB].sort());
      expect(created.every((d: any) => d.scopeType === 'PROPERTY')).toBe(true);
    });

    it('test 6: preserves hotelGroupId on recreated property scopes', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mixedTarget());
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: mixedTargetId }));

      await service.updateUser(corpAdminActor, mixedTargetId, { roleCode: 'FOM' });

      const created = mockPrisma.userRoleScope.create.mock.calls.map((c: any[]) => c[0].data);
      expect(created.length).toBe(2);
      expect(created.every((d: any) => d.hotelGroupId === hotelGroupId)).toBe(true);
    });
  });

  // ==========================================================================
  // FIX 3 — Self-deactivation guards (tests 7, 8)
  // ==========================================================================
  describe('Self-Deactivation Guards', () => {
    it('test 7: blocks self-deactivation through PATCH /:id (updateUser)', async () => {
      await expect(
        service.updateUser(corpAdminActor, corpAdminActorId, { status: 'INACTIVE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('test 8: blocks self-deactivation through PATCH /:id/status (updateUserStatus)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        targetUser(corpAdminActorId, ['CORP_ADMIN'], [propertyIdA]),
      );
      await expect(
        service.updateUserStatus(corpAdminActor, corpAdminActorId, { status: 'INACTIVE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('emits USER_STATUS_CHANGED (not USER_UPDATED) on a status mutation via updateUser', async () => {
      const id = 'status-target-001';
      mockPrisma.user.findUnique.mockResolvedValueOnce(targetUser(id, ['FDA'], [propertyIdA]));
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id, status: 'INACTIVE' }));

      await service.updateUser(corpAdminActor, id, { status: 'INACTIVE' });

      const actions = mockAuditSink.record.mock.calls.map((c: any[]) => c[0].action);
      expect(actions).toContain('USER_STATUS_CHANGED');
      expect(actions).not.toContain('USER_UPDATED');
    });
  });

  // ==========================================================================
  // FIX 4 — Authority fail-closed (tests 9, 10)
  // ==========================================================================
  describe('Actor Authority Fail-Closed', () => {
    it('test 9: an operational role with a GROUP scope is NOT a group admin', async () => {
      await expect(service.listUsers(operationalWithGroupScopeActor, {})).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
      });

      await expect(
        service.createUser(operationalWithGroupScopeActor, {
          email: 'escalate@example.com',
          firstName: 'Escalate',
          lastName: 'Attempt',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('test 10: a non-global group admin with null hotelGroupId fails closed on property assignment', async () => {
      await expect(
        service.createUser(corpAdminNoGroupActor, {
          email: 'failclosed@example.com',
          firstName: 'Fail',
          lastName: 'Closed',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // FIX 5 — Credential provisioning policy (tests 11, 12)
  // ==========================================================================
  describe('Credential Provisioning Policy', () => {
    it('test 11: rejects a supplied password that violates policy and does not create a credential', async () => {
      mockPasswordPolicyService.assertValidAndNotBreached.mockRejectedValueOnce(
        new BadRequestException('Password must be at least 12 characters long.'),
      );

      await expect(
        service.createUser(corpAdminActor, {
          email: 'weakpass@example.com',
          firstName: 'Weak',
          lastName: 'Pass',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
          initialPassword: 'short',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockCredentialService.createCredential).not.toHaveBeenCalled();
    });

    it('test 12: generates a policy-compliant password, provisions via CredentialService, returns it once', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: 'generated-user' }));

      const result = await service.createUser(corpAdminActor, {
        email: 'generated@example.com',
        firstName: 'Gen',
        lastName: 'User',
        roleCode: 'FDA',
        propertyIds: [propertyIdA],
      });

      expect(mockCredentialService.createCredential).toHaveBeenCalledTimes(1);
      const [userIdArg, plaintextArg, txArg] = mockCredentialService.createCredential.mock.calls[0];
      expect(typeof userIdArg).toBe('string');
      expect(typeof plaintextArg).toBe('string');
      expect(plaintextArg.length).toBeGreaterThanOrEqual(12);
      expect(plaintextArg.startsWith('$argon2')).toBe(false);
      expect(txArg).toBeDefined();
      expect(result.provisionedPassword).toBe(plaintextArg);
    });

    it('validates a supplied password through the policy and does not return it', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: 'supplied-user' }));

      const result = await service.createUser(corpAdminActor, {
        email: 'supplied@example.com',
        firstName: 'Sup',
        lastName: 'PLIED',
        roleCode: 'FDA',
        propertyIds: [propertyIdA],
        initialPassword: 'Str0ng!Supplied#2026',
      });

      expect(mockPasswordPolicyService.assertValidAndNotBreached).toHaveBeenCalledWith(
        'Str0ng!Supplied#2026',
      );
      expect(mockCredentialService.createCredential).toHaveBeenCalled();
      expect(result.provisionedPassword).toBeUndefined();
    });
  });

  // ==========================================================================
  // FIX 6 — Duplicate email handling (tests 13, 14)
  // ==========================================================================
  describe('Duplicate Email Handling', () => {
    it('test 13: returns 409 when the email already exists (fast path)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-dup', email: 'dup@example.com' });

      await expect(
        service.createUser(corpAdminActor, {
          email: 'dup@example.com',
          firstName: 'Dup',
          lastName: 'Email',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('test 14: maps a concurrent P2002 unique violation to 409', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

      await expect(
        service.createUser(corpAdminActor, {
          email: 'race@example.com',
          firstName: 'Race',
          lastName: 'Condition',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================================================
  // Preserved existing behaviour
  // ==========================================================================
  describe('User Creation Authorization', () => {
    it('allows CORP_ADMIN to create a user with multiple properties and invalidates cache', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: 'new-user-id' }));

      const result = await service.createUser(corpAdminActor, {
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        roleCode: 'FDA',
        propertyIds: [propertyIdA, propertyIdB],
      });

      expect(result.id).toBe('new-user-id');
      expect(mockAuthorizationCache.invalidateUser).toHaveBeenCalled();
      expect(mockAuditSink.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED', outcome: 'SUCCESS' }),
      );
    });

    it('throws ForbiddenException if PROPERTY_GM tries to create CORP_ADMIN or PLATFORM_OWNER', async () => {
      await expect(
        service.createUser(propertyGmActor, {
          email: 'gmattempt@example.com',
          firstName: 'Bad',
          lastName: 'Role',
          roleCode: 'CORP_ADMIN',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createUser(propertyGmActor, {
          email: 'gmattempt2@example.com',
          firstName: 'Bad',
          lastName: 'Role',
          roleCode: 'PLATFORM_OWNER',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if PROPERTY_GM assigns an unauthorized property', async () => {
      await expect(
        service.createUser(propertyGmActor, {
          email: 'unauth@example.com',
          firstName: 'Unauth',
          lastName: 'Prop',
          roleCode: 'FDA',
          propertyIds: [propertyIdA, unauthorizedPropertyId],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows PROPERTY_GM to create operational staff in their authorized property', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id: 'gm-created-user' }));

      const result = await service.createUser(propertyGmActor, {
        email: 'fom@example.com',
        firstName: 'Front',
        lastName: 'Manager',
        roleCode: 'FOM',
        propertyIds: [propertyIdA],
      });

      expect(result.id).toBe('gm-created-user');
      expect(mockAuthorizationCache.invalidateUser).toHaveBeenCalled();
    });
  });

  describe('Property Assignment & Removal', () => {
    const id = 'target-user-001';

    it('allows assigning properties and invalidates the authorization cache', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(targetUser(id, ['FDA'], [propertyIdA]));
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id }));

      await service.assignProperties(corpAdminActor, id, { propertyIds: [propertyIdA, propertyIdB] });

      expect(mockAuthorizationCache.invalidateUser).toHaveBeenCalledWith(id);
      expect(mockAuditSink.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_PROPERTY_ASSIGNED', resourceId: id }),
      );
    });

    it('allows removing a property assignment when more than one remains', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(targetUser(id, ['FDA', 'FDA'], [propertyIdA, propertyIdB]));
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id }));

      await service.removePropertyAssignment(corpAdminActor, id, propertyIdB);

      expect(mockAuthorizationCache.invalidateUser).toHaveBeenCalledWith(id);
      expect(mockAuditSink.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_PROPERTY_REMOVED', resourceId: id }),
      );
    });

    it('throws BadRequestException when attempting to remove the last property assignment', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(targetUser(id, ['FDA'], [propertyIdA]));

      await expect(service.removePropertyAssignment(corpAdminActor, id, propertyIdA)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('User Status Update', () => {
    const id = 'target-user-002';

    it('allows CORP_ADMIN to deactivate a user, emitting USER_STATUS_CHANGED', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(targetUser(id, ['FDA'], [propertyIdA]));
      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(makeDetail({ id, status: 'INACTIVE' }));

      const updated = await service.updateUserStatus(corpAdminActor, id, { status: 'INACTIVE' });

      expect(updated.status).toBe('INACTIVE');
      expect(mockAuthorizationCache.invalidateUser).toHaveBeenCalledWith(id);
      expect(mockAuditSink.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_STATUS_CHANGED', resourceId: id }),
      );
    });
  });

  describe('Access Control Invariants', () => {
    it('returns empty list and forbids creation for non-admin staff', async () => {
      await expect(service.listUsers(staffActor, {})).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
      });

      await expect(
        service.createUser(staffActor, {
          email: 'test@example.com',
          firstName: 'Unauthorized',
          lastName: 'Attempt',
          roleCode: 'FDA',
          propertyIds: [propertyIdA],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
