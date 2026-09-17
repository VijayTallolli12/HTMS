import { AuthorizationService } from '../../apps/api-core/src/modules/identity/application/services/authorization.service';
import { AuthorizationCacheService } from '../../apps/api-core/src/modules/identity/application/services/authorization-cache.service';
import { HierarchyValidationService } from '../../apps/api-core/src/modules/identity/application/services/hierarchy-validation.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { SecurityContext, FrozenSet } from '@hms/api-contracts';
import { UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AuthorizationService (Unit)', () => {
  let service: AuthorizationService;
  let mockPrisma: jest.Mocked<Partial<PrismaService>>;
  let mockCache: jest.Mocked<Partial<AuthorizationCacheService>>;
  let mockHierarchy: jest.Mocked<Partial<HierarchyValidationService>>;

  const makeBaseContext = (overrides: Partial<SecurityContext> = {}): SecurityContext =>
    Object.freeze({
      userId: 'user-1',
      sessionId: 'session-1',
      correlationId: 'req-1',
      activeContext: Object.freeze({
        hotelGroupId: 'group-1',
        propertyId: null,
      }),
      user: Object.freeze({
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Smith',
        status: 'ACTIVE',
      }),
      isGlobalAdmin: false,
      roles: Object.freeze([]),
      permissions: new FrozenSet<string>([]),
      scopes: Object.freeze([]),
      ...overrides,
    });

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      getCurrentVersions: jest.fn().mockResolvedValue({ userVersion: 1, roleVersions: {} }),
    };
    mockHierarchy = {
      getPropertyHierarchy: jest.fn(),
      validatePropertyHierarchy: jest.fn(),
    };

    service = new AuthorizationService(
      mockPrisma as PrismaService,
      mockCache as AuthorizationCacheService,
      mockHierarchy as HierarchyValidationService,
    );
  });

  describe('can (Permission & Scope Dominance)', () => {
    it('should always allow Global Admin regardless of permissions or scope', async () => {
      const adminCtx = makeBaseContext({ isGlobalAdmin: true });

      const allowed = await service.can(adminCtx, 'financial:audit:delete', {
        propertyId: 'any-prop',
      });

      expect(allowed).toBe(true);
      expect(mockHierarchy.getPropertyHierarchy).not.toHaveBeenCalled();
    });

    it('should reject if user does not hold the permission at all', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['reservation:read']),
      });

      const allowed = await service.can(ctx, 'reservation:write');

      expect(allowed).toBe(false);
    });

    it('should allow if user has permission and no target scope is specified', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['reservation:read']),
      });

      const allowed = await service.can(ctx, 'reservation:read');

      expect(allowed).toBe(true);
    });

    it('GLOBAL scope assignment dominates any target property', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['reservation:read']),
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'SUPERVISOR',
            scopeType: 'GLOBAL',
            hotelGroupId: null,
            regionId: null,
            countryId: null,
            propertyId: null,
            departmentCode: null,
            permissions: Object.freeze(['reservation:read']),
          }),
        ]),
      });

      const allowed = await service.can(ctx, 'reservation:read', { propertyId: 'prop-xyz' });

      expect(allowed).toBe(true);
    });

    it('GROUP scope dominates property within the same hotel group', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['reservation:read']),
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'GROUP_MANAGER',
            scopeType: 'GROUP',
            hotelGroupId: 'group-1',
            regionId: null,
            countryId: null,
            propertyId: null,
            departmentCode: null,
            permissions: Object.freeze(['reservation:read']),
          }),
        ]),
      });

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue({
        propertyId: 'prop-10',
        countryId: 'country-1',
        regionId: 'reg-1',
        hotelGroupId: 'group-1', // matches
      });

      const allowed = await service.can(ctx, 'reservation:read', { propertyId: 'prop-10' });

      expect(allowed).toBe(true);
    });

    it('GROUP scope rejects property in a different hotel group', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['reservation:read']),
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'GROUP_MANAGER',
            scopeType: 'GROUP',
            hotelGroupId: 'group-1',
            regionId: null,
            countryId: null,
            propertyId: null,
            departmentCode: null,
            permissions: Object.freeze(['reservation:read']),
          }),
        ]),
      });

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue({
        propertyId: 'prop-99',
        countryId: 'country-99',
        regionId: 'reg-99',
        hotelGroupId: 'group-2', // different group
      });

      const allowed = await service.can(ctx, 'reservation:read', { propertyId: 'prop-99' });

      expect(allowed).toBe(false);
    });

    it('PROPERTY scope dominates matching propertyId', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['room:assign']),
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'FRONT_DESK',
            scopeType: 'PROPERTY',
            hotelGroupId: 'group-1',
            regionId: 'reg-1',
            countryId: 'country-1',
            propertyId: 'prop-1',
            departmentCode: 'FRONT_OFFICE',
            permissions: Object.freeze(['room:assign']),
          }),
        ]),
      });

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue({
        propertyId: 'prop-1',
        countryId: 'country-1',
        regionId: 'reg-1',
        hotelGroupId: 'group-1',
      });

      const allowed = await service.can(ctx, 'room:assign', { propertyId: 'prop-1' });
      expect(allowed).toBe(true);

      const denied = await service.can(ctx, 'room:assign', { propertyId: 'prop-2' });
      expect(denied).toBe(false);
    });

    it('DEPARTMENT scope dominates only when target departmentCode matches', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['shift:clockin']),
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'HOUSEKEEPING_STAFF',
            scopeType: 'DEPARTMENT',
            hotelGroupId: 'group-1',
            regionId: 'reg-1',
            countryId: 'country-1',
            propertyId: 'prop-1',
            departmentCode: 'HOUSEKEEPING',
            permissions: Object.freeze(['shift:clockin']),
          }),
        ]),
      });

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue({
        propertyId: 'prop-1',
        countryId: 'country-1',
        regionId: 'reg-1',
        hotelGroupId: 'group-1',
      });

      // Target matching department
      const matchDept = await service.can(ctx, 'shift:clockin', {
        propertyId: 'prop-1',
        departmentCode: 'HOUSEKEEPING',
      });
      expect(matchDept).toBe(true);

      // Target different department
      const wrongDept = await service.can(ctx, 'shift:clockin', {
        propertyId: 'prop-1',
        departmentCode: 'FRONT_OFFICE',
      });
      expect(wrongDept).toBe(false);

      // Target without department (property-wide action) — department staff cannot perform property-wide action
      const propWide = await service.can(ctx, 'shift:clockin', {
        propertyId: 'prop-1',
      });
      expect(propWide).toBe(false);
    });
  });

  describe('helper methods', () => {
    it('hasAllPermissions checks all permissions sequentially', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['p1', 'p2']),
      });

      expect(await service.hasAllPermissions(ctx, ['p1', 'p2'])).toBe(true);
      expect(await service.hasAllPermissions(ctx, ['p1', 'p3'])).toBe(false);
    });

    it('hasAnyPermission returns true if at least one permission matches', async () => {
      const ctx = makeBaseContext({
        permissions: new FrozenSet(['p1']),
      });

      expect(await service.hasAnyPermission(ctx, ['p1', 'p2'])).toBe(true);
      expect(await service.hasAnyPermission(ctx, ['p2', 'p3'])).toBe(false);
    });

    it('hasRole and hasAnyRole check user roles correctly', () => {
      const ctx = makeBaseContext({
        roles: Object.freeze([
          Object.freeze({
            id: 'r-1',
            code: 'MANAGER',
            name: 'General Manager',
            isSystem: false,
            hotelGroupId: 'group-1',
          }),
        ]),
      });

      expect(service.hasRole(ctx, 'MANAGER')).toBe(true);
      expect(service.hasRole(ctx, 'CHEF')).toBe(false);
      expect(service.hasAnyRole(ctx, ['CHEF', 'MANAGER'])).toBe(true);
      expect(service.hasAnyRole(ctx, ['CHEF', 'WAITER'])).toBe(false);
    });

    it('isPropertyWithinScope checks scope hierarchy containment', async () => {
      const ctx = makeBaseContext({
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'REGION_DIRECTOR',
            scopeType: 'REGION',
            hotelGroupId: 'group-1',
            regionId: 'reg-emea',
            countryId: null,
            propertyId: null,
            departmentCode: null,
            permissions: Object.freeze([]),
          }),
        ]),
      });

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValueOnce({
        propertyId: 'prop-paris',
        countryId: 'country-fr',
        regionId: 'reg-emea',
        hotelGroupId: 'group-1',
      });

      expect(await service.isPropertyWithinScope(ctx, 'prop-paris')).toBe(true);

      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValueOnce({
        propertyId: 'prop-tokyo',
        countryId: 'country-jp',
        regionId: 'reg-apac',
        hotelGroupId: 'group-1',
      });

      expect(await service.isPropertyWithinScope(ctx, 'prop-tokyo')).toBe(false);
    });
  });

  describe('resolveSecurityContext', () => {
    it('should throw UnauthorizedException if database returns no rows', async () => {
      (mockCache.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      await expect(
        service.resolveSecurityContext('user-unknown', 'session-1', {
          hotelGroupId: 'group-1',
          propertyId: null,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if property does not belong to active hotel group', async () => {
      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue({
        propertyId: 'prop-1',
        countryId: 'c-1',
        regionId: 'r-1',
        hotelGroupId: 'group-different',
      });

      await expect(
        service.resolveSecurityContext('user-1', 'session-1', {
          hotelGroupId: 'group-1',
          propertyId: 'prop-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      (mockHierarchy.getPropertyHierarchy as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveSecurityContext('user-1', 'session-1', {
          hotelGroupId: 'group-1',
          propertyId: 'prop-nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
