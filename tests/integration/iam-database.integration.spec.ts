import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T03 T02: IAM Contracts & Database Foundation Integration Tests', () => {
  let prisma: PrismaClient;

  const testSuffix = Date.now().toString().slice(-6);

  // Setup test organization entities
  let testGroupIdA: string;
  let testGroupIdB: string;
  let testRegionId: string;
  let testCountryId: string;
  let testPropertyId: string;

  // Track created entities for teardown
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdPermissionIds: string[] = [];
  const createdGroupIds: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    // 1. Hotel Group A
    testGroupIdA = generateUuidV7();
    await prisma.hotelGroup.create({
      data: {
        id: testGroupIdA,
        code: `HG-IAM-A-${testSuffix}`,
        name: 'IAM Test Group A',
        status: 'ACTIVE',
      },
    });
    createdGroupIds.push(testGroupIdA);

    // 2. Hotel Group B
    testGroupIdB = generateUuidV7();
    await prisma.hotelGroup.create({
      data: {
        id: testGroupIdB,
        code: `HG-IAM-B-${testSuffix}`,
        name: 'IAM Test Group B',
        status: 'ACTIVE',
      },
    });
    createdGroupIds.push(testGroupIdB);

    // 3. Region under Group A
    testRegionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: testRegionId,
        hotelGroupId: testGroupIdA,
        code: `REG-${testSuffix}`,
        name: 'IAM Test Region',
        status: 'ACTIVE',
      },
    });

    // 4. Country under Region
    testCountryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: testCountryId,
        regionId: testRegionId,
        code: `T${testSuffix.slice(-1)}`,
        name: 'IAM Test Country',
        status: 'ACTIVE',
      },
    });

    // 5. Property under Country
    testPropertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: testPropertyId,
        countryId: testCountryId,
        code: `PROP-IAM-${testSuffix}`,
        name: 'IAM Test Property',
        status: 'ACTIVE',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
      },
    });
  }, 30000);

  afterAll(async () => {
    try {
      // Clean up role scopes
      for (const userId of createdUserIds) {
        await prisma.userRoleScope.deleteMany({ where: { userId } });
        await prisma.organizationMembership.deleteMany({ where: { userId } });
        await prisma.passwordHistory.deleteMany({ where: { userId } });
        await prisma.userCredential.deleteMany({ where: { userId } });
      }

      // Clean up sessions and tokens
      for (const sessionId of createdSessionIds) {
        await prisma.refreshToken.deleteMany({ where: { sessionId } });
        await prisma.authSession.deleteMany({ where: { id: sessionId } });
      }

      // Clean up users
      for (const userId of createdUserIds) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }

      // Clean up role permissions & roles
      for (const roleId of createdRoleIds) {
        await prisma.rolePermission.deleteMany({ where: { roleId } });
        await prisma.role.deleteMany({ where: { id: roleId } });
      }

      // Clean up permissions
      for (const permissionId of createdPermissionIds) {
        await prisma.rolePermission.deleteMany({ where: { permissionId } });
        await prisma.permission.deleteMany({ where: { id: permissionId } });
      }

      // Clean up organization hierarchy
      if (testPropertyId) await prisma.property.deleteMany({ where: { id: testPropertyId } });
      if (testCountryId) await prisma.country.deleteMany({ where: { id: testCountryId } });
      if (testRegionId) await prisma.region.deleteMany({ where: { id: testRegionId } });
      for (const gId of createdGroupIds) {
        await prisma.hotelGroup.deleteMany({ where: { id: gId } });
      }
    } catch {
      // Ignore teardown errors
    }
    await prisma.$disconnect();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. User Creation
  // --------------------------------------------------------------------------
  it('1. should create a user entity with UUIDv7 and verify default fields', async () => {
    const userId = generateUuidV7();
    createdUserIds.push(userId);

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: `test.user.${testSuffix}@enterprise-hms.com`,
        firstName: 'Alexander',
        lastName: 'Hamilton',
        phone: '+1 555 0199',
        status: 'ACTIVE',
        defaultPropertyId: testPropertyId,
      },
    });

    expect(user.id).toBe(userId);
    expect(user.email).toBe(`test.user.${testSuffix}@enterprise-hms.com`);
    expect(user.firstName).toBe('Alexander');
    expect(user.lastName).toBe('Hamilton');
    expect(user.status).toBe('ACTIVE');
    expect(user.failedLoginCount).toBe(0);
    expect(user.version).toBe(1);
    expect(user.defaultPropertyId).toBe(testPropertyId);
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. Multiple Hotel Group Memberships
  // --------------------------------------------------------------------------
  it('2. should allow multiple Hotel Group memberships for one user', async () => {
    const userId = generateUuidV7();
    createdUserIds.push(userId);

    await prisma.user.create({
      data: {
        id: userId,
        email: `multi.group.${testSuffix}@enterprise-hms.com`,
        firstName: 'Multi',
        lastName: 'GroupUser',
      },
    });

    const membershipA = await prisma.organizationMembership.create({
      data: {
        id: generateUuidV7(),
        userId,
        hotelGroupId: testGroupIdA,
        isPrimary: true,
        status: 'ACTIVE',
      },
    });

    const membershipB = await prisma.organizationMembership.create({
      data: {
        id: generateUuidV7(),
        userId,
        hotelGroupId: testGroupIdB,
        isPrimary: false,
        status: 'ACTIVE',
      },
    });

    expect(membershipA.hotelGroupId).toBe(testGroupIdA);
    expect(membershipA.isPrimary).toBe(true);
    expect(membershipB.hotelGroupId).toBe(testGroupIdB);
    expect(membershipB.isPrimary).toBe(false);

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId },
    });
    expect(memberships).toHaveLength(2);
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate Membership Prevention
  // --------------------------------------------------------------------------
  it('3. should prevent duplicate active memberships for the same Hotel Group', async () => {
    const userId = createdUserIds[0];

    await prisma.organizationMembership.create({
      data: {
        id: generateUuidV7(),
        userId,
        hotelGroupId: testGroupIdA,
        isPrimary: true,
      },
    });

    await expect(
      prisma.organizationMembership.create({
        data: {
          id: generateUuidV7(),
          userId,
          hotelGroupId: testGroupIdA, // Duplicate!
          isPrimary: false,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 4. System Role Global Code Uniqueness
  // --------------------------------------------------------------------------
  it('4. should enforce global code uniqueness for system roles (hotelGroupId IS NULL)', async () => {
    const roleCode = `SYS_ROLE_${testSuffix}`;

    const role1 = await prisma.role.create({
      data: {
        id: generateUuidV7(),
        hotelGroupId: null,
        code: roleCode,
        name: 'System Role 1',
        isSystem: true,
      },
    });
    createdRoleIds.push(role1.id);

    // Duplicate system role with identical code must be rejected by PostgreSQL partial index
    await expect(
      prisma.role.create({
        data: {
          id: generateUuidV7(),
          hotelGroupId: null,
          code: roleCode,
          name: 'Duplicate System Role',
          isSystem: true,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 5. Custom Role Uniqueness Within Hotel Group
  // --------------------------------------------------------------------------
  it('5. should enforce custom role uniqueness within the same Hotel Group', async () => {
    const customCode = `CUSTOM_ROLE_${testSuffix}`;

    const role1 = await prisma.role.create({
      data: {
        id: generateUuidV7(),
        hotelGroupId: testGroupIdA,
        code: customCode,
        name: 'Custom Role Group A',
        isSystem: false,
      },
    });
    createdRoleIds.push(role1.id);

    // Duplicate custom role code within same Hotel Group must fail
    await expect(
      prisma.role.create({
        data: {
          id: generateUuidV7(),
          hotelGroupId: testGroupIdA,
          code: customCode,
          name: 'Duplicate Custom Role Group A',
          isSystem: false,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 6. Same Custom Role Code in Different Hotel Groups
  // --------------------------------------------------------------------------
  it('6. should allow the same custom role code in different Hotel Groups', async () => {
    const sharedCustomCode = `SHARED_CUSTOM_${testSuffix}`;

    const roleA = await prisma.role.create({
      data: {
        id: generateUuidV7(),
        hotelGroupId: testGroupIdA,
        code: sharedCustomCode,
        name: 'Shared Role Group A',
        isSystem: false,
      },
    });
    createdRoleIds.push(roleA.id);

    const roleB = await prisma.role.create({
      data: {
        id: generateUuidV7(),
        hotelGroupId: testGroupIdB,
        code: sharedCustomCode, // Same code, different Hotel Group!
        name: 'Shared Role Group B',
        isSystem: false,
      },
    });
    createdRoleIds.push(roleB.id);

    expect(roleA.code).toBe(roleB.code);
    expect(roleA.hotelGroupId).not.toBe(roleB.hotelGroupId);
  });

  // --------------------------------------------------------------------------
  // 6b. Role System vs Custom Consistency CHECK Constraint
  // --------------------------------------------------------------------------
  it('6b. should reject invalid system/custom role combinations via database CHECK constraint', async () => {
    // Invalid 1: isSystem = true, but hotelGroupId is populated
    await expect(
      prisma.role.create({
        data: {
          id: generateUuidV7(),
          hotelGroupId: testGroupIdA,
          code: `INVALID_SYS_${testSuffix}`,
          name: 'Invalid System Role with Group',
          isSystem: true,
        },
      }),
    ).rejects.toThrow();

    // Invalid 2: isSystem = false, but hotelGroupId is null
    await expect(
      prisma.role.create({
        data: {
          id: generateUuidV7(),
          hotelGroupId: null,
          code: `INVALID_CUSTOM_${testSuffix}`,
          name: 'Invalid Custom Role without Group',
          isSystem: false,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 7. Permission Uniqueness
  // --------------------------------------------------------------------------
  it('7. should enforce unique permission codes', async () => {
    const permCode = `test.perm.read.${testSuffix}`;

    const perm1 = await prisma.permission.create({
      data: {
        id: generateUuidV7(),
        code: permCode,
        name: 'Test Permission Read',
        module: 'TEST',
      },
    });
    createdPermissionIds.push(perm1.id);

    await expect(
      prisma.permission.create({
        data: {
          id: generateUuidV7(),
          code: permCode, // Duplicate!
          name: 'Duplicate Permission',
          module: 'TEST',
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 8. RolePermission Uniqueness
  // --------------------------------------------------------------------------
  it('8. should enforce uniqueness on RolePermission mapping', async () => {
    const roleId = createdRoleIds[0];
    const permId = createdPermissionIds[0];

    const rp = await prisma.rolePermission.create({
      data: {
        id: generateUuidV7(),
        roleId,
        permissionId: permId,
      },
    });
    expect(rp.roleId).toBe(roleId);

    // Duplicate mapping must be rejected
    await expect(
      prisma.rolePermission.create({
        data: {
          id: generateUuidV7(),
          roleId,
          permissionId: permId,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 9. Valid GLOBAL Scope
  // --------------------------------------------------------------------------
  it('9. should persist a valid GLOBAL role scope (all hierarchy fields null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'GLOBAL',
      },
    });

    expect(scope.scopeType).toBe('GLOBAL');
    expect(scope.hotelGroupId).toBeNull();
    expect(scope.regionId).toBeNull();
    expect(scope.countryId).toBeNull();
    expect(scope.propertyId).toBeNull();
    expect(scope.departmentCode).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 10. Valid GROUP Scope
  // --------------------------------------------------------------------------
  it('10. should persist a valid GROUP role scope (hotelGroupId not null, others null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'GROUP',
        hotelGroupId: testGroupIdA,
      },
    });

    expect(scope.scopeType).toBe('GROUP');
    expect(scope.hotelGroupId).toBe(testGroupIdA);
    expect(scope.regionId).toBeNull();
    expect(scope.countryId).toBeNull();
    expect(scope.propertyId).toBeNull();
    expect(scope.departmentCode).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 11. Valid REGION Scope
  // --------------------------------------------------------------------------
  it('11. should persist a valid REGION role scope (regionId not null, others null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'REGION',
        regionId: testRegionId,
      },
    });

    expect(scope.scopeType).toBe('REGION');
    expect(scope.regionId).toBe(testRegionId);
    expect(scope.hotelGroupId).toBeNull();
    expect(scope.propertyId).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 12. Valid COUNTRY Scope
  // --------------------------------------------------------------------------
  it('12. should persist a valid COUNTRY role scope (countryId not null, others null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'COUNTRY',
        countryId: testCountryId,
      },
    });

    expect(scope.scopeType).toBe('COUNTRY');
    expect(scope.countryId).toBe(testCountryId);
    expect(scope.propertyId).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 13. Valid PROPERTY Scope
  // --------------------------------------------------------------------------
  it('13. should persist a valid PROPERTY role scope (propertyId not null, others null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'PROPERTY',
        propertyId: testPropertyId,
      },
    });

    expect(scope.scopeType).toBe('PROPERTY');
    expect(scope.propertyId).toBe(testPropertyId);
    expect(scope.departmentCode).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 14. Valid DEPARTMENT Scope
  // --------------------------------------------------------------------------
  it('14. should persist a valid DEPARTMENT role scope (propertyId and departmentCode not null)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    const scope = await prisma.userRoleScope.create({
      data: {
        id: generateUuidV7(),
        userId,
        roleId,
        scopeType: 'DEPARTMENT',
        propertyId: testPropertyId,
        departmentCode: 'FRONT_OFFICE',
      },
    });

    expect(scope.scopeType).toBe('DEPARTMENT');
    expect(scope.propertyId).toBe(testPropertyId);
    expect(scope.departmentCode).toBe('FRONT_OFFICE');
  });

  // --------------------------------------------------------------------------
  // 15. Invalid Scope Field Combinations Rejected by DB
  // --------------------------------------------------------------------------
  it('15. should reject invalid scope target combinations via database CHECK constraints', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    // Invalid A: GLOBAL with a hotelGroupId
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'GLOBAL',
          hotelGroupId: testGroupIdA, // Violates GLOBAL check!
        },
      }),
    ).rejects.toThrow();

    // Invalid B: GROUP without hotelGroupId
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'GROUP',
          hotelGroupId: null, // Violates GROUP check!
        },
      }),
    ).rejects.toThrow();

    // Invalid C: PROPERTY with extra hotelGroupId
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'PROPERTY',
          propertyId: testPropertyId,
          hotelGroupId: testGroupIdA, // Violates PROPERTY check!
        },
      }),
    ).rejects.toThrow();

    // Invalid D: DEPARTMENT without departmentCode
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'DEPARTMENT',
          propertyId: testPropertyId,
          departmentCode: null, // Violates DEPARTMENT check!
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 16. Duplicate Equivalent Role-Scope Prevention
  // --------------------------------------------------------------------------
  it('16. should prevent duplicate equivalent role-scope assignments (handling PostgreSQL NULL semantics)', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    // Attempting a second GLOBAL assignment for the same user and role must fail
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'GLOBAL',
        },
      }),
    ).rejects.toThrow();

    // Attempting a second PROPERTY assignment for the same user, role, and property must fail
    await expect(
      prisma.userRoleScope.create({
        data: {
          id: generateUuidV7(),
          userId,
          roleId,
          scopeType: 'PROPERTY',
          propertyId: testPropertyId,
        },
      }),
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 17. AuthSession Creation
  // --------------------------------------------------------------------------
  it('17. should create an AuthSession record with device and client metadata', async () => {
    const userId = createdUserIds[0];
    const sessionId = generateUuidV7();
    createdSessionIds.push(sessionId);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000); // 8 hours

    const session = await prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        sessionToken: token,
        deviceInfo: 'Mozilla/5.0 iPadOS 17.4 Safari',
        ipAddress: '192.168.1.100',
        userAgent: 'EnterpriseHMS-Client/1.0',
        expiresAt,
      },
    });

    expect(session.id).toBe(sessionId);
    expect(session.userId).toBe(userId);
    expect(session.sessionToken).toBe(token);
    expect(session.deviceInfo).toContain('iPadOS');
    expect(session.revokedAt).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 18. RefreshToken Hash Persistence
  // --------------------------------------------------------------------------
  it('18. should persist secure hashed refresh token referencing auth session (never plaintext)', async () => {
    const sessionId = createdSessionIds[0];
    const tokenId = generateUuidV7();
    const tokenFamily = generateUuidV7();

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const refreshToken = await prisma.refreshToken.create({
      data: {
        id: tokenId,
        sessionId,
        tokenFamily,
        tokenHash,
        expiresAt: new Date(Date.now() + 28800 * 1000),
      },
    });

    expect(refreshToken.id).toBe(tokenId);
    expect(refreshToken.sessionId).toBe(sessionId);
    expect(refreshToken.tokenHash).toBe(tokenHash);
    expect(refreshToken.tokenHash).not.toBe(rawRefreshToken);
    expect(refreshToken.usedAt).toBeNull();
    expect(refreshToken.revokedAt).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 19. Audit Log INSERT Succeeds
  // --------------------------------------------------------------------------
  let auditLogId: string;

  it('19. should successfully insert an immutable security audit log record', async () => {
    auditLogId = generateUuidV7();
    const correlationId = generateUuidV7();

    const auditLog = await prisma.securityAuditLog.create({
      data: {
        id: auditLogId,
        actorId: createdUserIds[0],
        actorType: 'USER',
        action: 'auth.login.success',
        resourceType: 'auth_session',
        resourceId: createdSessionIds[0],
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.100',
        userAgent: 'EnterpriseHMS-Client/1.0',
        correlationId,
        details: {
          authMethod: 'password',
          mfaVerified: false,
        },
      },
    });

    expect(auditLog.id).toBe(auditLogId);
    expect(auditLog.action).toBe('auth.login.success');
    expect(auditLog.outcome).toBe('SUCCESS');
    expect(auditLog.correlationId).toBe(correlationId);
  });

  // --------------------------------------------------------------------------
  // 20. Audit Log UPDATE Fails (Database Immutability Trigger)
  // --------------------------------------------------------------------------
  it('20. should reject UPDATE on security_audit_logs via database immutability trigger', async () => {
    expect(auditLogId).toBeDefined();

    // Attempting to UPDATE any column in audit_schema.security_audit_logs must trigger exception
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "audit_schema"."security_audit_logs" SET "outcome" = 'FAILURE' WHERE "id" = '${auditLogId}'`,
      ),
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are strictly prohibited/);
  });

  // --------------------------------------------------------------------------
  // 21. Audit Log DELETE Fails (Database Immutability Trigger)
  // --------------------------------------------------------------------------
  it('21. should reject DELETE on security_audit_logs via database immutability trigger', async () => {
    expect(auditLogId).toBeDefined();

    // Attempting to DELETE from audit_schema.security_audit_logs must trigger exception
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM "audit_schema"."security_audit_logs" WHERE "id" = '${auditLogId}'`,
      ),
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are strictly prohibited/);
  });

  // --------------------------------------------------------------------------
  // 21b. Audit Log Table Privilege Restrictions
  // --------------------------------------------------------------------------
  it('21b. should verify UPDATE, DELETE, TRUNCATE privileges are not granted to PUBLIC on security_audit_logs', async () => {
    const publicGrants: Array<{ privilege_type: string }> = await prisma.$queryRawUnsafe(`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'audit_schema'
        AND table_name = 'security_audit_logs'
        AND grantee = 'PUBLIC'
        AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
    `);

    expect(publicGrants).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 22. User Credentials & Password History Persistence
  // --------------------------------------------------------------------------
  it('22. should persist separate UserCredential and PasswordHistory records', async () => {
    const userId = createdUserIds[0];
    const credentialId = generateUuidV7();
    const historyId = generateUuidV7();

    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummy_hash_for_test';

    const credential = await prisma.userCredential.create({
      data: {
        id: credentialId,
        userId,
        passwordHash: dummyHash,
        status: 'ACTIVE',
      },
    });

    expect(credential.userId).toBe(userId);
    expect(credential.passwordHash).toBe(dummyHash);

    const history = await prisma.passwordHistory.create({
      data: {
        id: historyId,
        userId,
        passwordHash: dummyHash,
      },
    });

    expect(history.userId).toBe(userId);
    expect(history.passwordHash).toBe(dummyHash);

    const historyList = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(historyList).toHaveLength(1);
  });
});
