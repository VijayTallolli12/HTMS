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

  // 6. Middle East regional division + demo properties (W4).
  // Expansion (not replacement): Tokyo Grandeur Palace remains the canonical
  // demo anchor (HG-GLR / PROP-TYO-001) — DemoDataService allowlist, audits and
  // existing deployments depend on those keys. The Middle East properties are
  // added under the SAME hotel group so multi-property context switching,
  // per-property currency/timezone, and property-scoped authorization can be
  // demonstrated with real data.
  const meaRegion = await ensureRegion(prisma, {
    hotelGroupId: group.id,
    code: 'MEA',
    name: 'Middle East & Africa Regional Division',
    description: 'Operations across the Gulf, the Levant, and North Africa',
  });

  const uae = await ensureCountry(prisma, { regionId: meaRegion.id, code: 'AE', name: 'United Arab Emirates' });
  const sau = await ensureCountry(prisma, { regionId: meaRegion.id, code: 'SA', name: 'Saudi Arabia' });
  const qat = await ensureCountry(prisma, { regionId: meaRegion.id, code: 'QA', name: 'Qatar' });

  const dubai = await ensureProperty(prisma, {
    countryId: uae.id,
    code: 'PROP-DXB-001',
    name: 'Dubai Grand Palace',
    legalName: 'Dubai Grand Palace Hospitality LLC',
    timeZone: 'Asia/Dubai',
    currency: 'AED',
    addressLine1: 'Sheikh Zayed Road, Al Safa',
    city: 'Dubai',
    stateProvince: 'Dubai',
    postalCode: '00000',
    phone: '+971 4 555 0100',
    email: 'concierge@dubaigrandpalace.com',
  });

  const riyadh = await ensureProperty(prisma, {
    countryId: sau.id,
    code: 'PROP-RUH-001',
    name: 'Riyadh Royal Hotel',
    legalName: 'Riyadh Royal Hotel Company',
    timeZone: 'Asia/Riyadh',
    currency: 'SAR',
    addressLine1: 'King Fahd Road, Al Olaya',
    city: 'Riyadh',
    stateProvince: 'Riyadh Province',
    postalCode: '12212',
    phone: '+966 11 555 0100',
    email: 'concierge@riyadhroyal.com',
  });

  const doha = await ensureProperty(prisma, {
    countryId: qat.id,
    code: 'PROP-DOH-001',
    name: 'Doha Pearl Resort',
    legalName: 'Doha Pearl Resort W.L.L.',
    timeZone: 'Asia/Qatar',
    currency: 'QAR',
    addressLine1: 'Pearl Boulevard, West Bay Lagoon',
    city: 'Doha',
    stateProvince: 'Doha Municipality',
    postalCode: '00000',
    phone: '+974 4 555 0100',
    email: 'concierge@dohapearl.com',
  });

  // Buildings & floors for each Middle East property.
  await ensureBuildingWithFloors(prisma, dubai.id, 'MAIN', 'Palace Wing', 'Grand atrium, royal suites, and the main lobby', [
    { code: 'FL-00', name: 'Ground Level & Grand Lobby', floorNumber: 0 },
    { code: 'FL-01', name: 'Royal Club Level', floorNumber: 1 },
    { code: 'FL-05', name: 'Executive Level 5', floorNumber: 5 },
  ]);
  await ensureBuildingWithFloors(prisma, dubai.id, 'BEACH', 'Beach Resort Wing', 'Beachfront chalets and resort pool villas', [
    { code: 'FL-00', name: 'Ground Beach Promenade', floorNumber: 0 },
    { code: 'FL-02', name: 'Sea View Level 2', floorNumber: 2 },
  ]);

  await ensureBuildingWithFloors(prisma, riyadh.id, 'MAIN', 'Royal Tower', 'Business & royal floor accommodations', [
    { code: 'FL-00', name: 'Ground Level & Reception', floorNumber: 0 },
    { code: 'FL-03', name: 'Diplomatic Level 3', floorNumber: 3 },
  ]);

  await ensureBuildingWithFloors(prisma, doha.id, 'MAIN', 'Pearl Residence', 'Lagoon-facing rooms and suites', [
    { code: 'FL-00', name: 'Ground Level & Marina Lobby', floorNumber: 0 },
    { code: 'FL-02', name: 'Lagoon View Level 2', floorNumber: 2 },
  ]);

  console.log('Organization hierarchy seeding completed successfully.');
}

// ---------------------------------------------------------------------------
// W4 idempotent helpers (find-or-create; keep existing IDs).
// ---------------------------------------------------------------------------

interface EnsurePrismaLike {
  region: { findFirst: Function; create: Function };
  country: { findFirst: Function; create: Function };
  property: { findUnique: Function; create: Function };
  building: { findFirst: Function; create: Function };
  floor: { findFirst: Function; create: Function };
}

async function ensureRegion(prisma: EnsurePrismaLike, data: { hotelGroupId: string; code: string; name: string; description: string }) {
  const existing = await prisma.region.findFirst({ where: { hotelGroupId: data.hotelGroupId, code: data.code } });
  if (existing) return existing;
  const created = await prisma.region.create({
    data: { id: generateUuidV7(), hotelGroupId: data.hotelGroupId, code: data.code, name: data.name, description: data.description, status: 'ACTIVE' },
  });
  console.log(`Created Region: ${created.name} (${created.code})`);
  return created;
}

async function ensureCountry(prisma: EnsurePrismaLike, data: { regionId: string; code: string; name: string }) {
  const existing = await prisma.country.findFirst({ where: { regionId: data.regionId, code: data.code } });
  if (existing) return existing;
  const created = await prisma.country.create({
    data: { id: generateUuidV7(), regionId: data.regionId, code: data.code, name: data.name, status: 'ACTIVE' },
  });
  console.log(`Created Country: ${created.name} (${created.code})`);
  return created;
}

interface EnsurePropertyData {
  countryId: string;
  code: string;
  name: string;
  legalName: string;
  timeZone: string;
  currency: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  phone: string;
  email: string;
}

async function ensureProperty(prisma: EnsurePrismaLike, data: EnsurePropertyData) {
  const existing = await prisma.property.findUnique({ where: { code: data.code } });
  if (existing) return existing;
  const created = await prisma.property.create({
    data: {
      id: generateUuidV7(),
      countryId: data.countryId,
      code: data.code,
      name: data.name,
      legalName: data.legalName,
      status: 'ACTIVE',
      timeZone: data.timeZone,
      currency: data.currency,
      addressLine1: data.addressLine1,
      city: data.city,
      stateProvince: data.stateProvince,
      postalCode: data.postalCode,
      phone: data.phone,
      email: data.email,
    },
  });
  console.log(`Created Property: ${created.name} (${created.code}) [${created.currency}, ${created.timeZone}]`);
  return created;
}

async function ensureBuildingWithFloors(
  prisma: EnsurePrismaLike,
  propertyId: string,
  buildingCode: string,
  buildingName: string,
  buildingDescription: string,
  floors: Array<{ code: string; name: string; floorNumber: number }>,
) {
  let building = await prisma.building.findFirst({ where: { propertyId, code: buildingCode } });
  if (!building) {
    building = await prisma.building.create({
      data: { id: generateUuidV7(), propertyId, code: buildingCode, name: buildingName, description: buildingDescription, status: 'ACTIVE' },
    });
    console.log(`Created Building: ${building.name} (${building.code})`);
  }
  for (const floor of floors) {
    const existing = await prisma.floor.findFirst({ where: { buildingId: building.id, code: floor.code } });
    if (!existing) {
      await prisma.floor.create({
        data: { id: generateUuidV7(), buildingId: building.id, code: floor.code, name: floor.name, floorNumber: floor.floorNumber, status: 'ACTIVE' },
      });
    }
  }
  console.log(`Floors ensured for ${building.name}`);
  return building;
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
