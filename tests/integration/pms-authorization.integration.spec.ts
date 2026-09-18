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
import { PmsModule } from '../../apps/api-core/src/modules/pms/pms.module';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { Socket } from 'net';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T04: PMS Authorization & Scoped RBAC Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let redisService: RedisService;
  let authzCacheService: AuthorizationCacheService;
  let hierarchyService: HierarchyValidationService;
  let authzService: AuthorizationService;
  let tokenService: TokenService;
  let configService: ConfigService;
  let testApp: INestApplication;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyAId: string;
  let propertyBId: string;

  let permRoomReadId: string;
  let permRoomCreateId: string;

  let roleViewerId: string;
  let roleAdminId: string;

  let viewerUserId: string;
  let adminUserId: string;

  let viewerToken: string;

  const createdSessionIds: string[] = [];

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

    authzCacheService = new AuthorizationCacheService(redisService);
    hierarchyService = new HierarchyValidationService(prisma as unknown as PrismaService);
    authzService = new AuthorizationService(
      prisma as unknown as PrismaService,
      authzCacheService,
      hierarchyService,
    );
    tokenService = new TokenService(configService, redisService);

    // 1. Seed Organization Tree
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_AUTH_${testSuffix}`, name: 'Auth Test Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_AUTH_${testSuffix}`,
        name: 'Auth Test Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CA_${testSuffix}`.slice(0, 10),
        name: 'Auth Country',
      },
    });

    propertyAId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyAId,
        countryId,
        code: `PRP_AUTHA_${testSuffix}`,
        name: 'Auth Property A',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    propertyBId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyBId,
        countryId,
        code: `PRP_AUTHB_${testSuffix}`,
        name: 'Auth Property B',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // 2. Permissions (room:read, room:create)
    const pRead = await prisma.permission.findFirst({ where: { code: 'room:read' } });
    if (pRead) {
      permRoomReadId = pRead.id;
    } else {
      permRoomReadId = generateUuidV7();
      await prisma.permission.create({
        data: { id: permRoomReadId, code: 'room:read', name: 'Read Rooms' },
      });
    }

    const pCreate = await prisma.permission.findFirst({ where: { code: 'room:create' } });
    if (pCreate) {
      permRoomCreateId = pCreate.id;
    } else {
      permRoomCreateId = generateUuidV7();
      await prisma.permission.create({
        data: { id: permRoomCreateId, code: 'room:create', name: 'Create Rooms' },
      });
    }

    // 3. Roles
    roleViewerId = generateUuidV7();
    await prisma.role.create({
      data: {
        id: roleViewerId,
        hotelGroupId,
        code: `VIEWER_${testSuffix}`,
        name: 'PMS Viewer',
        isSystem: false,
      },
    });
    await prisma.rolePermission.create({
      data: { id: generateUuidV7(), roleId: roleViewerId, permissionId: permRoomReadId },
    });

    roleAdminId = generateUuidV7();
    await prisma.role.create({
      data: {
        id: roleAdminId,
        hotelGroupId,
        code: `ADMIN_${testSuffix}`,
        name: 'PMS Admin',
        isSystem: false,
      },
    });
    await prisma.rolePermission.createMany({
      data: [
        { id: generateUuidV7(), roleId: roleAdminId, permissionId: permRoomReadId },
        { id: generateUuidV7(), roleId: roleAdminId, permissionId: permRoomCreateId },
      ],
    });

    // 4. Users
    viewerUserId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: viewerUserId,
        defaultPropertyId: propertyAId,
        email: `viewer_${testSuffix}@example.com`,
        firstName: 'Viewer',
        lastName: 'User',
      },
    });
    await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId: viewerUserId,
        roleId: roleViewerId,
        scopeType: 'PROPERTY',
        propertyId: propertyAId,
      },
    });

    adminUserId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: adminUserId,
        defaultPropertyId: propertyAId,
        email: `admin_${testSuffix}@example.com`,
        firstName: 'Admin',
        lastName: 'User',
      },
    });
    await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        roleId: roleAdminId,
        scopeType: 'PROPERTY',
        propertyId: propertyAId,
      },
    });

    // 5. Sessions & Access Tokens
    const viewerSessionId = generateUuidV7();
    createdSessionIds.push(viewerSessionId);
    await prisma.authSession.create({
      data: {
        id: viewerSessionId,
        userId: viewerUserId,
        sessionToken: generateUuidV7(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const viewerTokenRes = await tokenService.issueAccessToken({
      userId: viewerUserId,
      sessionId: viewerSessionId,
      actx: { hotelGroupId, propertyId: propertyAId },
    });
    viewerToken = viewerTokenRes.accessToken;

    const adminSessionId = generateUuidV7();
    createdSessionIds.push(adminSessionId);
    await prisma.authSession.create({
      data: {
        id: adminSessionId,
        userId: adminUserId,
        sessionToken: generateUuidV7(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await tokenService.issueAccessToken({
      userId: adminUserId,
      sessionId: adminSessionId,
      actx: { hotelGroupId, propertyId: propertyAId },
    });

    // 6. Bootstrap Test App
    const redisServiceForTestApp = new Proxy(redisService, {
      get(target, prop, receiver) {
        if (prop === 'onModuleInit' || prop === 'onModuleDestroy') {
          return () => Promise.resolve();
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PmsModule],
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
    })
      .overrideProvider(PrismaService)
      .useValue(prisma as unknown as PrismaService)
      .compile();

    testApp = moduleFixture.createNestApplication();
    await testApp.init();
  });

  afterAll(async () => {
    try {
      if (testApp) {
        await testApp.close();
      }
      if (createdSessionIds.length > 0) {
        await prisma.authSession.deleteMany({ where: { id: { in: createdSessionIds } } });
      }
      const userIds = [viewerUserId, adminUserId].filter(Boolean) as string[];
      if (userIds.length > 0) {
        await prisma.userRoleScope.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      const roleIds = [roleViewerId, roleAdminId].filter(Boolean) as string[];
      if (roleIds.length > 0) {
        await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
        await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      }
      const propIds = [propertyAId, propertyBId].filter(Boolean) as string[];
      if (propIds.length > 0) {
        await prisma.property.deleteMany({ where: { id: { in: propIds } } });
      }
      if (countryId) await prisma.country.deleteMany({ where: { id: countryId } });
      if (regionId) await prisma.region.deleteMany({ where: { id: regionId } });
      if (hotelGroupId) await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      try {
        const client = redisService?.getClient();
        if (client) {
          const stream = ((client as any).connector?.stream || (client as any).stream) as
            | Socket
            | undefined;
          client.disconnect(false);
          if (stream && !stream.destroyed && typeof stream.destroy === 'function') {
            stream.destroy();
          }
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

  it('1. should reject unauthenticated request with HTTP 401', async () => {
    const res = await request(testApp.getHttpServer())
      .get(`/properties/${propertyAId}/pms/rooms`)
      .set('Connection', 'close');

    expect(res.status).toBe(401);
  });

  it('2. should permit authorized request with room:read permission and matching property context (HTTP 200)', async () => {
    const res = await request(testApp.getHttpServer())
      .get(`/properties/${propertyAId}/pms/rooms`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-property-id', propertyAId)
      .set('Connection', 'close');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('3. should reject request when user has room:read but endpoint requires room:create with HTTP 403', async () => {
    const res = await request(testApp.getHttpServer())
      .post(`/properties/${propertyAId}/pms/rooms`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-property-id', propertyAId)
      .send({
        buildingId: generateUuidV7(),
        floorId: generateUuidV7(),
        roomTypeId: generateUuidV7(),
        roomNumber: '101',
      })
      .set('Connection', 'close');

    expect(res.status).toBe(403);
  });

  it('4. should reject request when accessing Property B while user is only scoped to Property A with HTTP 403', async () => {
    const res = await request(testApp.getHttpServer())
      .get(`/properties/${propertyBId}/pms/rooms`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-property-id', propertyBId)
      .set('Connection', 'close');

    expect(res.status).toBe(403);
  });
});
