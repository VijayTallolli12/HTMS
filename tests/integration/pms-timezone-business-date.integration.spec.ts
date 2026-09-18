import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { Clock } from '../../apps/api-core/src/modules/pms/common/contracts/clock.interface';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class TestClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
}

describe('W1-T04: Multi-Property Timezone & Business Date Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let dateService: PropertyBusinessDateService;
  let testClock: TestClock;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let tokyoPropId: string;
  let laPropId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    // 2026-10-01 23:30:00 UTC
    // Tokyo (+09:00): 2026-10-02 08:30:00
    // Los Angeles (-07:00 PDT): 2026-10-01 16:30:00
    testClock = new TestClock(new Date('2026-10-01T23:30:00.000Z'));
    dateService = new PropertyBusinessDateService(testClock);

    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_TZ_${testSuffix}`, name: 'TZ Hotel Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: { id: regionId, hotelGroupId, code: `REG_TZ_${testSuffix}`, name: 'TZ Region' },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: { id: countryId, regionId, code: `CTZ_${testSuffix}`.slice(0, 10), name: 'TZ Country' },
    });

    tokyoPropId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: tokyoPropId,
        countryId,
        code: `PRP_TYO_${testSuffix}`,
        name: 'Tokyo Grand Hotel',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
        status: 'ACTIVE',
      },
    });

    laPropId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: laPropId,
        countryId,
        code: `PRP_LAX_${testSuffix}`,
        name: 'Los Angeles Ocean Resort',
        timeZone: 'America/Los_Angeles',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.property.deleteMany({ where: { id: { in: [tokyoPropId, laPropId] } } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('should resolve different business dates for Tokyo and LA at the identical UTC instant', async () => {
    const tokyoProp = await prisma.property.findUniqueOrThrow({ where: { id: tokyoPropId } });
    const laProp = await prisma.property.findUniqueOrThrow({ where: { id: laPropId } });

    const tokyoDate = dateService.getCurrentBusinessDate(tokyoProp.timeZone);
    const laDate = dateService.getCurrentBusinessDate(laProp.timeZone);

    // Tokyo is on 2026-10-02
    expect(tokyoDate.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    // Los Angeles is still on 2026-10-01
    expect(laDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');

    expect(tokyoDate.getTime()).toBeGreaterThan(laDate.getTime());
  });
});
