import { BadRequestException } from '@nestjs/common';
import { DemoChannelAdapter } from '../../apps/api-core/src/modules/pms/channel-manager/services/demo-channel.adapter';

describe('DemoChannelAdapter', () => {
  const adapter = new DemoChannelAdapter();

  it('is explicitly labelled DEMO and normalizes reservation fixtures deterministically', () => {
    const result = adapter.normalizeInbound({
      externalId: ' fixture-123 ',
      externalPropertyId: 'DEMO-PROPERTY-1',
      arrivalDate: '2026-11-01',
      departureDate: '2026-11-03',
      adults: 2,
      children: 1,
      roomTypeCode: 'DEMO-ROOM',
      ratePlanCode: 'DEMO-RATE',
      guest: { firstName: ' Demo ', lastName: ' Guest ' },
    });

    expect(adapter.provider).toBe('DEMO');
    expect(adapter.demoOnly).toBe(true);
    expect(result).toMatchObject({
      externalId: 'fixture-123',
      provider: 'DEMO',
      status: 'CONFIRMED',
      arrivalDate: '2026-11-01',
      departureDate: '2026-11-03',
      adults: 2,
      children: 1,
      roomTypeCode: 'DEMO-ROOM',
      ratePlanCode: 'DEMO-RATE',
      guest: { firstName: 'Demo', lastName: 'Guest' },
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('rejects reservation cancellation and unsupported statuses instead of confirming them', () => {
    expect(() => adapter.normalizeInbound({ status: 'CANCELLED' })).toThrow(BadRequestException);
    expect(() => adapter.normalizeInbound({ status: 'PENDING' })).toThrow(BadRequestException);
  });

  it('simulates transient and permanent delivery failures without network access', async () => {
    const availability = adapter.buildAvailabilityPayload([{ date: '2026-11-01', roomTypeCode: 'R1', available: 2, stopSell: false, closedToArrival: false, closedToDeparture: false }]);
    const rates = adapter.buildRatePayload([{ date: '2026-11-01', roomTypeCode: 'R1', ratePlanCode: 'BAR', baseRate: 100, currency: 'USD' }]);

    await expect(adapter.simulateAvailabilityRateDelivery(availability, rates, 1, true)).rejects.toThrow('DEMO transient delivery failure');
    await expect(adapter.simulateAvailabilityRateDelivery(availability, rates, 2, false, true)).rejects.toThrow('DEMO persistent delivery failure');
    await expect(adapter.simulateAvailabilityRateDelivery(availability, rates, 2)).resolves.toEqual({ processed: 2, failed: 0 });
  });
});
