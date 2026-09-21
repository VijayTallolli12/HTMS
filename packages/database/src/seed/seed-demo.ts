import { getPrismaClient } from '../client';
import { seedOrganizationHierarchy } from './seed-organization';
import { seedIamBaseline } from './seed-iam';
import { seedRoomTypes } from './seed-room-types';
import { seedRooms } from './seed-rooms';
import { seedRatePlans } from './seed-rate-plans';
import { seedGuests } from './seed-guests';
import { seedDemoUsers } from './seed-demo-users';
import { seedReservations } from './seed-reservations';
import { seedFolios } from './seed-folios';

export async function seedDemo(): Promise<void> {
  const prisma = getPrismaClient();
  console.log('=== HMS Demo Seed - Starting ===\n');

  console.log('--- Phase 1: Organization & IAM ---');
  await seedOrganizationHierarchy();
  await seedIamBaseline();

  const group = await prisma.hotelGroup.findUnique({ where: { code: 'HG-GLR' } });
  const property = await prisma.property.findUnique({ where: { code: 'PROP-TYO-001' } });
  if (!group || !property) { throw new Error('Organization seed incomplete - missing required entities'); }

  console.log(`\nProperty: ${property.name} (${property.code})`);
  console.log(`Timezone: ${property.timeZone}`);
  console.log(`Currency: ${property.currency}\n`);

  console.log('--- Phase 2: Room Types, Rooms, Rate Plans ---');
  const roomTypeIds = await seedRoomTypes(property.id);
  const buildings = await prisma.building.findMany({ where: { propertyId: property.id, deletedAt: null } });
  const buildingIds = buildings.map((b) => b.id);
  const floors = await prisma.floor.findMany({ where: { buildingId: { in: buildingIds }, deletedAt: null } });
  const roomIds = await seedRooms(property.id, buildings, floors, roomTypeIds);
  await seedRatePlans(property.id, roomTypeIds);
  const guestIds = await seedGuests(property.id);

  console.log('\n--- Phase 3: Demo Users ---');
  await seedDemoUsers(property.id, group.id);

  console.log('\n--- Phase 4: Reservations & Folios ---');
  await seedReservations(property.id, guestIds, roomTypeIds, roomIds);
  await seedFolios(property.id, guestIds);

  console.log('\n=== HMS Demo Seed - Complete ===\n');
  const counts = {
    roomTypes: await prisma.roomType.count({ where: { propertyId: property.id, deletedAt: null } }),
    rooms: await prisma.room.count({ where: { propertyId: property.id, deletedAt: null } }),
    ratePlans: await prisma.ratePlan.count({ where: { propertyId: property.id, deletedAt: null } }),
    guests: await prisma.guest.count({ where: { propertyId: property.id, deletedAt: null } }),
    users: await prisma.user.count({ where: { deletedAt: null } }),
    reservations: await prisma.reservation.count({ where: { propertyId: property.id, deletedAt: null } }),
    folios: await prisma.folio.count({ where: { propertyId: property.id } }),
    maintenanceBlocks: await prisma.roomMaintenanceBlock.count({ where: { propertyId: property.id, status: 'ACTIVE' } }),
  };
  console.log('Entity Counts:');
  console.log(`  Room Types:         ${counts.roomTypes}`);
  console.log(`  Rooms:              ${counts.rooms}`);
  console.log(`  Rate Plans:         ${counts.ratePlans}`);
  console.log(`  Guests:             ${counts.guests}`);
  console.log(`  Users:              ${counts.users}`);
  console.log(`  Reservations:       ${counts.reservations}`);
  console.log(`  Folios:             ${counts.folios}`);
  console.log(`  Maintenance Blocks: ${counts.maintenanceBlocks}`);
  console.log('\nDemo Users (password: Demo1234!):');
  console.log('  admin@tokyograndeur.demo  - Corporate Platform Admin');
  console.log('  fdesk@tokyograndeur.demo  - Front Desk Agent (Yuki Tanaka)');
  console.log('  hk@tokyograndeur.demo     - Housekeeping Supervisor (Chen Wei)');
  console.log('  maint@tokyograndeur.demo  - Maintenance Technician (Raj Patel)');
}

if (require.main === module) {
  seedDemo()
    .catch((e) => { console.error('Demo seed failed:', e); process.exit(1); })
    .finally(async () => { const prisma = getPrismaClient(); await prisma.$disconnect(); });
}
