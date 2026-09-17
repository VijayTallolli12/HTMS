import { ScopedRbacGuard } from '../../apps/api-core/src/modules/identity/presentation/guards/scoped-rbac.guard';
import { AuthorizationService } from '../../apps/api-core/src/modules/identity/application/services/authorization.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SecurityContext, FrozenSet } from '@hms/api-contracts';
import {
  IS_PUBLIC_KEY,
  IS_AUTHENTICATED_ONLY_KEY,
  PERMISSIONS_KEY,
  ANY_PERMISSIONS_KEY,
  ROLES_KEY,
  SCOPE_LEVELS_KEY,
  REQUIRE_PROPERTY_CONTEXT_KEY,
} from '../../apps/api-core/src/modules/identity/presentation/decorators/authz.decorators';

describe('ScopedRbacGuard (Unit)', () => {
  let guard: ScopedRbacGuard;
  let reflector: jest.Mocked<Reflector>;
  let authzService: jest.Mocked<Partial<AuthorizationService>>;

  const makeMockContext = (request: any = {}): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    }) as unknown as ExecutionContext;

  const mockBaseSecurityContext: SecurityContext = Object.freeze({
    userId: 'user-1',
    sessionId: 'session-1',
    correlationId: 'req-1',
    activeContext: Object.freeze({
      hotelGroupId: 'group-1',
      propertyId: 'prop-1',
    }),
    user: Object.freeze({
      id: 'user-1',
      email: 'user@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      status: 'ACTIVE',
    }),
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new FrozenSet([]),
    scopes: Object.freeze([]),
  });

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    authzService = {
      hasAllPermissions: jest.fn(),
      hasAnyPermission: jest.fn(),
      hasRole: jest.fn(),
      hasAnyRole: jest.fn(),
    };

    guard = new ScopedRbacGuard(reflector, authzService as AuthorizationService);
  });

  describe('canActivate', () => {
    it('should allow immediately when @Public() is set', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const ctx = makeMockContext();
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if securityContext is missing on request', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const ctx = makeMockContext({ securityContext: undefined });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should bypass all authorization when user is Global Admin', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const ctx = makeMockContext({
        securityContext: { ...mockBaseSecurityContext, isGlobalAdmin: true },
      });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow authenticated access without permissions when @Authenticated() is set', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_AUTHENTICATED_ONLY_KEY) return true;
        return undefined;
      });

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should DENY BY DEFAULT if endpoint lacks @Public, @Authenticated, @RequirePermissions, or @RequireRoles', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should require property context when @RequirePropertyContext is present', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === REQUIRE_PROPERTY_CONTEXT_KEY) return true;
        if (key === PERMISSIONS_KEY) return ['room:read'];
        return undefined;
      });

      // Context without propertyId
      const ctxNoProp = makeMockContext({
        securityContext: {
          ...mockBaseSecurityContext,
          activeContext: { hotelGroupId: 'group-1', propertyId: null },
        },
      });

      await expect(guard.canActivate(ctxNoProp)).rejects.toThrow(ForbiddenException);
    });

    it('should enforce @RequireRoles and deny if user lacks the role', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return ['GENERAL_MANAGER'];
        return undefined;
      });

      (authzService.hasAnyRole as jest.Mock).mockReturnValue(false);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(authzService.hasAnyRole).toHaveBeenCalledWith(mockBaseSecurityContext, [
        'GENERAL_MANAGER',
      ]);
    });

    it('should enforce @RequireRoles and allow if user has the role', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return ['GENERAL_MANAGER'];
        return undefined;
      });

      (authzService.hasAnyRole as jest.Mock).mockReturnValue(true);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should enforce @RequirePermissions and deny if user lacks all required permissions', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return ['room:read', 'room:write'];
        return undefined;
      });

      (authzService.hasAllPermissions as jest.Mock).mockResolvedValue(false);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(authzService.hasAllPermissions).toHaveBeenCalledWith(
        mockBaseSecurityContext,
        ['room:read', 'room:write'],
        expect.any(Object),
      );
    });

    it('should enforce @RequirePermissions and allow if user has all required permissions', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return ['room:read', 'room:write'];
        return undefined;
      });

      (authzService.hasAllPermissions as jest.Mock).mockResolvedValue(true);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should enforce @RequireAnyPermission and allow if user has at least one permission', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ANY_PERMISSIONS_KEY) return ['guest:view', 'guest:edit'];
        return undefined;
      });

      (authzService.hasAnyPermission as jest.Mock).mockResolvedValue(true);

      const ctx = makeMockContext({ securityContext: mockBaseSecurityContext });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should enforce @RequireScopeLevel and reject if user scope is insufficient', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === SCOPE_LEVELS_KEY) return ['GROUP'];
        if (key === ROLES_KEY) return ['AUDITOR'];
        return undefined;
      });

      (authzService.hasAnyRole as jest.Mock).mockReturnValue(true);

      // User has only PROPERTY scope (rank 2 < GROUP rank 5)
      const userWithPropertyScope: SecurityContext = {
        ...mockBaseSecurityContext,
        scopes: Object.freeze([
          Object.freeze({
            id: 's-1',
            roleId: 'r-1',
            roleCode: 'AUDITOR',
            scopeType: 'PROPERTY',
            hotelGroupId: 'group-1',
            regionId: 'r-1',
            countryId: 'c-1',
            propertyId: 'prop-1',
            departmentCode: null,
            permissions: Object.freeze([]),
          }),
        ]),
      };

      const ctx = makeMockContext({ securityContext: userWithPropertyScope });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
