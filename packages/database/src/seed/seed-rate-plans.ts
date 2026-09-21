import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface RatePlanIds { barId: string; corpId: string; advId: string; }

function getDateOffset(days: number): Date {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}

const RATE_PLANS = [
  { code: 'BAR', name: 'Best Available Rate', mealPlanCode: 'RO', pricingModel: 'PER_ROOM', minStayDays: 1, maxStayDays: null as number | null, cancellationPolicy: { freeCancellationHours: 24, lateCancellationFeePercent: 100 } },
  { code: 'CORP', name: 'Corporate Negotiated Rate', mealPlanCode: 'BB', pricingModel: 'PER_ROOM', minStayDays: 1, maxStayDays: 30, cancellationPolicy: { freeCancellationHours: 48, lateCancellationFeePercent: 50 } },
  { code: 'ADV', name: 'Advance Purchase Rate', mealPlanCode: 'RO', pricingModel: 'PER_ROOM', minStayDays: 2, maxStayDays: 14, cancellationPolicy: { freeCancellationHours: 72, lateCancellationFeePercent: 100, nonRefundable: true } },
];

const BASE_RATES: Record<string, Record<string, number>> = {
  BAR: { STD: 25000, DLX: 45000, EXC: 75000, SUI: 150000 },
  CORP: { STD: 22000, DLX: 40000, EXC: 65000, SUI: 130000 },
  ADV: { STD: 20000, DLX: 38000, EXC: 60000, SUI: 120000 },
};

export async function seedRatePlans(propertyId: string, roomTypeIds: { stdId: string; dlxId: string; excId: string; suiId: string }): Promise<RatePlanIds> {
  const prisma = getPrismaClient();
  console.log('Seeding rate plans...');
  const rtMap: Record<string, string> = { STD: roomTypeIds.stdId, DLX: roomTypeIds.dlxId, EXC: roomTypeIds.excId, SUI: roomTypeIds.suiId };
  const validFrom = getDateOffset(0);
  const validTo = getDateOffset(365);
  const result: Record<string, string> = {};

  for (const rp of RATE_PLANS) {
    let existing = await prisma.ratePlan.findFirst({ where: { propertyId, code: rp.code } });
    if (!existing) {
      existing = await prisma.ratePlan.create({ data: { id: generateUuidV7(), propertyId, code: rp.code, name: rp.name, currency: 'JPY', mealPlanCode: rp.mealPlanCode, pricingModel: rp.pricingModel, minStayDays: rp.minStayDays, maxStayDays: rp.maxStayDays, validFrom, validTo, cancellationPolicy: rp.cancellationPolicy, isActive: true } });
      console.log(`  Created RatePlan: ${rp.name} (${rp.code})`);
    } else { console.log(`  RatePlan exists: ${rp.name} (${rp.code})`); }
    result[rp.code] = existing.id;

    for (const [typeCode, baseRate] of Object.entries(BASE_RATES[rp.code])) {
      const existingMapping = await prisma.ratePlanRoomType.findFirst({ where: { ratePlanId: existing.id, roomTypeId: rtMap[typeCode] } });
      if (!existingMapping) { await prisma.ratePlanRoomType.create({ data: { id: generateUuidV7(), propertyId, ratePlanId: existing.id, roomTypeId: rtMap[typeCode], baseRateAmount: baseRate, extraAdultRate: 5000, extraChildRate: 2500, isActive: true } }); }
    }

    const existingDailyRate = await prisma.dailyRate.findFirst({ where: { ratePlanId: existing.id, roomTypeId: roomTypeIds.stdId, businessDate: validFrom } });
    if (!existingDailyRate) {
      const dailyRateData: Array<{ id: string; propertyId: string; ratePlanId: string; roomTypeId: string; businessDate: Date; baseRateAmount: number }> = [];
      for (let day = 0; day < 365; day++) {
        const bd = getDateOffset(day);
        for (const [tc, br] of Object.entries(BASE_RATES[rp.code])) {
          const dow = bd.getUTCDay();
          const isWeekend = dow === 0 || dow === 5 || dow === 6;
          dailyRateData.push({ id: generateUuidV7(), propertyId, ratePlanId: existing.id, roomTypeId: rtMap[tc], businessDate: bd, baseRateAmount: isWeekend ? Math.round(br * 1.15) : br });
        }
      }
      for (let i = 0; i < dailyRateData.length; i += 100) { await prisma.dailyRate.createMany({ data: dailyRateData.slice(i, i + 100), skipDuplicates: true }); }
      console.log(`  Created ${dailyRateData.length} DailyRate records for ${rp.code}`);
    } else { console.log(`  DailyRate already seeded for ${rp.code}`); }
  }
  return { barId: result['BAR'], corpId: result['CORP'], advId: result['ADV'] };
}
