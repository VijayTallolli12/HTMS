import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T04: RatePlanRoomType Partial Unique Index & Check Constraint Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let roomTypeId: string;
  let ratePlanId: string;
  const createdMappingIds: string[] = [];

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_PI_${testSuffix}`, name: 'Partial Index Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_PI_${testSuffix}`,
        name: 'Partial Index Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: { id: countryId, regionId, code: `C_${testSuffix}`.slice(0, 10), name: 'PI Country' },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_PI_${testSuffix}`,
        name: 'PI Property',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    roomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeId,
        propertyId,
        code: `RT_PI_${testSuffix}`,
        name: 'PI RoomType',
        roomClass: 'STANDARD',
        bedConfiguration: [{ type: 'QUEEN', count: 1 }],
      },
    });

    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId,
        code: `RP_PI_${testSuffix}`,
        name: 'PI RatePlan',
        currency: 'USD',
        validFrom: new Date('2026-10-01T00:00:00.000Z'),
        validTo: new Date('2026-10-31T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    try {
      if (createdMappingIds.length > 0) {
        await prisma.ratePlanRoomType.deleteMany({ where: { id: { in: createdMappingIds } } });
      }
      await prisma.ratePlan.deleteMany({ where: { id: ratePlanId } });
      await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. should successfully create initial active mapping', async () => {
    const mappingId = generateUuidV7();
    createdMappingIds.push(mappingId);

    const mapping = await prisma.ratePlanRoomType.create({
      data: {
        id: mappingId,
        propertyId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 150.0,
        isActive: true,
        deletedAt: null,
      },
    });

    expect(mapping.id).toBe(mappingId);
    expect(mapping.isActive).toBe(true);
    expect(mapping.deletedAt).toBeNull();
  });

  it('2. should reject duplicate active mapping via partial unique index uq_active_rate_plan_room_types', async () => {
    const duplicateId = generateUuidV7();

    await expect(
      prisma.ratePlanRoomType.create({
        data: {
          id: duplicateId,
          propertyId,
          ratePlanId,
          roomTypeId,
          baseRateAmount: 160.0,
          isActive: true,
          deletedAt: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('3. should permit replacement mapping after soft-delete (deletedAt != null, isActive = false)', async () => {
    // Soft delete the first mapping
    await prisma.ratePlanRoomType.update({
      where: { id: createdMappingIds[0] },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Now creating a new active mapping should succeed
    const replacementId = generateUuidV7();
    createdMappingIds.push(replacementId);

    const replacement = await prisma.ratePlanRoomType.create({
      data: {
        id: replacementId,
        propertyId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 175.0,
        isActive: true,
        deletedAt: null,
      },
    });

    expect(replacement.id).toBe(replacementId);
    expect(replacement.isActive).toBe(true);
  });

  it('4. should permit replacement mapping after deactivation (isActive = false, deletedAt = null)', async () => {
    // Deactivate the second mapping
    await prisma.ratePlanRoomType.update({
      where: { id: createdMappingIds[1] },
      data: {
        isActive: false,
      },
    });

    // Now creating another active mapping should succeed
    const thirdId = generateUuidV7();
    createdMappingIds.push(thirdId);

    const third = await prisma.ratePlanRoomType.create({
      data: {
        id: thirdId,
        propertyId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 180.0,
        isActive: true,
        deletedAt: null,
      },
    });

    expect(third.id).toBe(thirdId);
    expect(third.isActive).toBe(true);
  });

  it('5. should reject illegal state isActive = true AND deletedAt != null via chk_rprt_active_not_deleted check constraint', async () => {
    const invalidStateId = generateUuidV7();

    await expect(
      prisma.ratePlanRoomType.create({
        data: {
          id: invalidStateId,
          propertyId,
          ratePlanId,
          roomTypeId,
          baseRateAmount: 200.0,
          isActive: true,
          deletedAt: new Date(), // Illegal state!
        },
      }),
    ).rejects.toThrow();
  });
});
