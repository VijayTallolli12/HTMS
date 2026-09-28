import { SetupStateService } from '../../apps/api-core/src/modules/setup/application/services/setup-state.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

describe('SetupStateService (W2 Phase 2)', () => {
  let service: SetupStateService;
  let prismaMock: any;
  const rowId = generateUuidV7();

  beforeEach(() => {
    prismaMock = {
      setupState: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userCredential: { count: jest.fn().mockResolvedValue(0) },
      property: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      hotelGroup: { findFirst: jest.fn().mockResolvedValue(null) },
      roomType: { count: jest.fn().mockResolvedValue(0) },
      room: { count: jest.fn().mockResolvedValue(0) },
      ratePlan: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new SetupStateService(prismaMock as unknown as PrismaService);
  });

  it('reports NOT_INITIALIZED with zero progress on a virgin database', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue(null);

    const status = await service.getStatus();

    expect(status.state).toBe('NOT_INITIALIZED');
    expect(status.milestones).toEqual([]);
    expect(status.progress).toBe(0);
    expect(status.bootstrapEligible).toBe(true);
    expect(status.counts).toEqual({ properties: 0, roomTypes: 0, rooms: 0, ratePlans: 0, users: 0 });
  });

  it('is bootstrapEligible ONLY with zero active credentialed users', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue(null);
    prismaMock.userCredential.count.mockResolvedValue(2);

    const status = await service.getStatus();
    expect(status.bootstrapEligible).toBe(false);
  });

  it('derived-on-read heals a stale ledger missing ADMIN_CREATED', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue({
      id: rowId,
      state: 'NOT_INITIALIZED',
      milestones: [],
      version: 0,
    });
    prismaMock.userCredential.count.mockResolvedValue(1);

    const status = await service.getStatus();
    expect(status.milestones).toContain('ADMIN_CREATED');
    expect(status.derived).toBe(true);
  });

  it('derived-on-read heals false ADMIN_CREATED when credentials vanish', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue({
      id: rowId,
      state: 'INITIALIZING',
      milestones: ['ADMIN_CREATED'],
      version: 3,
    });
    prismaMock.userCredential.count.mockResolvedValue(0);

    const status = await service.getStatus();
    expect(status.milestones).not.toContain('ADMIN_CREATED');
    expect(status.derived).toBe(true);
  });

  it('legacy seeded database (rooms + rates + users, no ledger) derives ACTIVE', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue(null);
    prismaMock.property.count.mockResolvedValue(1);
    prismaMock.property.findFirst.mockResolvedValue({ id: 'prop-1' });
    prismaMock.room.count.mockResolvedValue(12);
    prismaMock.ratePlan.count.mockResolvedValue(3);
    prismaMock.userCredential.count.mockResolvedValue(7);

    const status = await service.getStatus();

    expect(status.state).toBe('ACTIVE');
    expect(status.derived).toBe(true);
  });

  it('property + admin but no rooms/rates stays in setup mode (not ACTIVE)', async () => {
    prismaMock.setupState.findFirst.mockResolvedValue({
      id: rowId,
      state: 'INITIALIZING',
      milestones: ['ADMIN_CREATED', 'PROPERTY_CREATED'],
      version: 5,
    });
    prismaMock.property.count.mockResolvedValue(1);
    prismaMock.property.findFirst.mockResolvedValue({ id: 'prop-1' });
    prismaMock.userCredential.count.mockResolvedValue(1);

    const status = await service.getStatus();

    expect(status.state).toBe('INITIALIZING');
    expect(status.state).not.toBe('ACTIVE');
  });
});
