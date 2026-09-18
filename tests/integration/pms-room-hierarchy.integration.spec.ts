import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T04: Database Composite FK Room Hierarchy Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Tracking IDs for cleanup
  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyAId: string;
  let propertyBId: string;
  let buildingAId: string;
  let buildingBId: string;
  let floorAId: string;
  let floorBId: string;
  let roomTypeAId: string;
  let roomTypeBId: string;
  const createdRoomIds: string[] = [];

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    // 1. Seed Hotel Group, Region, Country
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: {
        id: hotelGroupId,
        code: `GRP_HR_${testSuffix}`,
        name: 'Hierarchy Test Group',
      },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_HR_${testSuffix}`,
        name: 'Hierarchy Test Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CT_${testSuffix}`.slice(0, 10),
        name: 'Hierarchy Country',
      },
    });

    // 2. Property A and Property B
    propertyAId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyAId,
        countryId,
        code: `PRP_A_${testSuffix}`,
        name: 'Property A',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
        status: 'ACTIVE',
      },
    });

    propertyBId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyBId,
        countryId,
        code: `PRP_B_${testSuffix}`,
        name: 'Property B',
        timeZone: 'America/New_York',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // 3. Buildings: Building A (under Prop A), Building B (under Prop B)
    buildingAId = generateUuidV7();
    await prisma.building.create({
      data: {
        id: buildingAId,
        propertyId: propertyAId,
        code: `BLD_A_${testSuffix}`,
        name: 'Building A',
      },
    });

    buildingBId = generateUuidV7();
    await prisma.building.create({
      data: {
        id: buildingBId,
        propertyId: propertyBId,
        code: `BLD_B_${testSuffix}`,
        name: 'Building B',
      },
    });

    // 4. Floors: Floor A (under Building A), Floor B (under Building B)
    floorAId = generateUuidV7();
    await prisma.floor.create({
      data: {
        id: floorAId,
        buildingId: buildingAId,
        code: `FL_A1_${testSuffix}`,
        floorNumber: 1,
        name: 'Floor A1',
      },
    });

    floorBId = generateUuidV7();
    await prisma.floor.create({
      data: {
        id: floorBId,
        buildingId: buildingBId,
        code: `FL_B1_${testSuffix}`,
        floorNumber: 1,
        name: 'Floor B1',
      },
    });

    // 5. RoomTypes: Type A (under Prop A), Type B (under Prop B)
    roomTypeAId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeAId,
        propertyId: propertyAId,
        code: `RTA_${testSuffix}`,
        name: 'Type A Deluxe',
        roomClass: 'DELUXE',
        bedConfiguration: [{ type: 'KING', count: 1 }],
      },
    });

    roomTypeBId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeBId,
        propertyId: propertyBId,
        code: `RTB_${testSuffix}`,
        name: 'Type B Deluxe',
        roomClass: 'DELUXE',
        bedConfiguration: [{ type: 'KING', count: 1 }],
      },
    });
  });

  afterAll(async () => {
    try {
      // Clean up rooms
      if (createdRoomIds.length > 0) {
        await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
      }
      // Clean up room types
      await prisma.roomType.deleteMany({ where: { id: { in: [roomTypeAId, roomTypeBId] } } });
      // Clean up floors
      await prisma.floor.deleteMany({ where: { id: { in: [floorAId, floorBId] } } });
      // Clean up buildings
      await prisma.building.deleteMany({ where: { id: { in: [buildingAId, buildingBId] } } });
      // Clean up properties
      await prisma.property.deleteMany({ where: { id: { in: [propertyAId, propertyBId] } } });
      // Clean up country, region, group
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. should reject room insertion with building belonging to a different property (fk_rooms_building_property)', async () => {
    const invalidRoomId = generateUuidV7();
    await expect(
      prisma.room.create({
        data: {
          id: invalidRoomId,
          propertyId: propertyAId, // Property A
          buildingId: buildingBId, // Building B belongs to Property B!
          floorId: floorBId,
          roomTypeId: roomTypeAId,
          roomNumber: `RM_FAIL_BLD_${testSuffix}`,
        },
      }),
    ).rejects.toThrow();
  });

  it('2. should reject room insertion with floor belonging to a different building (fk_rooms_floor_building)', async () => {
    const invalidRoomId = generateUuidV7();
    await expect(
      prisma.room.create({
        data: {
          id: invalidRoomId,
          propertyId: propertyAId,
          buildingId: buildingAId, // Building A
          floorId: floorBId, // Floor B belongs to Building B!
          roomTypeId: roomTypeAId,
          roomNumber: `RM_FAIL_FLR_${testSuffix}`,
        },
      }),
    ).rejects.toThrow();
  });

  it('3. should reject room insertion with room type belonging to a different property (fk_rooms_room_type_property)', async () => {
    const invalidRoomId = generateUuidV7();
    await expect(
      prisma.room.create({
        data: {
          id: invalidRoomId,
          propertyId: propertyAId,
          buildingId: buildingAId,
          floorId: floorAId,
          roomTypeId: roomTypeBId, // RoomType B belongs to Property B!
          roomNumber: `RM_FAIL_TYP_${testSuffix}`,
        },
      }),
    ).rejects.toThrow();
  });

  it('4. should successfully create room when hierarchy strictly matches', async () => {
    const validRoomId = generateUuidV7();
    createdRoomIds.push(validRoomId);

    const room = await prisma.room.create({
      data: {
        id: validRoomId,
        propertyId: propertyAId,
        buildingId: buildingAId,
        floorId: floorAId,
        roomTypeId: roomTypeAId,
        roomNumber: `RM_OK_${testSuffix}`,
        name: 'Valid Room',
      },
    });

    expect(room.id).toBe(validRoomId);
    expect(room.roomNumber).toBe(`RM_OK_${testSuffix}`);
  });
});
