import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChannelManagerService } from './channel-manager.service';
import { DemoChannelAdapter } from './demo-channel.adapter';

const makeService = () => {
  const prisma: any = {
    channelConfig: { update: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue({ id: 'channel-1', propertyId: 'property-1', provider: 'DEMO', enabled: true, configuration: { demoOnly: true, externalPropertyId: 'DEMO-PROP', roomMappings: [], rateMappings: [] } }) },
    channelSyncLog: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reservation: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const reservations: any = { create: jest.fn(), findById: jest.fn() };
  const ats: any = { calculateDailyAts: jest.fn().mockReturnValue({ ats: 2 }) };
  const adapter = new DemoChannelAdapter();
  const service = new ChannelManagerService(prisma, reservations, ats, adapter);
  (service as any).registerAdapter(adapter);
  return { service, prisma, reservations, adapter };
};

describe('ChannelManagerService DEMO sync lifecycle', () => {
  it('persists PENDING request context and then SUCCESS attempt details', async () => {
    const { service, prisma, adapter } = makeService();
    prisma.channelSyncLog.findFirst.mockResolvedValueOnce(null);
    const delivery = jest.spyOn(adapter, 'simulateAvailabilityRateDelivery').mockResolvedValue({ processed: 3, failed: 0 });

    const result = await (service as any).runSyncWithRetry(
      { id: 'channel-1', propertyId: 'property-1' }, 'RATE', [], [],
      { startDate: '2026-11-01', endDate: '2026-11-02', simulateTransientFailure: true },
    );

    expect(prisma.channelSyncLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', attemptCount: 0, requestPayload: { demoOnly: true, startDate: '2026-11-01', endDate: '2026-11-02' } }) }));
    expect(delivery).toHaveBeenCalledWith(expect.anything(), expect.anything(), 1, true, undefined);
    expect(prisma.channelSyncLog.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', attemptCount: 1, recordsProcessed: 3, recordsFailed: 0 }) }));
    expect(result).toEqual({ processed: 3, failed: 0, attempts: 1 });
  });

  it('records terminal DEMO delivery failure after exhausting automatic attempts', async () => {
    const { service, prisma, adapter } = makeService();
    const delivery = jest.spyOn(adapter, 'simulateAvailabilityRateDelivery').mockRejectedValue(new Error('simulated persistent failure'));

    const result = await (service as any).runSyncWithRetry(
      { id: 'channel-1', propertyId: 'property-1' }, 'AVAILABILITY', [{ date: '2026-11-01' }], [],
      { startDate: '2026-11-01', endDate: '2026-11-01', simulatePermanentFailure: true },
    );

    expect(result).toEqual({ processed: 0, failed: 1, attempts: 2 });
    expect(delivery).toHaveBeenCalledTimes(2);
    expect(prisma.channelSyncLog.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', attemptCount: 2, recordsFailed: 1, errorMessage: 'simulated persistent failure' }) }));
  });

  it('requires an exact property mapping for reservation fixtures', async () => {
    const { service, prisma } = makeService();
    jest.spyOn(service as any, 'requireEnabledDemoChannel').mockResolvedValue({
      id: 'channel-1', propertyId: 'property-1', provider: 'DEMO', enabled: true,
      configuration: { demoOnly: true, externalPropertyId: 'DEMO-PROPERTY', roomMappings: [], rateMappings: [] },
    });
    await expect(service.processInboundReservation('property-1', 'channel-1', {
      provider: 'DEMO', payload: { externalPropertyId: '', externalId: 'reservation-1', arrivalDate: '2026-11-01', departureDate: '2026-11-02', guest: { firstName: 'A', lastName: 'B' } },
    })).rejects.toThrow(BadRequestException);
    expect(prisma.channelSyncLog.create).not.toHaveBeenCalled();
  });

  it('records retry lineage and returns the created retry log rather than the source log', async () => {
    const { service, prisma, adapter } = makeService();
    const previous = {
      id: 'failed-log', channelConfigId: 'channel-1', propertyId: 'property-1', syncType: 'RATE', status: 'FAILED',
      requestPayload: { startDate: '2026-11-01', endDate: '2026-11-02' }, attemptCount: 2, recordsFailed: 2,
    };
    prisma.channelSyncLog.findFirst
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce({ ...previous, id: 'retried-log', status: 'SUCCESS', attemptCount: 1, retryOfId: previous.id, recordsProcessed: 4, recordsFailed: 0, startedAt: new Date('2026-01-01T00:00:00Z'), completedAt: new Date('2026-01-01T00:00:01Z') });
    jest.spyOn(service as any, 'buildPmsPayloads').mockResolvedValue({ availability: [], rates: [{ date: '2026-11-01', roomTypeCode: 'R1', ratePlanCode: 'BAR', baseRate: 100, currency: 'USD' }] });
    jest.spyOn(adapter, 'simulateAvailabilityRateDelivery').mockResolvedValue({ processed: 4, failed: 0 });

    const result = await service.retrySync('property-1', 'channel-1', previous.id);

    expect(prisma.channelSyncLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ retryOfId: previous.id, requestPayload: { demoOnly: true, startDate: previous.requestPayload.startDate, endDate: previous.requestPayload.endDate } }) }));
    expect(result).toMatchObject({ id: 'retried-log', status: 'SUCCESS', retryOfId: previous.id, attemptCount: 1 });
  });

  it('rejects retry attempts for non-failed source logs', async () => {
    const { service, prisma } = makeService();
    prisma.channelSyncLog.findFirst.mockResolvedValueOnce({ id: 'done', status: 'SUCCESS', syncType: 'RATE' });
    await expect(service.retrySync('property-1', 'channel-1', 'done')).rejects.toThrow(ConflictException);
  });
});
