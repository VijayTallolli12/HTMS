import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';

describe('AtsCalculatorService (W1-T04 Authoritative ATS Engine)', () => {
  let service: AtsCalculatorService;

  beforeEach(() => {
    service = new AtsCalculatorService();
  });

  it('should calculate authoritative ATS excluding Out of Service by default', () => {
    const result = service.calculateDailyAts(
      {
        totalRooms: 10,
        outOfOrderCount: 2,
        outOfServiceCount: 1, // Excluded from deduction by default
        blockedCount: 1,
        bookedCount: 3,
        overbookingLimit: 0,
      },
      false,
    );

    // physicalAvailable = max(0, 10 - 2 - 0 - 1) = 7
    // maxSellable = 7 + 0 = 7
    // ats = max(0, 7 - 3) = 4
    expect(result.physicalAvailable).toBe(7);
    expect(result.maxSellable).toBe(7);
    expect(result.ats).toBe(4);
  });

  it('should deduct Out of Service when includeOutOfServiceInAts is true', () => {
    const result = service.calculateDailyAts(
      {
        totalRooms: 10,
        outOfOrderCount: 2,
        outOfServiceCount: 1, // Deducted when true
        blockedCount: 1,
        bookedCount: 3,
        overbookingLimit: 0,
      },
      true,
    );

    // physicalAvailable = max(0, 10 - 2 - 1 - 1) = 6
    // maxSellable = 6 + 0 = 6
    // ats = max(0, 6 - 3) = 3
    expect(result.physicalAvailable).toBe(6);
    expect(result.maxSellable).toBe(6);
    expect(result.ats).toBe(3);
  });

  it('should incorporate overbooking limit into maxSellable and ATS', () => {
    const result = service.calculateDailyAts(
      {
        totalRooms: 10,
        outOfOrderCount: 0,
        outOfServiceCount: 0,
        blockedCount: 0,
        bookedCount: 10,
        overbookingLimit: 2,
      },
      false,
    );

    // physicalAvailable = 10
    // maxSellable = 10 + 2 = 12
    // ats = max(0, 12 - 10) = 2
    expect(result.physicalAvailable).toBe(10);
    expect(result.maxSellable).toBe(12);
    expect(result.ats).toBe(2);
  });

  it('should floor ATS to 0 when booked count exceeds max sellable (no negative ATS)', () => {
    const result = service.calculateDailyAts(
      {
        totalRooms: 10,
        outOfOrderCount: 0,
        outOfServiceCount: 0,
        blockedCount: 0,
        bookedCount: 15, // Exceeds capacity
        overbookingLimit: 2,
      },
      false,
    );

    expect(result.physicalAvailable).toBe(10);
    expect(result.maxSellable).toBe(12);
    expect(result.ats).toBe(0);
  });

  it('should floor physicalAvailable to 0 when OOO exceeds total rooms', () => {
    const result = service.calculateDailyAts(
      {
        totalRooms: 5,
        outOfOrderCount: 8,
        outOfServiceCount: 0,
        blockedCount: 0,
        bookedCount: 0,
        overbookingLimit: 0,
      },
      false,
    );

    expect(result.physicalAvailable).toBe(0);
    expect(result.maxSellable).toBe(0);
    expect(result.ats).toBe(0);
  });
});
