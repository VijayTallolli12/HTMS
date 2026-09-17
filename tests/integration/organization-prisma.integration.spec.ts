import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Organization Prisma Database Integration Test', () => {
  let prisma: PrismaClient;

  const testSuffix = Date.now().toString().slice(-6);
  const groupCode = `HG-TEST-${testSuffix}`;
  const regionCode = `REG-${testSuffix}`;
  const countryCode = `T${testSuffix.slice(-1)}`; // 2-letter
  const propertyCode = `PROP-TEST-${testSuffix}`;
  const buildingCode = `BLD-${testSuffix}`;
  const floorCode = `FL-${testSuffix}`;

  let testGroupId: string;
  let testRegionId: string;
  let testCountryId: string;
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up in reverse hierarchy order
    try {
      if (testFloorId) await prisma.floor.deleteMany({ where: { id: testFloorId } });
      if (testBuildingId) await prisma.building.deleteMany({ where: { id: testBuildingId } });
      if (testPropertyId) await prisma.property.deleteMany({ where: { id: testPropertyId } });
      if (testCountryId) await prisma.country.deleteMany({ where: { id: testCountryId } });
      if (testRegionId) await prisma.region.deleteMany({ where: { id: testRegionId } });
      if (testGroupId) await prisma.hotelGroup.deleteMany({ where: { id: testGroupId } });
    } catch {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  it('1. should create a full organizational hierarchy from Group down to Floor', async () => {
    // 1. Hotel Group
    testGroupId = generateUuidV7();
    const group = await prisma.hotelGroup.create({
      data: {
        id: testGroupId,
        code: groupCode,
        name: 'Test Group Integration',
        status: 'ACTIVE',
      },
    });
    expect(group.id).toBe(testGroupId);
    expect(group.code).toBe(groupCode);

    // 2. Region
    testRegionId = generateUuidV7();
    const region = await prisma.region.create({
      data: {
        id: testRegionId,
        hotelGroupId: testGroupId,
        code: regionCode,
        name: 'Test Region Integration',
        status: 'ACTIVE',
      },
    });
    expect(region.id).toBe(testRegionId);
    expect(region.hotelGroupId).toBe(testGroupId);

    // 3. Country
    testCountryId = generateUuidV7();
    const country = await prisma.country.create({
      data: {
        id: testCountryId,
        regionId: testRegionId,
        code: countryCode,
        name: 'Test Country Integration',
        status: 'ACTIVE',
      },
    });
    expect(country.id).toBe(testCountryId);
    expect(country.regionId).toBe(testRegionId);

    // 4. Property
    testPropertyId = generateUuidV7();
    const property = await prisma.property.create({
      data: {
        id: testPropertyId,
        countryId: testCountryId,
        code: propertyCode,
        name: 'Test Property Integration',
        status: 'ACTIVE',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
      },
    });
    expect(property.id).toBe(testPropertyId);
    expect(property.countryId).toBe(testCountryId);

    // 5. Building
    testBuildingId = generateUuidV7();
    const building = await prisma.building.create({
      data: {
        id: testBuildingId,
        propertyId: testPropertyId,
        code: buildingCode,
        name: 'Test Building Integration',
        status: 'ACTIVE',
      },
    });
    expect(building.id).toBe(testBuildingId);
    expect(building.propertyId).toBe(testPropertyId);

    // 6. Floor
    testFloorId = generateUuidV7();
    const floor = await prisma.floor.create({
      data: {
        id: testFloorId,
        buildingId: testBuildingId,
        code: floorCode,
        name: 'Floor 1',
        floorNumber: 1,
        status: 'ACTIVE',
      },
    });
    expect(floor.id).toBe(testFloorId);
    expect(floor.buildingId).toBe(testBuildingId);
  });

  it('2. should enforce unique constraints on entity codes', async () => {
    // Duplicate Hotel Group Code
    await expect(
      prisma.hotelGroup.create({
        data: {
          id: generateUuidV7(),
          code: groupCode, // Already exists
          name: 'Duplicate Group',
        },
      }),
    ).rejects.toThrow();

    // Duplicate Property Code
    await expect(
      prisma.property.create({
        data: {
          id: generateUuidV7(),
          countryId: testCountryId,
          code: propertyCode, // Already exists
          name: 'Duplicate Property',
          timeZone: 'UTC',
          currency: 'USD',
        },
      }),
    ).rejects.toThrow();
  });

  it('3. should enforce foreign-key constraints (onDelete: Restrict)', async () => {
    // Attempting to delete a Property that has a child Building must fail
    await expect(
      prisma.property.delete({
        where: { id: testPropertyId },
      }),
    ).rejects.toThrow();

    // Attempting to delete a Building that has a child Floor must fail
    await expect(
      prisma.building.delete({
        where: { id: testBuildingId },
      }),
    ).rejects.toThrow();
  });

  it('4. should atomically record aggregate state and outbox event in a single transaction', async () => {
    const newGroupId = generateUuidV7();
    const newGroupCode = `HG-TX-${testSuffix}`;
    const outboxEventId = generateUuidV7();

    const [createdGroup, createdOutbox] = await prisma.$transaction([
      prisma.hotelGroup.create({
        data: {
          id: newGroupId,
          code: newGroupCode,
          name: 'Transactional Group',
          status: 'ACTIVE',
        },
      }),
      prisma.outboxEvent.create({
        data: {
          id: outboxEventId,
          specversion: '1.0',
          type: 'com.enterprise_hms.organization.group_created.v1',
          source: `https://platform.enterprise-hms.com/organizations/groups/${newGroupId}`,
          subject: newGroupId,
          data: { groupId: newGroupId, code: newGroupCode },
          published: false,
        },
      }),
    ]);

    expect(createdGroup.id).toBe(newGroupId);
    expect(createdOutbox.id).toBe(outboxEventId);

    // Verify row in audit_schema.outbox_events
    const outboxRecord = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });
    expect(outboxRecord).toBeDefined();
    expect(outboxRecord?.type).toBe('com.enterprise_hms.organization.group_created.v1');
    expect(outboxRecord?.published).toBe(false);

    // Clean up
    await prisma.outboxEvent.delete({ where: { id: outboxEventId } });
    await prisma.hotelGroup.delete({ where: { id: newGroupId } });
  });
});
