import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export async function seedOrganizationHierarchy() {
  const prisma = getPrismaClient();

  console.log('Seeding minimal canonical organization hierarchy...');

  // 1. Hotel Group
  let group = await prisma.hotelGroup.findUnique({
    where: { code: 'HG-GLR' },
  });

  if (!group) {
    group = await prisma.hotelGroup.create({
      data: {
        id: generateUuidV7(),
        code: 'HG-GLR',
        name: 'Global Luxury Resorts & Hotels',
        description: 'Flagship enterprise luxury hospitality portfolio',
        status: 'ACTIVE',
      },
    });
    console.log(`Created Hotel Group: ${group.name} (${group.code})`);
  }

  // 2. Region
  let region = await prisma.region.findFirst({
    where: { hotelGroupId: group.id, code: 'APAC' },
  });

  if (!region) {
    region = await prisma.region.create({
      data: {
        id: generateUuidV7(),
        hotelGroupId: group.id,
        code: 'APAC',
        name: 'Asia-Pacific Regional Division',
        description: 'Operations across East Asia, South Asia, and Australasia',
        status: 'ACTIVE',
      },
    });
    console.log(`Created Region: ${region.name} (${region.code})`);
  }

  // 3. Country
  let country = await prisma.country.findFirst({
    where: { regionId: region.id, code: 'JP' },
  });

  if (!country) {
    country = await prisma.country.create({
      data: {
        id: generateUuidV7(),
        regionId: region.id,
        code: 'JP',
        name: 'Japan',
        status: 'ACTIVE',
      },
    });
    console.log(`Created Country: ${country.name} (${country.code})`);
  }

  // 4. Property
  let property = await prisma.property.findUnique({
    where: { code: 'PROP-TYO-001' },
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        id: generateUuidV7(),
        countryId: country.id,
        code: 'PROP-TYO-001',
        name: 'Tokyo Grandeur Palace',
        legalName: 'Tokyo Grandeur Hospitality KK',
        status: 'ACTIVE',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
        addressLine1: '1-1-1 Marunouchi, Chiyoda-ku',
        city: 'Tokyo',
        stateProvince: 'Tokyo Prefecture',
        postalCode: '100-0005',
        phone: '+81 3 5555 0100',
        email: 'concierge@tokyograndeur.com',
      },
    });
    console.log(`Created Property: ${property.name} (${property.code})`);
  }

  // 5. Buildings & Floors
  // Building 1: Main Wing
  let mainBuilding = await prisma.building.findFirst({
    where: { propertyId: property.id, code: 'MAIN' },
  });

  if (!mainBuilding) {
    mainBuilding = await prisma.building.create({
      data: {
        id: generateUuidV7(),
        propertyId: property.id,
        code: 'MAIN',
        name: 'Main Wing',
        description: 'Central guest accommodations and historic lobby',
        status: 'ACTIVE',
      },
    });
    console.log(`Created Building: ${mainBuilding.name} (${mainBuilding.code})`);

    await prisma.floor.createMany({
      data: [
        {
          id: generateUuidV7(),
          buildingId: mainBuilding.id,
          code: 'FL-00',
          name: 'Ground Level & Grand Lobby',
          floorNumber: 0,
          status: 'ACTIVE',
        },
        {
          id: generateUuidV7(),
          buildingId: mainBuilding.id,
          code: 'FL-01',
          name: 'First Floor Suites',
          floorNumber: 1,
          status: 'ACTIVE',
        },
      ],
    });
    console.log('Created Floors for Main Wing');
  }

  // Building 2: East Tower
  let eastBuilding = await prisma.building.findFirst({
    where: { propertyId: property.id, code: 'EAST' },
  });

  if (!eastBuilding) {
    eastBuilding = await prisma.building.create({
      data: {
        id: generateUuidV7(),
        propertyId: property.id,
        code: 'EAST',
        name: 'East Tower',
        description: 'Modern executive suites and skyline wellness facilities',
        status: 'ACTIVE',
      },
    });
    console.log(`Created Building: ${eastBuilding.name} (${eastBuilding.code})`);

    await prisma.floor.createMany({
      data: [
        {
          id: generateUuidV7(),
          buildingId: eastBuilding.id,
          code: 'FL-00',
          name: 'Ground Arrival Promenade',
          floorNumber: 0,
          status: 'ACTIVE',
        },
        {
          id: generateUuidV7(),
          buildingId: eastBuilding.id,
          code: 'FL-04',
          name: 'Executive Level 4',
          floorNumber: 4,
          status: 'ACTIVE',
        },
      ],
    });
    console.log('Created Floors for East Tower');
  }

  console.log('Organization hierarchy seeding completed successfully.');
}

if (require.main === module) {
  seedOrganizationHierarchy()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      const prisma = getPrismaClient();
      await prisma.$disconnect();
    });
}
