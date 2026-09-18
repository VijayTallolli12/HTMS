import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { Clock } from '../../apps/api-core/src/modules/pms/common/contracts/clock.interface';

class MockClock implements Clock {
  constructor(private currentInstant: Date) {}

  public setInstant(instant: Date) {
    this.currentInstant = instant;
  }

  public now(): Date {
    return new Date(this.currentInstant.getTime());
  }
}

describe('PropertyBusinessDateService (W1-T04)', () => {
  let mockClock: MockClock;
  let service: PropertyBusinessDateService;

  beforeEach(() => {
    // 2026-10-01 23:30:00 UTC
    // In Asia/Tokyo (+09:00), this is 2026-10-02 08:30:00
    // In America/Los_Angeles (-07:00 PDT), this is 2026-10-01 16:30:00
    // In Europe/London (+01:00 BST), this is 2026-10-02 00:30:00
    mockClock = new MockClock(new Date('2026-10-01T23:30:00.000Z'));
    service = new PropertyBusinessDateService(mockClock);
  });

  describe('getCurrentBusinessDate', () => {
    it('should resolve next day for Asia/Tokyo when UTC is 23:30', () => {
      const bDate = service.getCurrentBusinessDate('Asia/Tokyo');
      expect(bDate.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    });

    it('should resolve same day for America/Los_Angeles when UTC is 23:30', () => {
      const bDate = service.getCurrentBusinessDate('America/Los_Angeles');
      expect(bDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should resolve same day for UTC when UTC is 23:30', () => {
      const bDate = service.getCurrentBusinessDate('UTC');
      expect(bDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should correctly handle America/New_York across DST fall-back boundary', () => {
      // 2026-11-01 05:30:00 UTC is 01:30:00 EDT/EST in New York
      mockClock.setInstant(new Date('2026-11-01T05:30:00.000Z'));
      const bDate = service.getCurrentBusinessDate('America/New_York');
      expect(bDate.toISOString()).toBe('2026-11-01T00:00:00.000Z');

      // 2026-11-01 03:59:00 UTC is 23:59:00 on Oct 31 in New York
      mockClock.setInstant(new Date('2026-11-01T03:59:00.000Z'));
      const bDateOct = service.getCurrentBusinessDate('America/New_York');
      expect(bDateOct.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    });
  });

  describe('formatToPropertyDateString', () => {
    it('should format Date instance into local YYYY-MM-DD string', () => {
      const instant = new Date('2026-10-01T23:30:00.000Z');
      expect(service.formatToPropertyDateString(instant, 'Asia/Tokyo')).toBe('2026-10-02');
      expect(service.formatToPropertyDateString(instant, 'America/Los_Angeles')).toBe('2026-10-01');
    });
  });
});
