import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConfigService } from '@nestjs/config';
import { parseSecurityConfig } from '@hms/config';
import { AuthorizationService } from '../../apps/api-core/src/modules/identity/application/services/authorization.service';
import { AuthorizationCacheService } from '../../apps/api-core/src/modules/identity/application/services/authorization-cache.service';
import { HierarchyValidationService } from '../../apps/api-core/src/modules/identity/application/services/hierarchy-validation.service';
import { TokenService } from '../../apps/api-core/src/modules/identity/application/services/token.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { JwtAuthGuard } from '../../apps/api-core/src/modules/identity/presentation/guards/jwt-auth.guard';
import { ScopedRbacGuard } from '../../apps/api-core/src/modules/identity/presentation/guards/scoped-rbac.guard';
import {
  Public,
  Authenticated,
  RequirePermissions,
} from '../../apps/api-core/src/modules/identity/presentation/decorators/authz.decorators';
import { FrozenSet } from '@hms/api-contracts';
import {
  ForbiddenException,
  UnauthorizedException,
  INestApplication,
  Controller,
  Get,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Controller('test-pipeline')
class TestGuardPipelineController {
  @Public()
  @Get('public')
  getPublic() {
    return { status: 'public' };
  }

  @Authenticated()
  @Get('authenticated')
  getAuthenticated() {
    return { status: 'authenticated' };
  }

  @RequirePermissions('res:write:shared')
  @Get('permission-protected')
  getPermissionProtected() {
    return { status: 'permission-granted' };
  }

  @Get('unannotated')
  getUnannotated() {
    return { status: 'unannotated' };
  }
}

describe('W1-T03 T05: Authorization, SecurityContext & RBAC Integration Tests', () => {
  jest.setTimeout(120000);

  let prisma: PrismaClient;
  let redisService: RedisService;
  let authzCacheService: AuthorizationCacheService;
  let hierarchyService: HierarchyValidationService;
  let authzService: AuthorizationService;
  let tokenService: TokenService;
  let configService: ConfigService;

  // Cleanup tracking
  const createdGroupIds: string[] = [];
  const createdRegionIds: string[] = [];
  const createdCountryIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdPermissionIds: string[] = [];
  const createdScopeIds: string[] = [];
  const createdSessionIds: string[] = [];

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Fixture IDs
  let groupAId: string;
  let groupBId: string;
  let regionA1Id: string;
  let countryA1Id: string;
  let propertyA1Id: string;
  let propertyA2Id: string;
  let propertyB1Id: string;

  let permReservationReadId: string;
  let permReservationWriteId: string;
  let permFinancialAuditId: string;
  let permRoomAssignId: string;

  let roleGroupManagerId: string;
  let roleFrontDeskId: string;
  let roleAuditorId: string;

  let testStaffUserId: string;
  let testGlobalAdminUserId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'security') return securityConfig;
        if (key === 'REDIS_HOST') return process.env.REDIS_HOST || 'localhost';
        if (key === 'REDIS_PORT') return process.env.REDIS_PORT || '6379';
        if (key === 'REDIS_PASSWORD')
          return process.env.REDIS_PASSWORD || 'hms_redis_dev_pass_2026';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    tokenService = new TokenService(configService, redisService);

    hierarchyService = new HierarchyValidationService(prisma as unknown as PrismaService);
    authzCacheService = new AuthorizationCacheService(redisService);
    authzService = new AuthorizationService(
      prisma as unknown as PrismaService,
      authzCacheService,
      hierarchyService,
    );

    // ==========================================
    // Seed Hierarchy Fixtures
    // ==========================================

    // 1. Group A and Group B
    groupAId = generateUuidV7();
    createdGroupIds.push(groupAId);
    await prisma.hotelGroup.create({
      data: {
        id: groupAId,
        code: `GA_${testSuffix}`,
        name: `Hotel Group A ${testSuffix}`,
        status: 'ACTIVE',
      },
    });

    groupBId = generateUuidV7();
    createdGroupIds.push(groupBId);
    await prisma.hotelGroup.create({
      data: {
        id: groupBId,
        code: `GB_${testSuffix}`,
        name: `Hotel Group B ${testSuffix}`,
        status: 'ACTIVE',
      },
    });

    // 2. Region A1 under Group A
    regionA1Id = generateUuidV7();
    createdRegionIds.push(regionA1Id);
    await prisma.region.create({
      data: {
        id: regionA1Id,
        hotelGroupId: groupAId,
        code: `RA1_${testSuffix}`,
        name: `Region A1 ${testSuffix}`,
        status: 'ACTIVE',
      },
    });

    // 3. Country A1 under Region A1
    countryA1Id = generateUuidV7();
    createdCountryIds.push(countryA1Id);
    await prisma.country.create({
      data: {
        id: countryA1Id,
        regionId: regionA1Id,
        code: 'US',
        name: 'United States',
        status: 'ACTIVE',
      },
    });

    // 4. Property A1 and Property A2 under Country A1 (Group A)
    propertyA1Id = generateUuidV7();
    createdPropertyIds.push(propertyA1Id);
    await prisma.property.create({
      data: {
        id: propertyA1Id,
        countryId: countryA1Id,
        code: `PA1_${testSuffix}`,
        name: `Grand Palace A1 ${testSuffix}`,
        timeZone: 'America/New_York',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    propertyA2Id = generateUuidV7();
    createdPropertyIds.push(propertyA2Id);
    await prisma.property.create({
      data: {
        id: propertyA2Id,
        countryId: countryA1Id,
        code: `PA2_${testSuffix}`,
        name: `Grand Palace A2 ${testSuffix}`,
        timeZone: 'America/New_York',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // 5. Region, Country, and Property under Group B
    const regionB1Id = generateUuidV7();
    createdRegionIds.push(regionB1Id);
    await prisma.region.create({
      data: {
        id: regionB1Id,
        hotelGroupId: groupBId,
        code: `RB1_${testSuffix}`,
        name: `Region B1 ${testSuffix}`,
        status: 'ACTIVE',
      },
    });

    const countryB1Id = generateUuidV7();
    createdCountryIds.push(countryB1Id);
    await prisma.country.create({
      data: {
        id: countryB1Id,
        regionId: regionB1Id,
        code: 'GB',
        name: 'United Kingdom',
        status: 'ACTIVE',
      },
    });

    propertyB1Id = generateUuidV7();
    createdPropertyIds.push(propertyB1Id);
    await prisma.property.create({
      data: {
        id: propertyB1Id,
        countryId: countryB1Id,
        code: `PB1_${testSuffix}`,
        name: `Royal Sovereign B1 ${testSuffix}`,
        timeZone: 'Europe/London',
        currency: 'GBP',
        status: 'ACTIVE',
      },
    });

    // ==========================================
    // Seed Permissions
    // ==========================================
    permReservationReadId = generateUuidV7();
    createdPermissionIds.push(permReservationReadId);
    await prisma.permission.create({
      data: {
        id: permReservationReadId,
        code: `res:read:${testSuffix}`,
        name: 'Read Reservations',
      },
    });

    permReservationWriteId = generateUuidV7();
    createdPermissionIds.push(permReservationWriteId);
    await prisma.permission.create({
      data: {
        id: permReservationWriteId,
        code: `res:write:${testSuffix}`,
        name: 'Write Reservations',
      },
    });

    permFinancialAuditId = generateUuidV7();
    createdPermissionIds.push(permFinancialAuditId);
    await prisma.permission.create({
      data: {
        id: permFinancialAuditId,
        code: `fin:audit:${testSuffix}`,
        name: 'Financial Audit',
      },
    });

    permRoomAssignId = generateUuidV7();
    createdPermissionIds.push(permRoomAssignId);
    await prisma.permission.create({
      data: {
        id: permRoomAssignId,
        code: `room:assign:${testSuffix}`,
        name: 'Assign Rooms',
      },
    });

    const permSharedWriteId = generateUuidV7();
    createdPermissionIds.push(permSharedWriteId);
    await prisma.permission.create({
      data: {
        id: permSharedWriteId,
        code: 'res:write:shared',
        name: 'Shared Write Permission',
      },
    });

    // ==========================================
    // Seed Roles & RolePermissions
    // ==========================================
    // Role 1: Group Manager (Group A scoped)
    roleGroupManagerId = generateUuidV7();
    createdRoleIds.push(roleGroupManagerId);
    await prisma.role.create({
      data: {
        id: roleGroupManagerId,
        code: `GM_${testSuffix}`,
        name: 'Group General Manager',
        hotelGroupId: groupAId,
        isSystem: false,
      },
    });
    await prisma.rolePermission.createMany({
      data: [
        { id: generateUuidV7(), roleId: roleGroupManagerId, permissionId: permReservationReadId },
        { id: generateUuidV7(), roleId: roleGroupManagerId, permissionId: permReservationWriteId },
        { id: generateUuidV7(), roleId: roleGroupManagerId, permissionId: permSharedWriteId },
      ],
    });

    // Role 2: Front Desk (System Role)
    roleFrontDeskId = generateUuidV7();
    createdRoleIds.push(roleFrontDeskId);
    await prisma.role.create({
      data: {
        id: roleFrontDeskId,
        code: `FD_${testSuffix}`,
        name: 'Front Desk Agent',
        isSystem: true,
      },
    });
    await prisma.rolePermission.createMany({
      data: [
        { id: generateUuidV7(), roleId: roleFrontDeskId, permissionId: permReservationReadId },
        { id: generateUuidV7(), roleId: roleFrontDeskId, permissionId: permRoomAssignId },
      ],
    });

    // Role 3: Auditor
    roleAuditorId = generateUuidV7();
    createdRoleIds.push(roleAuditorId);
    await prisma.role.create({
      data: {
        id: roleAuditorId,
        code: `AUDIT_${testSuffix}`,
        name: 'Financial Auditor',
        isSystem: true,
      },
    });
    await prisma.rolePermission.create({
      data: {
        id: generateUuidV7(),
        roleId: roleAuditorId,
        permissionId: permFinancialAuditId,
      },
    });

    // ==========================================
    // Seed Users & UserRoleScopes
    // ==========================================
    testStaffUserId = generateUuidV7();
    createdUserIds.push(testStaffUserId);
    await prisma.user.create({
      data: {
        id: testStaffUserId,
        email: `staff_${testSuffix}@example.com`,
        firstName: 'Staff',
        lastName: 'Member',
        status: 'ACTIVE',
      },
    });

    // User scope 1: Group Manager for Group A
    const scope1Id = generateUuidV7();
    createdScopeIds.push(scope1Id);
    await prisma.userRoleScope.create({
      data: {
        id: scope1Id,
        userId: testStaffUserId,
        roleId: roleGroupManagerId,
        scopeType: 'GROUP',
        hotelGroupId: groupAId,
      },
    });

    // User scope 2: Front Desk Agent specifically for Property A1
    const scope2Id = generateUuidV7();
    createdScopeIds.push(scope2Id);
    await prisma.userRoleScope.create({
      data: {
        id: scope2Id,
        userId: testStaffUserId,
        roleId: roleFrontDeskId,
        scopeType: 'PROPERTY',
        propertyId: propertyA1Id,
      },
    });

    // Global Admin User
    testGlobalAdminUserId = generateUuidV7();
    createdUserIds.push(testGlobalAdminUserId);
    await prisma.user.create({
      data: {
        id: testGlobalAdminUserId,
        email: `globaladmin_${testSuffix}@example.com`,
        firstName: 'Global',
        lastName: 'Administrator',
        status: 'ACTIVE',
      },
    });

    const globalAdminRoleId = generateUuidV7();
    createdRoleIds.push(globalAdminRoleId);
    await prisma.role.create({
      data: {
        id: globalAdminRoleId,
        code: 'GLOBAL_ADMIN',
        name: 'Enterprise Super Administrator',
        isSystem: true,
      },
    });

    const scopeGlobalId = generateUuidV7();
    createdScopeIds.push(scopeGlobalId);
    await prisma.userRoleScope.create({
      data: {
        id: scopeGlobalId,
        userId: testGlobalAdminUserId,
        roleId: globalAdminRoleId,
        scopeType: 'GLOBAL',
      },
    });
  });

  afterAll(async () => {
    try {
      // 1. Delete user role scopes
      if (createdScopeIds.length) {
        await prisma.userRoleScope.deleteMany({ where: { id: { in: createdScopeIds } } });
      }
      // 2. Delete role permissions
      if (createdRoleIds.length) {
        await prisma.rolePermission.deleteMany({ where: { roleId: { in: createdRoleIds } } });
      }
      // 3. Delete roles
      if (createdRoleIds.length) {
        await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
      }
      // 4. Delete permissions
      if (createdPermissionIds.length) {
        await prisma.permission.deleteMany({ where: { id: { in: createdPermissionIds } } });
      }
      // 5. Delete auth sessions
      if (createdSessionIds.length) {
        await prisma.authSession.deleteMany({ where: { id: { in: createdSessionIds } } });
      }
      // 6. Delete users
      if (createdUserIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      // 6. Delete properties
      if (createdPropertyIds.length) {
        await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
      }
      // 7. Delete countries
      if (createdCountryIds.length) {
        await prisma.country.deleteMany({ where: { id: { in: createdCountryIds } } });
      }
      // 8. Delete regions
      if (createdRegionIds.length) {
        await prisma.region.deleteMany({ where: { id: { in: createdRegionIds } } });
      }
      // 9. Delete hotel groups
      if (createdGroupIds.length) {
        await prisma.hotelGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
      }
    } catch {
      // Ignore cleanup error
    } finally {
      try {
        const client = redisService?.getClient();
        if (client && client.status !== 'end') {
          client.disconnect();
        }
      } catch {
        // Ignore cleanup error
      }
      try {
        await prisma.$disconnect();
      } catch {
        // Ignore cleanup error
      }
    }
  });

  describe('1. PostgreSQL SecurityContext Hydration & Immutability', () => {
    it('should hydrate an accurate, immutable SecurityContext from database', async () => {
      const sessionId = generateUuidV7();
      const context = await authzService.resolveSecurityContext(
        testStaffUserId,
        sessionId,
        { hotelGroupId: groupAId, propertyId: propertyA1Id },
        'corr-test-1',
      );

      expect(context.userId).toBe(testStaffUserId);
      expect(context.sessionId).toBe(sessionId);
      expect(context.user.email).toContain(`staff_${testSuffix}`);
      expect(context.isGlobalAdmin).toBe(false);

      // Verify roles populated
      const roleCodes = context.roles.map((r) => r.code);
      expect(roleCodes).toContain(`GM_${testSuffix}`);
      expect(roleCodes).toContain(`FD_${testSuffix}`);

      // Verify permissions populated as FrozenSet
      expect(context.permissions).toBeInstanceOf(FrozenSet);
      expect(context.permissions.has(`res:read:${testSuffix}`)).toBe(true);
      expect(context.permissions.has(`res:write:${testSuffix}`)).toBe(true);
      expect(context.permissions.has(`room:assign:${testSuffix}`)).toBe(true);
      expect(context.permissions.has(`fin:audit:${testSuffix}`)).toBe(false);

      // Verify runtime immutability
      expect(() => (context.permissions as any).add('forbidden:permission')).toThrow(TypeError);
      expect(() => ((context as any).userId = 'altered')).toThrow();
    });

    it('should throw UnauthorizedException for non-existent or inactive user', async () => {
      await expect(
        authzService.resolveSecurityContext(generateUuidV7(), generateUuidV7(), {
          hotelGroupId: groupAId,
          propertyId: null,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2. Multi-Tier Scope Dominance & Tenant Isolation', () => {
    it('Global Admin bypasses all scope checks across all hotel groups', async () => {
      const sessionId = generateUuidV7();
      const adminCtx = await authzService.resolveSecurityContext(testGlobalAdminUserId, sessionId, {
        hotelGroupId: null,
        propertyId: null,
      });

      expect(adminCtx.isGlobalAdmin).toBe(true);

      // Can access property in Group A
      const canAccessGroupA = await authzService.can(adminCtx, `res:read:${testSuffix}`, {
        propertyId: propertyA1Id,
      });
      expect(canAccessGroupA).toBe(true);

      // Can access property in Group B
      const canAccessGroupB = await authzService.can(adminCtx, `res:read:${testSuffix}`, {
        propertyId: propertyB1Id,
      });
      expect(canAccessGroupB).toBe(true);
    });

    it('GROUP scope dominates all properties under that hotel group', async () => {
      const sessionId = generateUuidV7();
      const context = await authzService.resolveSecurityContext(testStaffUserId, sessionId, {
        hotelGroupId: groupAId,
        propertyId: null,
      });

      // res:write was granted to Group Manager at GROUP level (groupAId)
      // Property A1 is under Group A -> Allowed
      const canWritePropA1 = await authzService.can(context, `res:write:${testSuffix}`, {
        propertyId: propertyA1Id,
      });
      expect(canWritePropA1).toBe(true);

      // Property A2 is also under Group A -> Allowed (dominance!)
      const canWritePropA2 = await authzService.can(context, `res:write:${testSuffix}`, {
        propertyId: propertyA2Id,
      });
      expect(canWritePropA2).toBe(true);

      // Property B1 is under Group B -> Denied (Cross-tenant boundary!)
      const canWritePropB1 = await authzService.can(context, `res:write:${testSuffix}`, {
        propertyId: propertyB1Id,
      });
      expect(canWritePropB1).toBe(false);
    });

    it('PROPERTY scope allows actions at the assigned property and denies at sibling properties', async () => {
      const sessionId = generateUuidV7();
      const context = await authzService.resolveSecurityContext(testStaffUserId, sessionId, {
        hotelGroupId: groupAId,
        propertyId: propertyA1Id,
      });

      // room:assign was granted ONLY at PROPERTY level for Property A1
      // Property A1 -> Allowed
      const canAssignA1 = await authzService.can(context, `room:assign:${testSuffix}`, {
        propertyId: propertyA1Id,
      });
      expect(canAssignA1).toBe(true);

      // Property A2 (sibling in same group) -> Denied because scope was property-specific!
      const canAssignA2 = await authzService.can(context, `room:assign:${testSuffix}`, {
        propertyId: propertyA2Id,
      });
      expect(canAssignA2).toBe(false);
    });

    it('Strictly isolates active hotel group (excludes scopes from other groups)', async () => {
      const sessionId = generateUuidV7();

      // Requesting context with Group B
      const contextGroupB = await authzService.resolveSecurityContext(testStaffUserId, sessionId, {
        hotelGroupId: groupBId,
        propertyId: null,
      });

      // Staff has no roles/scopes in Group B!
      expect(contextGroupB.roles.length).toBe(0);
      expect(contextGroupB.permissions.size).toBe(0);
      expect(contextGroupB.scopes.length).toBe(0);
    });
  });

  describe('3. Invalidate-on-Read via Redis MGET', () => {
    it('Role invalidation immediately invalidates cached SecurityContext without waiting for TTL', async () => {
      const sessionId = generateUuidV7();

      // 1. Initial resolution populates Redis cache
      const context1 = await authzService.resolveSecurityContext(testStaffUserId, sessionId, {
        hotelGroupId: groupAId,
        propertyId: propertyA1Id,
      });
      expect(context1).toBeDefined();

      // Verify cache hit
      const cachedHit = await authzCacheService.get(testStaffUserId, groupAId);
      expect(cachedHit).not.toBeNull();

      // 2. Invalidate role (simulate admin revoking/updating role permissions)
      await authzCacheService.invalidateRole(roleGroupManagerId);

      // 3. Next read MUST return null from cache (Invalidate-on-Read triggered via MGET)
      const cachedAfterRoleInvalidation = await authzCacheService.get(testStaffUserId, groupAId);
      expect(cachedAfterRoleInvalidation).toBeNull();

      // 4. Resolving again repopulates cache with new role version stamp
      const context2 = await authzService.resolveSecurityContext(testStaffUserId, sessionId, {
        hotelGroupId: groupAId,
        propertyId: propertyA1Id,
      });
      expect(context2).toBeDefined();

      // Now cache is valid again
      const cachedRepopulated = await authzCacheService.get(testStaffUserId, groupAId);
      expect(cachedRepopulated).not.toBeNull();
    });

    it('User invalidation immediately invalidates cached SecurityContext on user role assignment changes', async () => {
      // Cache is currently populated
      const cachedHit = await authzCacheService.get(testStaffUserId, groupAId);
      expect(cachedHit).not.toBeNull();

      // Invalidate user
      await authzCacheService.invalidateUser(testStaffUserId);

      // Immediate cache miss via MGET Invalidate-on-Read
      const cachedAfterUserInvalidation = await authzCacheService.get(testStaffUserId, groupAId);
      expect(cachedAfterUserInvalidation).toBeNull();
    });
  });

  describe('4. Cross-Tenant Property Access Protection', () => {
    it('throws ForbiddenException when requesting a property that does not belong to active hotel group', async () => {
      await expect(
        authzService.resolveSecurityContext(testStaffUserId, generateUuidV7(), {
          hotelGroupId: groupAId,
          propertyId: propertyB1Id, // Property B1 belongs to Group B!
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. HTTP Guard Pipeline & Deny-by-Default Rejection', () => {
    let testApp: INestApplication;
    let validStaffToken: string;

    beforeAll(async () => {
      const testSessionId = generateUuidV7();
      createdSessionIds.push(testSessionId);
      await prisma.authSession.create({
        data: {
          id: testSessionId,
          userId: testStaffUserId,
          sessionToken: generateUuidV7(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const tokenResult = await tokenService.issueAccessToken({
        userId: testStaffUserId,
        sessionId: testSessionId,
        actx: { hotelGroupId: groupAId, propertyId: propertyA1Id },
      });
      validStaffToken = tokenResult.accessToken;

      const redisServiceForTestApp = new Proxy(redisService, {
        get(target, prop, receiver) {
          if (prop === 'onModuleDestroy') {
            return () => Promise.resolve();
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [TestGuardPipelineController],
        providers: [
          { provide: ConfigService, useValue: configService },
          { provide: RedisService, useValue: redisServiceForTestApp },
          { provide: PrismaService, useValue: prisma as unknown as PrismaService },
          { provide: TokenService, useValue: tokenService },
          { provide: AuthorizationCacheService, useValue: authzCacheService },
          { provide: HierarchyValidationService, useValue: hierarchyService },
          { provide: AuthorizationService, useValue: authzService },
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: ScopedRbacGuard },
        ],
      }).compile();

      testApp = moduleFixture.createNestApplication();
      await testApp.init();
    });

    afterAll(async () => {
      if (testApp) {
        const server = testApp.getHttpServer();
        if (server) {
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
          if (server.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
          }
        }
        await testApp.close();
      }
    });

    it('@Public() endpoint should be accessible without Authorization header (HTTP 200)', async () => {
      const res = await request(testApp.getHttpServer())
        .get('/test-pipeline/public')
        .set('Connection', 'close');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('public');
    });

    it('@Authenticated() endpoint should reject unauthenticated request with HTTP 401', async () => {
      const res = await request(testApp.getHttpServer())
        .get('/test-pipeline/authenticated')
        .set('Connection', 'close');
      expect(res.status).toBe(401);
    });

    it('@Authenticated() endpoint should succeed with valid JWT Bearer token (HTTP 200)', async () => {
      const res = await request(testApp.getHttpServer())
        .get('/test-pipeline/authenticated')
        .set('Authorization', `Bearer ${validStaffToken}`)
        .set('Connection', 'close');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('authenticated');
    });

    it('@RequirePermissions() endpoint should succeed when user has required permission (HTTP 200)', async () => {
      const res = await request(testApp.getHttpServer())
        .get('/test-pipeline/permission-protected')
        .set('Authorization', `Bearer ${validStaffToken}`)
        .set('Connection', 'close');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('permission-granted');
    });

    it('Deny-by-Default: Protected endpoint lacking explicit @RequirePermissions/@RequireRoles/@Authenticated MUST be rejected with HTTP 403', async () => {
      const res = await request(testApp.getHttpServer())
        .get('/test-pipeline/unannotated')
        .set('Authorization', `Bearer ${validStaffToken}`)
        .set('Connection', 'close');
      expect(res.status).toBe(403);
      expect(res.body.type || res.body.message).toBeDefined();
    });
  });
});
