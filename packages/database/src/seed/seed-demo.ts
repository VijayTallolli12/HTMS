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
import { seedFnb } from './seed-fnb';
import { seedSpa } from './seed-spa';
import { seedEvents } from './seed-events';
import { seedCrmLoyalty } from './seed-crm-loyalty';
import { seedProcurement } from './seed-procurement';
import { seedHrPayroll } from './seed-hr-payroll';

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

  // W4: Middle East demo properties under the same group (multi-property demo).
  const meaProperties = await prisma.property.findMany({
    where: { code: { in: ['PROP-DXB-001', 'PROP-RUH-001', 'PROP-DOH-001'] }, deletedAt: null },
  });
  for (const mea of meaProperties) {
    console.log(`\n=== Middle East property: ${mea.name} (${mea.code}) [${mea.currency}, ${mea.timeZone}] ===`);
    console.log('--- Room Types, Rooms, Rate Plans, Guests, Reservations ---');
    const meaRoomTypeIds = await seedRoomTypes(mea.id);
    const meaBuildings = await prisma.building.findMany({ where: { propertyId: mea.id, deletedAt: null } });
    const meaFloors = await prisma.floor.findMany({ where: { buildingId: { in: meaBuildings.map((b) => b.id) }, deletedAt: null } });
    await seedRooms(mea.id, meaBuildings, meaFloors, meaRoomTypeIds);
    await seedRatePlans(mea.id, meaRoomTypeIds);
    const meaGuestIds = await seedGuests(mea.id);
    await seedReservations(mea.id, meaGuestIds as unknown as Record<string, string>, meaRoomTypeIds, {} as Record<string, string>);
    await seedFolios(mea.id, meaGuestIds as unknown as Record<string, string>);
    await seedFnb(mea.id);
    await seedSpa(mea.id);
    await seedCrmLoyalty(mea.id);
  }
  if (meaProperties.length > 0) {
    console.log(`\nMiddle East demo properties processed: ${meaProperties.length}/3`);
  }

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
  await seedReservations(property.id, guestIds as unknown as Record<string, string>, roomTypeIds, roomIds as unknown as Record<string, string>);
  await seedFolios(property.id, guestIds as unknown as Record<string, string>);

  console.log('\n--- Phase 5: Food & Beverage / Restaurant ---');
  await seedFnb(property.id);

  console.log('\n--- Phase 6: Spa Operations ---');
  await seedSpa(property.id);

  console.log('\n--- Phase 7: Events & Banquets ---');
  await seedEvents(property.id);

  console.log('\n--- Phase 8: CRM & Loyalty ---');
  await seedCrmLoyalty(property.id);

  console.log('\n--- Phase 9: Procurement & Inventory ---');
  try {
    await seedProcurement(property.id);
  } catch (err: any) {
    // Known migration debt: pms_schema.suppliers / purchase_orders tables are
    // absent on databases built purely from migrations (demo/remove 500s for
    // the same reason). Degrade gracefully instead of failing the whole seed.
    console.warn(`Procurement seed skipped (migration debt): ${String(err?.message ?? err).split('\n')[0]}`);
  }

  console.log('\n--- Phase 10: HR & Payroll ---');
  try {
    await seedHrPayroll(property.id);
  } catch (err: any) {
    console.warn(`HR/payroll seed skipped (migration debt): ${String(err?.message ?? err).split('\n')[0]}`);
  }

  console.log('\n=== HMS Demo Seed - Complete ===\n');
  // Procurement/HR tables may be absent on migration-only databases (known
  // migration debt); the summary must not fail because of them.
  const safeCount = async (fn: () => Promise<number>): Promise<number> => {
    try { return await fn(); } catch { return -1; }
  };
  const counts = {
    roomTypes: await safeCount(() => prisma.roomType.count({ where: { propertyId: property.id, deletedAt: null } })),
    rooms: await safeCount(() => prisma.room.count({ where: { propertyId: property.id, deletedAt: null } })),
    ratePlans: await safeCount(() => prisma.ratePlan.count({ where: { propertyId: property.id, deletedAt: null } })),
    guests: await safeCount(() => prisma.guest.count({ where: { propertyId: property.id, deletedAt: null } })),
    users: await safeCount(() => prisma.user.count({ where: { deletedAt: null } })),
    reservations: await safeCount(() => prisma.reservation.count({ where: { propertyId: property.id, deletedAt: null } })),
    folios: await safeCount(() => prisma.folio.count({ where: { propertyId: property.id } })),
    maintenanceBlocks: await safeCount(() => prisma.roomMaintenanceBlock.count({ where: { propertyId: property.id, status: 'ACTIVE' } })),
    suppliers: await safeCount(() => prisma.supplier.count({ where: { propertyId: property.id, deletedAt: null } })),
    inventoryItems: await safeCount(() => prisma.inventoryItem.count({ where: { propertyId: property.id, deletedAt: null } })),
    purchaseOrders: await safeCount(() => prisma.purchaseOrder.count({ where: { propertyId: property.id, deletedAt: null } })),
    goodsReceipts: await safeCount(() => prisma.goodsReceipt.count({ where: { propertyId: property.id, deletedAt: null } })),
    stockBalances: await safeCount(() => prisma.stockBalance.count({ where: { propertyId: property.id, deletedAt: null } })),
    employees: await safeCount(() => prisma.employee.count({ where: { propertyId: property.id, deletedAt: null } })),
    payrollPeriods: await safeCount(() => prisma.payrollPeriod.count({ where: { propertyId: property.id, deletedAt: null } })),
    payrollRuns: await safeCount(() => prisma.payrollRun.count({ where: { propertyId: property.id, deletedAt: null } })),
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
  console.log(`  Suppliers:          ${counts.suppliers}`);
  console.log(`  Inventory Items:    ${counts.inventoryItems}`);
  console.log(`  Purchase Orders:    ${counts.purchaseOrders}`);
  console.log(`  Goods Receipts:     ${counts.goodsReceipts}`);
  console.log(`  Stock Balances:     ${counts.stockBalances}`);
  console.log(`  Employees:          ${counts.employees}`);
  console.log(`  Payroll Periods:    ${counts.payrollPeriods}`);
  console.log(`  Payroll Runs:       ${counts.payrollRuns}`);
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
