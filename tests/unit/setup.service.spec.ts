import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { SetupService } from '../../apps/api-core/src/modules/setup/application/services/setup.service';
import { DemoDataService } from '../../apps/api-core/src/modules/setup/application/services/demo-data.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { CredentialService } from '../../apps/api-core/src/modules/identity/application/services/credential.service';
import { PasswordPolicyService } from '../../apps/api-core/src/modules/identity/application/services/password-policy.service';
import { AuthThrottleService } from '../../apps/api-core/src/modules/identity/application/services/auth-throttle.service';
import { SecurityAuditSink } from '../../apps/api-core/src/modules/setup/infrastructure/security-audit.sink';

describe('SetupService — bootstrap & guards (W2 Phase 3)', () => {
  let service: SetupService;
  let prismaMock: any;
  let credentialMock: any;
  let policyMock: any;
  let throttleMock: any;
  let auditSink: SecurityAuditSink;
  let auditSpy: jest.SpyInstance;

  const ctx = { ip: '127.0.0.1', correlationId: 'corr-1' };

  beforeEach(() => {
    prismaMock = {
      role: { findFirst: jest.fn() },
      user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      userCredential: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), count: jest.fn() },
      organizationMembership: { create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      userRoleScope: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      hotelGroup: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() },
      property: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() },
      setupState: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prismaMock)),
    };
    credentialMock = { createCredential: jest.fn().mockResolvedValue({ id: 'cred-1' }), verifyCredential: jest.fn() };
    policyMock = { assertValidAndNotBreached: jest.fn().mockResolvedValue(undefined) };
    throttleMock = {
      assertNotThrottled: jest.fn().mockResolvedValue(undefined),
      recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
      resetAccountThrottle: jest.fn().mockResolvedValue(undefined),
    };
    auditSink = new SecurityAuditSink(prismaMock as unknown as PrismaService);
    auditSpy = jest.spyOn(auditSink, 'record').mockResolvedValue(undefined);

    service = new SetupService(
      prismaMock as unknown as PrismaService,
      credentialMock as unknown as CredentialService,
      policyMock as unknown as PasswordPolicyService,
      throttleMock as unknown as AuthThrottleService,
      {} as any, // hotelGroupService — unused in bootstrap paths tested here
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        ensureBaseline: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        countCredentialedUsers: jest.fn().mockResolvedValue(0),
        ensureSetupRow: jest.fn().mockResolvedValue({ id: 'row-1', state: 'NOT_INITIALIZED', milestones: [], version: 0 }),
        addMilestone: jest.fn().mockResolvedValue(undefined),
        tryBeginInitialization: jest.fn().mockResolvedValue(true),
        setState: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          state: 'INITIALIZING',
          milestones: ['ADMIN_CREATED', 'PROPERTY_CREATED'],
          progress: 28,
          bootstrapEligible: false,
        }),
      } as any,
      auditSink,
    );
  });

  it('creates the first admin with PROPERTY_GM @ PROPERTY for INDEPENDENT hotels', async () => {
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-gm', code: 'PROPERTY_GM' });
    prismaMock.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
    prismaMock.userRoleScope.create.mockResolvedValue({});
    prismaMock.userCredential.count.mockResolvedValue(0);

    const result = await service.bootstrapAdmin(
      { email: 'a@B.co', password: 'Str0ngPassphrase!', firstName: 'A', lastName: 'B', organizationType: 'INDEPENDENT' },
      ctx,
    );

    expect(result.roleCode).toBe('PROPERTY_GM');
    expect(result.scopeType).toBe('PROPERTY');
    expect(result.idempotentReplay).toBe(false);
    expect(credentialMock.createCredential).toHaveBeenCalledWith('u1', 'Str0ngPassphrase!', expect.anything());
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'SETUP_ADMIN_CREATED' }));
  });

  it('never sets hotelGroupId on PROPERTY-scoped rows (chk_user_role_scope_valid_combinations regression)', async () => {
    // Regression: virgin-DB validation exposed a 500 — the PROPERTY-scope row
    // for INDEPENDENT admins carried hotelGroupId, violating the IAM check
    // constraint (PROPERTY scope requires hotel_group_id IS NULL).
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-gm', code: 'PROPERTY_GM' });
    prismaMock.hotelGroup.findFirst.mockResolvedValue({ id: 'hg-1', code: 'W2IND' });
    prismaMock.property.findFirst.mockResolvedValue({ id: 'prop-1', code: 'PROP-1' });
    prismaMock.user.create.mockResolvedValue({ id: 'u3', email: 'g@h.co' });
    prismaMock.userRoleScope.create.mockResolvedValue({});
    prismaMock.userCredential.count.mockResolvedValue(0);

    await service.bootstrapAdmin(
      { email: 'g@h.co', password: 'Str0ngPassphrase!', firstName: 'G', lastName: 'H', organizationType: 'INDEPENDENT' },
      ctx,
    );

    const scopeData = (prismaMock.userRoleScope.create as jest.Mock).mock.calls[0][0].data;
    expect(scopeData).toEqual(expect.objectContaining({ scopeType: 'PROPERTY', propertyId: 'prop-1' }));
    expect(Object.keys(scopeData)).not.toContain('hotelGroupId');
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u3' }, data: { defaultPropertyId: 'prop-1' } });
  });

  it('sets hotelGroupId only on GROUP-scoped rows for CHAIN organizations', async () => {
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-ca', code: 'CORP_ADMIN' });
    prismaMock.hotelGroup.findFirst.mockResolvedValue({ id: 'hg-2', code: 'W2CHN' });
    prismaMock.property.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u4', email: 'i@j.co' });
    prismaMock.userRoleScope.create.mockResolvedValue({});
    prismaMock.userCredential.count.mockResolvedValue(0);

    await service.bootstrapAdmin(
      { email: 'i@j.co', password: 'Str0ngPassphrase!', firstName: 'I', lastName: 'J', organizationType: 'CHAIN' },
      ctx,
    );

    expect(prismaMock.userRoleScope.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scopeType: 'GROUP', hotelGroupId: 'hg-2' }),
    });
  });

  it('assigns CORP_ADMIN @ GROUP for CHAIN organizations', async () => {
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-ca', code: 'CORP_ADMIN' });
    prismaMock.user.create.mockResolvedValue({ id: 'u2', email: 'c@d.co' });
    prismaMock.userRoleScope.create.mockResolvedValue({});
    prismaMock.userCredential.count.mockResolvedValue(0);

    const result = await service.bootstrapAdmin(
      { email: 'c@d.co', password: 'Str0ngPassphrase!', firstName: 'C', lastName: 'D', organizationType: 'CHAIN' },
      ctx,
    );

    expect(result.roleCode).toBe('CORP_ADMIN');
    expect(result.scopeType).toBe('GROUP');
  });

  it('rejects bootstrap once any credentialed user exists (window closed)', async () => {
    (service as any).setupStateService.countCredentialedUsers.mockResolvedValue(3);

    await expect(
      service.bootstrapAdmin(
        { email: 'x@y.co', password: 'Str0ngPassphrase!', firstName: 'X', lastName: 'Y' },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('is idempotent for identical email + password (replay returns existing admin)', async () => {
    prismaMock.userCredential.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
    credentialMock.verifyCredential.mockResolvedValue(true);
    prismaMock.userRoleScope.findFirst.mockResolvedValue({
      scopeType: 'PROPERTY',
      role: { code: 'PROPERTY_GM' },
    });

    const result = await service.bootstrapAdmin(
      { email: 'a@b.co', password: 'Str0ngPassphrase!', firstName: 'A', lastName: 'B' },
      ctx,
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.userId).toBe('u1');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('conflicts when the email exists with a different password', async () => {
    prismaMock.userCredential.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
    credentialMock.verifyCredential.mockResolvedValue(false);

    await expect(
      service.bootstrapAdmin(
        { email: 'a@b.co', password: 'DifferentPass123!', firstName: 'A', lastName: 'B' },
        ctx,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('complete() requires authenticated caller', async () => {
    (service as any).setupStateService.countCredentialedUsers.mockResolvedValue(1);

    await expect(service.complete({ ...ctx })).rejects.toThrow(ForbiddenException);
  });

  it('complete() enforces required milestones before activation', async () => {
    (service as any).setupStateService.countCredentialedUsers.mockResolvedValue(1);
    (service as any).setupStateService.getStatus.mockResolvedValue({
      state: 'INITIALIZING',
      milestones: ['ADMIN_CREATED'],
      progress: 14,
    });
    prismaMock.userRoleScope.findFirst.mockResolvedValue({ id: 'scope-1' });
    prismaMock.setupState.findFirst.mockResolvedValue({ id: 'row-1', milestones: ['ADMIN_CREATED'], version: 2 });

    await expect(
      service.complete({ userId: 'u1', ...ctx }),
    ).rejects.toThrow(BadRequestException);
  });

  it('org/property writes are forbidden post-setup for unauthenticated callers', async () => {
    (service as any).setupStateService.countCredentialedUsers.mockResolvedValue(2);

    await expect(
      service.setupOrganization(
        { type: 'INDEPENDENT', code: 'HG-X', name: 'X', countryCode: 'JP' } as any,
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('DemoDataService — removal safety (W2 Phase 13)', () => {
  let service: DemoDataService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(() => {
    prismaMock = {
      hotelGroup: { findUnique: jest.fn() },
      property: { findUnique: jest.fn(), count: jest.fn() },
      region: { findMany: jest.fn().mockResolvedValue([]) },
      country: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      securityAuditLog: { create: jest.fn() },
    };
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    service = new DemoDataService(prismaMock as unknown as PrismaService, auditMock);
  });

  const ctx = { userId: 'admin-1', ip: '127.0.0.1' };

  it('remove() refuses when canonical demo data is absent', async () => {
    prismaMock.hotelGroup.findUnique.mockResolvedValue(null);

    await expect(service.remove(ctx)).rejects.toThrow('Canonical demo data');
  });

  it('remove() refuses when non-demo properties exist (isolation guard)', async () => {
    prismaMock.hotelGroup.findUnique.mockResolvedValue({ id: 'g1', code: 'HG-GLR' });
    prismaMock.property.findUnique.mockResolvedValue({ id: 'p1', code: 'PROP-TYO-001' });
    prismaMock.property.count.mockResolvedValue(3);

    await expect(service.remove(ctx)).rejects.toThrow('non-demo properties');
  });

  it('reset() requires demo data to be present', async () => {
    prismaMock.hotelGroup.findUnique.mockResolvedValue(null);

    await expect(service.reset(ctx)).rejects.toThrow('Canonical demo data');
  });
});
