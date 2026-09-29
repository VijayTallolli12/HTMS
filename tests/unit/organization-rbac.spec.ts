import { ScopedRbacGuard } from '../../apps/api-core/src/modules/identity/presentation/guards/scoped-rbac.guard';
import { AuthorizationService } from '../../apps/api-core/src/modules/identity/application/services/authorization.service';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { SecurityContext, FrozenSet } from '@hms/api-contracts';
import {
  CANONICAL_PERMISSIONS,
  CANONICAL_ROLE_PERMISSIONS,
} from '../../apps/api-core/src/modules/setup/application/data/iam-baseline.data';

/**
 * W4 regression: CORP_ADMIN previously received 403 "Deny By Default" on ALL
 * organization mutations because no org controller carried authorization
 * metadata and no organization.* permission existed in the baseline.
 */
describe('Organization RBAC (CORP_ADMIN org-create regression)', () => {
  const ORG_PERMS = [
    'organization.group.manage',
    'organization.region.manage',
    'organization.country.manage',
    'organization.property.manage',
    'organization.building.manage',
    'organization.floor.manage',
  ];

  const makeContext = (roleCode: string, permCodes: string[], scopeType: string): SecurityContext =>
    Object.freeze({
      userId: 'user-1',
      sessionId: 'session-1',
      correlationId: 'req-1',
      activeContext: Object.freeze({ hotelGroupId: 'group-1', propertyId: null }),
      user: Object.freeze({
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
      }),
      isGlobalAdmin: false,
      roles: Object.freeze([{ id: 'r1', code: roleCode, name: roleCode }]),
      permissions: new FrozenSet(permCodes),
      scopes: Object.freeze([
        Object.freeze({
          scopeType,
          hotelGroupId: scopeType === 'GROUP' ? 'group-1' : null,
          propertyId: null,
          permissions: Object.freeze(permCodes),
        }),
      ]),
    }) as unknown as SecurityContext;

  const rolePerms = (roleCode: string): string[] => {
    const entry = CANONICAL_ROLE_PERMISSIONS.find((r) => r.roleCode === roleCode);
    return entry ? entry.permCodes : [];
  };

  let reflector: { getAllAndOverride: jest.Mock };
  let authzService: { hasAllPermissions: jest.Mock; hasAnyRole: jest.Mock };
  let guard: ScopedRbacGuard;

  const makeContextExec = (securityContext: SecurityContext, permission: string) => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [permission];
      return undefined;
    });
    authzService.hasAllPermissions.mockImplementation((_ctx, perms: string[]) => {
      const ctxAny = securityContext as unknown as { permissions: Set<string> };
      return perms.every((p) => ctxAny.permissions.has(p));
    });
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ params: {}, securityContext }),
      }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    };
    return guard.canActivate(ctx as never);
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as { getAllAndOverride: jest.Mock };
    authzService = { hasAllPermissions: jest.fn(), hasAnyRole: jest.fn() };
    guard = new ScopedRbacGuard(
      reflector as unknown as Reflector,
      authzService as unknown as AuthorizationService,
    );
  });

  it('baseline defines the six organization.* permissions', () => {
    const codes = CANONICAL_PERMISSIONS.map((p) => p.code);
    for (const perm of ORG_PERMS) {
      expect(codes).toContain(perm);
    }
  });

  it('CORP_ADMIN holds all organization.* manage permissions', () => {
    const perms = rolePerms('CORP_ADMIN');
    for (const perm of ORG_PERMS) {
      expect(perms).toContain(perm);
    }
  });

  it('PLATFORM_OWNER holds all organization.* manage permissions', () => {
    const perms = rolePerms('PLATFORM_OWNER');
    for (const perm of ORG_PERMS) {
      expect(perms).toContain(perm);
    }
  });

  it('PROPERTY_GM holds building/floor manage but NOT group/region/country/property manage', () => {
    const perms = rolePerms('PROPERTY_GM');
    expect(perms).toContain('organization.building.manage');
    expect(perms).toContain('organization.floor.manage');
    expect(perms).not.toContain('organization.group.manage');
    expect(perms).not.toContain('organization.region.manage');
    expect(perms).not.toContain('organization.country.manage');
    expect(perms).not.toContain('organization.property.manage');
  });

  it('FNB_MANAGER and SPA_MANAGER hold no organization.* permissions', () => {
    for (const role of ['FNB_MANAGER', 'SPA_MANAGER', 'FDA', 'HK_SUPERVISOR']) {
      const perms = rolePerms(role);
      for (const perm of ORG_PERMS) {
        expect(perms).not.toContain(perm);
      }
    }
  });

  it('REGRESSION: CORP_ADMIN with GROUP scope can pass a group-manage guard check', async () => {
    const ctx = makeContext('CORP_ADMIN', rolePerms('CORP_ADMIN'), 'GROUP');
    await expect(makeContextExec(ctx, 'organization.group.manage')).resolves.toBe(true);
  });

  it('REGRESSION: PROPERTY_GM is denied organization.group.manage (403 path)', async () => {
    const ctx = makeContext('PROPERTY_GM', rolePerms('PROPERTY_GM'), 'PROPERTY');
    await expect(makeContextExec(ctx, 'organization.group.manage')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('REGRESSION: FNB_MANAGER is denied organization.property.manage (403 path)', async () => {
    const ctx = makeContext('FNB_MANAGER', rolePerms('FNB_MANAGER'), 'PROPERTY');
    await expect(makeContextExec(ctx, 'organization.property.manage')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
