import { SystemResetService } from '../../apps/api-core/src/modules/setup/application/services/system-reset.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { SetupStateService } from '../../apps/api-core/src/modules/setup/application/services/setup-state.service';
import { SecurityAuditSink } from '../../apps/api-core/src/modules/setup/infrastructure/security-audit.sink';
import { generateUuidV7 } from '@hms/shared';
import { SETUP_STATES } from '../../apps/api-core/src/modules/setup/domain/setup.constants';
import { ConfigService } from '@nestjs/config';

describe('SystemResetService (W3 Owner Reset)', () => {
  let service: SystemResetService;
  let prismaMock: any;
  let setupStateMock: any;
  let auditMock: any;
  let redisMock: any;
  let configMock: any;

  const makeProperty = (overrides: any = {}) => ({
    id: generateUuidV7(),
    code: 'PROP-001',
    name: 'Test Property',
    hotelGroupId: generateUuidV7(),
    countryId: generateUuidV7(),
    ...overrides,
  });

  const makeUser = (overrides: any = {}) => ({
    id: generateUuidV7(),
    email: 'test@example.com',
    ...overrides,
  });

  beforeEach(() => {
    prismaMock = {
      property: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      hotelGroup: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
      region: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      country: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      userRoleScope: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      userCredential: {
        deleteMany: jest.fn(),
      },
      passwordHistory: {
        deleteMany: jest.fn(),
      },
      organizationMembership: {
        deleteMany: jest.fn(),
      },
      authSession: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      refreshToken: {
        deleteMany: jest.fn(),
      },
      setupState: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      // Child tables for property deletion
      payment: { deleteMany: jest.fn() },
      folioTransaction: { deleteMany: jest.fn() },
      paymentIntent: { deleteMany: jest.fn() },
      paymentGatewayTransaction: { deleteMany: jest.fn() },
      paymentWebhook: { deleteMany: jest.fn() },
      folio: { deleteMany: jest.fn() },
      reservationRateNight: { deleteMany: jest.fn() },
      reservation: { deleteMany: jest.fn() },
      housekeepingTask: { deleteMany: jest.fn() },
      roomStatusLog: { deleteMany: jest.fn() },
      reservationAssignmentLog: { deleteMany: jest.fn() },
      roomMaintenanceBlock: { deleteMany: jest.fn() },
      workOrder: { deleteMany: jest.fn() },
      maintenanceSchedule: { deleteMany: jest.fn() },
      asset: { deleteMany: jest.fn() },
      spaAppointment: { deleteMany: jest.fn() },
      spaTherapist: { deleteMany: jest.fn() },
      spaRoom: { deleteMany: jest.fn() },
      spaServiceAddon: { deleteMany: jest.fn() },
      spaService: { deleteMany: jest.fn() },
      spaServiceCategory: { deleteMany: jest.fn() },
      eventBooking: { deleteMany: jest.fn() },
      eventResource: { deleteMany: jest.fn() },
      eventPackage: { deleteMany: jest.fn() },
      eventVenue: { deleteMany: jest.fn() },
      loyaltyTransaction: { deleteMany: jest.fn() },
      loyaltyMembership: { deleteMany: jest.fn() },
      guestPreference: { deleteMany: jest.fn() },
      guestCrmProfile: { deleteMany: jest.fn() },
      guest: { deleteMany: jest.fn() },
      fnbOrderItem: { deleteMany: jest.fn() },
      fnbOrder: { deleteMany: jest.fn() },
      fnbMenuItemVariant: { deleteMany: jest.fn() },
      fnbMenuItem: { deleteMany: jest.fn() },
      fnbMenuCategory: { deleteMany: jest.fn() },
      restaurantTable: { deleteMany: jest.fn() },
      fnbOutlet: { deleteMany: jest.fn() },
      payrollLine: { deleteMany: jest.fn() },
      payrollRun: { deleteMany: jest.fn() },
      payrollPeriod: { deleteMany: jest.fn() },
      employeeCompensation: { deleteMany: jest.fn() },
      employee: { deleteMany: jest.fn() },
      stockBalance: { deleteMany: jest.fn() },
      goodsReceipt: { deleteMany: jest.fn() },
      purchaseOrderItem: { deleteMany: jest.fn() },
      purchaseOrder: { deleteMany: jest.fn() },
      inventoryItem: { deleteMany: jest.fn() },
      supplier: { deleteMany: jest.fn() },
      dailyRate: { deleteMany: jest.fn() },
      dailyInventory: { deleteMany: jest.fn() },
      ratePlanRoomType: { deleteMany: jest.fn() },
      ratePlan: { deleteMany: jest.fn() },
      room: { deleteMany: jest.fn() },
      roomType: { deleteMany: jest.fn() },
      propertyBusinessDate: { deleteMany: jest.fn() },
      nightAuditRun: { deleteMany: jest.fn() },
      floor: { deleteMany: jest.fn() },
      building: { deleteMany: jest.fn() },
      integration: { deleteMany: jest.fn() },
      integrationSyncLog: { deleteMany: jest.fn() },
      channelConfig: { deleteMany: jest.fn() },
      channelSyncLog: { deleteMany: jest.fn() },
      paymentProviderConfig: { deleteMany: jest.fn() },
      emailProviderConfig: { deleteMany: jest.fn() },
      emailTemplate: { deleteMany: jest.fn() },
      email: { deleteMany: jest.fn() },
      emailWebhook: { deleteMany: jest.fn() },
      whatsAppProviderConfig: { deleteMany: jest.fn() },
      whatsAppTemplate: { deleteMany: jest.fn() },
      whatsAppMessage: { deleteMany: jest.fn() },
      whatsAppWebhook: { deleteMany: jest.fn() },
      competitorSet: { deleteMany: jest.fn() },
      marketRateProvider: { deleteMany: jest.fn() },
    };

    setupStateMock = {
      getStatus: jest.fn(),
      setState: jest.fn(),
      getRow: jest.fn(),
    };

    auditMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    redisMock = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    configMock = {
      get: jest.fn().mockReturnValue(undefined),
    };

    service = new SystemResetService(
      prismaMock as unknown as PrismaService,
      setupStateMock as unknown as SetupStateService,
      auditMock as unknown as SecurityAuditSink,
      redisMock as unknown as RedisService,
      configMock as unknown as ConfigService,
    );
  });

const ctx = {
  userId: generateUuidV7(),
  ip: '127.0.0.1',
  correlationId: 'test-correlation',
  userAgent: 'test-agent',
};

function setupDefaultMocks() {
  // Default mock for userRoleScope.findMany (GLOBAL scope users)
  prismaMock.userRoleScope.findMany.mockResolvedValue([]);
  // Default mock for authSession.findMany (session ids to fast-revoke)
  prismaMock.authSession.findMany.mockResolvedValue([]);
  // Default ledger row (no stale milestones)
  setupStateMock.getRow.mockResolvedValue(null);
  // Default mock for user.findMany
  prismaMock.user.findMany.mockResolvedValue([]);
  // Default mock for property.count
  prismaMock.property.count.mockResolvedValue(0);
  // All child table deleteMany return 0
  Object.values(prismaMock).forEach((model: any) => {
    if (model.deleteMany) {
      model.deleteMany.mockResolvedValue({ count: 0 });
    }
  });
  prismaMock.hotelGroup.delete.mockResolvedValue({});
}

it('rejects invalid confirmation phrase', async () => {
    await expect(service.reset(ctx, 'WRONG PHRASE')).rejects.toThrow(
      'Invalid confirmation phrase.',
    );
    // Must NOT leak the expected phrase in the error message
    await expect(service.reset(ctx, 'WRONG PHRASE')).rejects.not.toThrow(/RESET INSTALLATION/);
    expect(auditMock.record).not.toHaveBeenCalled();
  });

  it('rejects empty confirmation phrase', async () => {
    await expect(service.reset(ctx, '')).rejects.toThrow(
      'Invalid confirmation phrase.',
    );
  });

  it('rejects case-sensitive wrong phrase', async () => {
    await expect(service.reset(ctx, 'reset installation')).rejects.toThrow(
      'Invalid confirmation phrase.',
    );
  });

  it('resets successfully with correct confirmation phrase', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    const counts = await service.reset(ctx, 'RESET INSTALLATION');

    expect(setupStateMock.setState).toHaveBeenCalledWith(SETUP_STATES.NOT_INITIALIZED, null);
    expect(auditMock.record).toHaveBeenCalledTimes(2); // STARTED + COMPLETED
    expect(counts).toBeDefined();
  });

  it('preserves users with GLOBAL scope roles', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    const globalUser = makeUser({ id: 'global-user-1' });
    const installUser = makeUser({ id: 'install-user-1' });

    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    prismaMock.userRoleScope.findMany.mockResolvedValue([{ userId: 'global-user-1' }]);
    prismaMock.user.findMany.mockResolvedValue([globalUser, installUser]);
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 2, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    await service.reset(ctx, 'RESET INSTALLATION');

    // Only installation user should be deleted
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['install-user-1'] } },
    });
    // Global user should NOT be in the delete list
    const deleteCalls = prismaMock.user.deleteMany.mock.calls;
    expect(deleteCalls.some((c: any) => c[0].where.id.in.includes('global-user-1'))).toBe(false);
  });

  it('records audit on failure', async () => {
    prismaMock.property.findMany.mockRejectedValue(new Error('DB error'));
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: null,
      propertyId: null,
      milestones: [],
      counts: { properties: 0, users: 0, rooms: 0, ratePlans: 0, roomTypes: 0 },
    });

    await expect(service.reset(ctx, 'RESET INSTALLATION')).rejects.toThrow('DB error');

    expect(auditMock.record).toHaveBeenCalledTimes(2); // STARTED + FAILED
    const failureCall = auditMock.record.mock.calls[1];
    expect(failureCall[0].outcome).toBe('FAILURE');
    expect(failureCall[0].details.phase).toBe('FAILED');
  });

  it('deletes property-scoped data in correct order (child-first)', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    const deleteOrder: string[] = [];
    Object.entries(prismaMock).forEach(([key, model]: any) => {
      if (model.deleteMany) {
        model.deleteMany.mockImplementation(async () => {
          deleteOrder.push(key);
          return { count: 0 };
        });
      }
    });
    prismaMock.hotelGroup.delete.mockResolvedValue({});

    await service.reset(ctx, 'RESET INSTALLATION');

    // Verify child tables are deleted before parent tables
    const paymentIdx = deleteOrder.indexOf('payment');
    const folioIdx = deleteOrder.indexOf('folioTransaction');
    const reservationIdx = deleteOrder.indexOf('reservation');
    const roomIdx = deleteOrder.indexOf('room');
    const roomTypeIdx = deleteOrder.indexOf('roomType');
    const propertyIdx = deleteOrder.indexOf('property');

    expect(paymentIdx).toBeLessThan(folioIdx);
    expect(folioIdx).toBeLessThan(propertyIdx);
    expect(reservationIdx).toBeLessThan(propertyIdx);
    expect(roomIdx).toBeLessThan(propertyIdx);
    expect(roomTypeIdx).toBeLessThan(propertyIdx);
  });

  it('handles empty installation (no properties)', async () => {
    setupDefaultMocks();
    prismaMock.property.findMany.mockResolvedValue([]);
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.NOT_INITIALIZED,
      hotelGroupId: null,
      propertyId: null,
      milestones: [],
      counts: { properties: 0, users: 0, rooms: 0, ratePlans: 0, roomTypes: 0 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    const counts = await service.reset(ctx, 'RESET INSTALLATION');

    expect(setupStateMock.setState).toHaveBeenCalledWith(SETUP_STATES.NOT_INITIALIZED, null);
    // Normal flow handles the empty installation: no rows existed to delete.
    expect(counts.property).toBe(0);
    expect(auditMock.record.mock.calls.some((c: any) => c[0].outcome === 'SUCCESS' && c[0].details?.phase === 'COMPLETED')).toBe(true);
  });

  it('deletes empty organization hierarchy', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    const group = { id: prop.hotelGroupId, code: 'HG-001' };
    const region = { id: generateUuidV7(), hotelGroupId: group.id };
    const country = { id: generateUuidV7(), regionId: region.id };

    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([group]);
    prismaMock.region.findMany.mockResolvedValue([region]);
    prismaMock.country.findMany
      .mockResolvedValueOnce([country]) // for region
      .mockResolvedValueOnce([{ id: country.id }]); // for group check
    prismaMock.property.count.mockResolvedValue(0); // no remaining properties
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    const counts = await service.reset(ctx, 'RESET INSTALLATION');

    expect(prismaMock.hotelGroup.delete).toHaveBeenCalled();
    expect(counts.hotelGroup).toBe(1);
  });

  it('fast-revokes deleted installation sessions in Redis', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'install-user-1' }]);
    prismaMock.authSession.findMany.mockResolvedValue([{ id: 'sess-1' }, { id: 'sess-2' }]);
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    await service.reset(ctx, 'RESET INSTALLATION');

    expect(redisMock.set).toHaveBeenCalledTimes(2);
    expect(redisMock.set.mock.calls.every((c: any) => c[0].startsWith('revoked:session:'))).toBe(true);
    expect(redisMock.set.mock.calls.map((c: any) => c[0])).toEqual(
      expect.arrayContaining(['revoked:session:sess-1', 'revoked:session:sess-2']),
    );
  });

  it('clears stale COMPLETED milestone so derived status cannot re-derive ACTIVE', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    setupStateMock.getRow.mockResolvedValue({
      id: 'row-1',
      version: 7,
      milestones: ['PROPERTY_CREATED', 'ADMIN_CREATED', 'COMPLETED'],
    });
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    await service.reset(ctx, 'RESET INSTALLATION');

    expect(prismaMock.setupState.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'row-1', version: 7 } }),
    );
    const updateArg = prismaMock.setupState.update.mock.calls[0][0];
    expect(updateArg.data.milestones).toEqual([]);
  });

  it('continues reset when Redis revocation fails (revocation is best-effort)', async () => {
    setupDefaultMocks();
    const prop = makeProperty();
    prismaMock.property.findMany.mockResolvedValue([prop]);
    prismaMock.property.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.hotelGroup.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'install-user-1' }]);
    prismaMock.authSession.findMany.mockResolvedValue([{ id: 'sess-x' }]);
    redisMock.set.mockRejectedValueOnce(new Error('redis down'));
    setupStateMock.getStatus.mockResolvedValue({
      state: SETUP_STATES.ACTIVE,
      hotelGroupId: prop.hotelGroupId,
      propertyId: prop.id,
      milestones: ['COMPLETED'],
      counts: { properties: 1, users: 1, rooms: 10, ratePlans: 3, roomTypes: 5 },
    });
    setupStateMock.setState.mockResolvedValue(undefined);

    const counts = await service.reset(ctx, 'RESET INSTALLATION');

    expect(redisMock.set).toHaveBeenCalledWith('revoked:session:sess-x', 'revoked', 'EX', expect.any(Number));
    expect(counts.property).toBe(1);
    expect(setupStateMock.setState).toHaveBeenCalledWith(SETUP_STATES.NOT_INITIALIZED, null);
    expect(auditMock.record.mock.calls.some((c: any) => c[0].outcome === 'SUCCESS')).toBe(true);
  });
});