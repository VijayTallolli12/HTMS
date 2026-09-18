import { AtsCalculatorService, InventoryCounts } from './ats-calculator.service';

export interface EvaluatorDailyRate {
  businessDate: Date | string;
  baseRateAmount: number | string;
  extraAdultRate?: number | string | null;
  extraChildRate?: number | string | null;
  isClosed: boolean;
  isClosedToArrival?: boolean | null;
  isClosedToDeparture?: boolean | null;
  minStayDays?: number | null;
  maxStayDays?: number | null;
}

export interface EvaluatorRatePlan {
  id: string;
  code: string;
  name: string;
  currency: string;
  isClosed: boolean;
  isClosedToArrival: boolean;
  isClosedToDeparture: boolean;
  minStayDays: number;
  maxStayDays: number | null;
  validFrom: Date | string;
  validTo: Date | string; // Last sellable night
  baseRateAmount: number | string;
  dailyRates?: EvaluatorDailyRate[];
}

export interface EvaluatorDailyInventory extends InventoryCounts {
  businessDate: Date | string;
}

export interface StayEvaluationInput {
  propertyId: string;
  roomTypeId: string;
  ratePlan: EvaluatorRatePlan;
  arrivalDate: Date;
  departureDate: Date;
  inventoryRecords: EvaluatorDailyInventory[];
  includeOutOfServiceInAts: boolean;
}

export interface StayEvaluationResult {
  isAvailable: boolean;
  rejectionReason?:
    | 'OUTSIDE_VALIDITY_WINDOW'
    | 'CLOSED_TO_ARRIVAL'
    | 'CLOSED_TO_DEPARTURE'
    | 'DATE_STOP_SELL'
    | 'MIN_STAY_NOT_MET'
    | 'MAX_STAY_EXCEEDED'
    | 'INVALID_RESTRICTION_CONFIGURATION'
    | 'INSUFFICIENT_INVENTORY';
  nightlyRates: Array<{ date: string; amount: string }>;
  totalAmount: string;
}

function toIsoDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function parseDateUtc(d: Date | string): Date {
  const str = toIsoDateString(d);
  return new Date(`${str}T00:00:00.000Z`);
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

export function evaluateStayRestrictions(
  input: StayEvaluationInput,
  atsCalculator: AtsCalculatorService,
): StayEvaluationResult {
  const { ratePlan, arrivalDate, departureDate, inventoryRecords, includeOutOfServiceInAts } =
    input;

  const arr = parseDateUtc(arrivalDate);
  const dep = parseDateUtc(departureDate);
  const stayLength = Math.round((dep.getTime() - arr.getTime()) / (24 * 60 * 60 * 1000));

  if (stayLength <= 0) {
    return {
      isAvailable: false,
      rejectionReason: 'MIN_STAY_NOT_MET',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  const validFrom = parseDateUtc(ratePlan.validFrom);
  const validTo = parseDateUtc(ratePlan.validTo); // Last sellable night

  // 1. Check validity window: every night d must be in [validFrom, validTo]
  const lastNight = addDays(dep, -1);
  if (arr < validFrom || lastNight > validTo) {
    return {
      isAvailable: false,
      rejectionReason: 'OUTSIDE_VALIDITY_WINDOW',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  // 2. Master stop sell
  if (ratePlan.isClosed) {
    return {
      isAvailable: false,
      rejectionReason: 'DATE_STOP_SELL',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  const dailyRates = ratePlan.dailyRates || [];
  const arrStr = toIsoDateString(arr);
  const depStr = toIsoDateString(dep);

  const arrivalDaily = dailyRates.find((dr) => toIsoDateString(dr.businessDate) === arrStr);
  const departureDaily = dailyRates.find((dr) => toIsoDateString(dr.businessDate) === depStr);

  // 3. Closed-to-Arrival (CTA) — evaluated solely on arrival date
  const effectiveCTA =
    arrivalDaily?.isClosedToArrival !== undefined && arrivalDaily?.isClosedToArrival !== null
      ? arrivalDaily.isClosedToArrival
      : ratePlan.isClosedToArrival;
  if (effectiveCTA === true) {
    return {
      isAvailable: false,
      rejectionReason: 'CLOSED_TO_ARRIVAL',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  // 4. Closed-to-Departure (CTD) — evaluated solely on departure date
  const effectiveCTD =
    departureDaily?.isClosedToDeparture !== undefined &&
    departureDaily?.isClosedToDeparture !== null
      ? departureDaily.isClosedToDeparture
      : ratePlan.isClosedToDeparture;
  if (effectiveCTD === true) {
    return {
      isAvailable: false,
      rejectionReason: 'CLOSED_TO_DEPARTURE',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  // 5. Min / Max stay — evaluated against arrival date restrictions
  const effectiveMinStay =
    arrivalDaily?.minStayDays !== undefined && arrivalDaily?.minStayDays !== null
      ? arrivalDaily.minStayDays
      : ratePlan.minStayDays ?? 1;

  const effectiveMaxStay =
    arrivalDaily?.maxStayDays !== undefined && arrivalDaily?.maxStayDays !== null
      ? arrivalDaily.maxStayDays
      : ratePlan.maxStayDays ?? null;

  // Sanity check: fail closed if minStay > maxStay due to misconfiguration
  if (effectiveMaxStay !== null && effectiveMinStay > effectiveMaxStay) {
    return {
      isAvailable: false,
      rejectionReason: 'INVALID_RESTRICTION_CONFIGURATION',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  if (stayLength < effectiveMinStay) {
    return {
      isAvailable: false,
      rejectionReason: 'MIN_STAY_NOT_MET',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  if (effectiveMaxStay !== null && stayLength > effectiveMaxStay) {
    return {
      isAvailable: false,
      rejectionReason: 'MAX_STAY_EXCEEDED',
      nightlyRates: [],
      totalAmount: '0.0000',
    };
  }

  // 6. Night-by-night Stop Sell, Pricing, and ATS capacity
  const nightlyRates: Array<{ date: string; amount: string }> = [];
  let totalNum = 0;

  for (let d = new Date(arr.getTime()); d < dep; d = addDays(d, 1)) {
    const dStr = toIsoDateString(d);
    const dailyRate = dailyRates.find((dr) => toIsoDateString(dr.businessDate) === dStr);

    // Stop sell on individual night
    if (dailyRate?.isClosed === true) {
      return {
        isAvailable: false,
        rejectionReason: 'DATE_STOP_SELL',
        nightlyRates: [],
        totalAmount: '0.0000',
      };
    }

    const rateNum = Number(dailyRate?.baseRateAmount ?? ratePlan.baseRateAmount);
    nightlyRates.push({ date: dStr, amount: rateNum.toFixed(4) });
    totalNum += rateNum;

    // Capacity check
    const inv = inventoryRecords.find((i) => toIsoDateString(i.businessDate) === dStr);
    if (!inv) {
      return {
        isAvailable: false,
        rejectionReason: 'INSUFFICIENT_INVENTORY',
        nightlyRates: [],
        totalAmount: '0.0000',
      };
    }

    const { ats } = atsCalculator.calculateDailyAts(inv, includeOutOfServiceInAts);
    if (ats <= 0) {
      return {
        isAvailable: false,
        rejectionReason: 'INSUFFICIENT_INVENTORY',
        nightlyRates: [],
        totalAmount: '0.0000',
      };
    }
  }

  return {
    isAvailable: true,
    nightlyRates,
    totalAmount: totalNum.toFixed(4),
  };
}
