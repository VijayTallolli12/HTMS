import {
  evaluateStayRestrictions,
  StayEvaluationInput,
} from '../../apps/api-core/src/modules/pms/inventory/services/stay-restriction-evaluator';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';

describe('StayRestrictionEvaluator (W1-T04 Deterministic Stay Evaluation)', () => {
  const atsCalculator = new AtsCalculatorService();

  const createDefaultInventory = (startDate: string, days: number, atsCount = 5) => {
    const list = [];
    const base = new Date(`${startDate}T00:00:00.000Z`);
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      list.push({
        businessDate: d,
        totalRooms: atsCount,
        outOfOrderCount: 0,
        outOfServiceCount: 0,
        blockedCount: 0,
        bookedCount: 0,
        overbookingLimit: 0,
      });
    }
    return list;
  };

  describe('validTo Last Sellable Night Boundary Matrix', () => {
    const baseRatePlan = {
      id: 'rp-1',
      code: 'BAR',
      name: 'Best Available Rate',
      currency: 'USD',
      isClosed: false,
      isClosedToArrival: false,
      isClosedToDeparture: false,
      minStayDays: 1,
      maxStayDays: null,
      validFrom: '2026-10-01',
      validTo: '2026-10-10', // Last sellable night is Oct 10
      baseRateAmount: 100,
    };

    it('1. should permit stay completely inside validity window (Oct 01 to Oct 05)', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-05T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(true);
      expect(result.nightlyRates).toHaveLength(4);
      expect(result.totalAmount).toBe('400.0000');
    });

    it('2. should permit 1-night stay arriving on validTo (Oct 10 to Oct 11)', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-10T00:00:00.000Z'),
        departureDate: new Date('2026-10-11T00:00:00.000Z'), // Night sold is Oct 10
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(true);
      expect(result.nightlyRates).toHaveLength(1);
      expect(result.nightlyRates[0].date).toBe('2026-10-10');
      expect(result.totalAmount).toBe('100.0000');
    });

    it('3. should reject 2-night stay arriving on validTo (Oct 10 to Oct 12) with OUTSIDE_VALIDITY_WINDOW', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-10T00:00:00.000Z'),
        departureDate: new Date('2026-10-12T00:00:00.000Z'), // Night Oct 11 is past validTo
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('OUTSIDE_VALIDITY_WINDOW');
    });

    it('4. should permit stay departing on validTo (Oct 08 to Oct 10)', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-08T00:00:00.000Z'),
        departureDate: new Date('2026-10-10T00:00:00.000Z'), // Sold nights: Oct 08, Oct 09
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(true);
      expect(result.nightlyRates).toHaveLength(2);
      expect(result.totalAmount).toBe('200.0000');
    });

    it('5. should reject stay arriving on validTo + 1 (Oct 11 to Oct 12) with OUTSIDE_VALIDITY_WINDOW', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-11T00:00:00.000Z'),
        departureDate: new Date('2026-10-12T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('OUTSIDE_VALIDITY_WINDOW');
    });

    it('6. should reject stay crossing validTo (Oct 09 to Oct 12) with OUTSIDE_VALIDITY_WINDOW', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-10-09T00:00:00.000Z'),
        departureDate: new Date('2026-10-12T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('OUTSIDE_VALIDITY_WINDOW');
    });

    it('7. should reject stay arriving before validFrom with OUTSIDE_VALIDITY_WINDOW', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: baseRatePlan,
        arrivalDate: new Date('2026-09-30T00:00:00.000Z'),
        departureDate: new Date('2026-10-02T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-09-29', 15),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('OUTSIDE_VALIDITY_WINDOW');
    });
  });

  describe('Closed to Arrival (CTA) and Closed to Departure (CTD)', () => {
    it('should evaluate CTA solely on arrival date', () => {
      const inputCTAOnArrival: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
          dailyRates: [
            {
              businessDate: '2026-10-02',
              baseRateAmount: 100,
              isClosed: false,
              isClosedToArrival: true, // CTA only on Oct 02
            },
          ],
        },
        arrivalDate: new Date('2026-10-02T00:00:00.000Z'),
        departureDate: new Date('2026-10-04T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      // Arriving on Oct 02 -> rejected
      expect(evaluateStayRestrictions(inputCTAOnArrival, atsCalculator).isAvailable).toBe(false);
      expect(evaluateStayRestrictions(inputCTAOnArrival, atsCalculator).rejectionReason).toBe(
        'CLOSED_TO_ARRIVAL',
      );

      // Arriving on Oct 01 and staying through Oct 02 -> permitted!
      const inputStayThroughCTA: StayEvaluationInput = {
        ...inputCTAOnArrival,
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-04T00:00:00.000Z'),
      };
      expect(evaluateStayRestrictions(inputStayThroughCTA, atsCalculator).isAvailable).toBe(true);
    });

    it('should evaluate CTD solely on departure date', () => {
      const inputCTDOnDeparture: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
          dailyRates: [
            {
              businessDate: '2026-10-03',
              baseRateAmount: 100,
              isClosed: false,
              isClosedToDeparture: true, // CTD only on Oct 03
            },
          ],
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-03T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      // Departing on Oct 03 -> rejected
      expect(evaluateStayRestrictions(inputCTDOnDeparture, atsCalculator).isAvailable).toBe(false);
      expect(evaluateStayRestrictions(inputCTDOnDeparture, atsCalculator).rejectionReason).toBe(
        'CLOSED_TO_DEPARTURE',
      );

      // Departing on Oct 04 (staying through Oct 03) -> permitted!
      const inputStayThroughCTD: StayEvaluationInput = {
        ...inputCTDOnDeparture,
        departureDate: new Date('2026-10-04T00:00:00.000Z'),
      };
      expect(evaluateStayRestrictions(inputStayThroughCTD, atsCalculator).isAvailable).toBe(true);
    });
  });

  describe('Stop-Sell and Inventory Restrictions', () => {
    it('should reject when master isClosed is true', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: true, // Master stop sell
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-03T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('DATE_STOP_SELL');
    });

    it('should reject when a daily rate in stay window is closed', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
          dailyRates: [
            {
              businessDate: '2026-10-02',
              baseRateAmount: 100,
              isClosed: true, // Stop sell on Oct 02 night
            },
          ],
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-03T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('DATE_STOP_SELL');
    });

    it('should reject when any night has 0 ATS capacity', () => {
      const inventory = createDefaultInventory('2026-10-01', 5);
      // Deplete inventory on Oct 02
      inventory[1].bookedCount = 5; // ATS = 0

      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-04T00:00:00.000Z'),
        inventoryRecords: inventory,
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('INSUFFICIENT_INVENTORY');
    });
  });

  describe('Length of Stay Constraints', () => {
    it('should enforce minStayDays', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 3,
          maxStayDays: null,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-03T00:00:00.000Z'), // 2 nights < 3
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('MIN_STAY_NOT_MET');
    });

    it('should enforce maxStayDays', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: 3,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-05T00:00:00.000Z'), // 4 nights > 3
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('MAX_STAY_EXCEEDED');
    });

    it('should fail closed when daily override has minStayDays > maxStayDays', () => {
      const input: StayEvaluationInput = {
        propertyId: 'prop-1',
        roomTypeId: 'rt-1',
        ratePlan: {
          id: 'rp-1',
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isClosed: false,
          isClosedToArrival: false,
          isClosedToDeparture: false,
          minStayDays: 1,
          maxStayDays: 10,
          validFrom: '2026-10-01',
          validTo: '2026-10-10',
          baseRateAmount: 100,
          dailyRates: [
            {
              businessDate: '2026-10-01',
              baseRateAmount: 100,
              isClosed: false,
              minStayDays: 5,
              maxStayDays: 3, // Misconfigured: min > max
            },
          ],
        },
        arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
        departureDate: new Date('2026-10-05T00:00:00.000Z'),
        inventoryRecords: createDefaultInventory('2026-10-01', 10),
        includeOutOfServiceInAts: false,
      };

      const result = evaluateStayRestrictions(input, atsCalculator);
      expect(result.isAvailable).toBe(false);
      expect(result.rejectionReason).toBe('INVALID_RESTRICTION_CONFIGURATION');
    });
  });
});
