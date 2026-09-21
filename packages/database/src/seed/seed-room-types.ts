import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface RoomTypeIds {
  stdId: string; dlxId: string; excId: string; suiId: string;
}

const ROOM_TYPES = [
  { code: 'STD', name: 'Standard Room', roomClass: 'STANDARD', baseOccupancy: 2, maxOccupancy: 3, maxAdults: 2, maxChildren: 1, bedConfiguration: { primary: 'KING', quantity: 1 }, amenities: ['WiFi', 'Minibar', 'Safe', 'CoffeeMaker'] },
  { code: 'DLX', name: 'Deluxe Room', roomClass: 'DELUXE', baseOccupancy: 2, maxOccupancy: 3, maxAdults: 2, maxChildren: 1, bedConfiguration: { primary: 'KING', quantity: 1, secondary: 'SOFA_BED', secondaryQty: 1 }, amenities: ['WiFi', 'Minibar', 'Safe', 'CoffeeMaker', 'Bathrobe', 'RainShower'] },
  { code: 'EXC', name: 'Executive Suite', roomClass: 'EXECUTIVE', baseOccupancy: 2, maxOccupancy: 4, maxAdults: 2, maxChildren: 2, bedConfiguration: { primary: 'KING', quantity: 1, secondary: 'QUEEN', secondaryQty: 1 }, amenities: ['WiFi', 'Minibar', 'Safe', 'CoffeeMaker', 'Bathrobe', 'RainShower', 'LoungeAccess', 'ButlerService'] },
  { code: 'SUI', name: 'Presidential Suite', roomClass: 'SUITE', baseOccupancy: 2, maxOccupancy: 4, maxAdults: 2, maxChildren: 2, bedConfiguration: { primary: 'KING', quantity: 2 }, amenities: ['WiFi', 'Minibar', 'Safe', 'CoffeeMaker', 'Bathrobe', 'RainShower', 'LoungeAccess', 'ButlerService', 'PrivatePool', 'Piano'] },
];

function getDateOffset(days: number): Date {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}

export async function seedRoomTypes(propertyId: string): Promise<RoomTypeIds> {
  const prisma = getPrismaClient();
  console.log('Seeding room types...');
  const result: Record<string, string> = {};
  for (const rt of ROOM_TYPES) {
    let existing = await prisma.roomType.findFirst({ where: { propertyId, code: rt.code } });
    if (!existing) {
      existing = await prisma.roomType.create({
        data: { id: generateUuidV7(), propertyId, code: rt.code, name: rt.name, roomClass: rt.roomClass, baseOccupancy: rt.baseOccupancy, maxOccupancy: rt.maxOccupancy, maxAdults: rt.maxAdults, maxChildren: rt.maxChildren, bedConfiguration: rt.bedConfiguration, amenities: rt.amenities, isActive: true },
      });
      console.log(`  Created RoomType: ${rt.name} (${rt.code})`);
    } else { console.log(`  RoomType exists: ${rt.name} (${rt.code})`); }
    result[rt.code] = existing.id;
  }
  const today = getDateOffset(0);
  const existingInventory = await prisma.dailyInventory.findFirst({ where: { propertyId, roomTypeId: result['STD'], businessDate: today } });
  if (!existingInventory) {
    console.log('  Creating DailyInventory for 365 days...');
    const inventoryData: Array<{ id: string; propertyId: string; roomTypeId: string; businessDate: Date; totalRooms: number }> = [];
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const businessDate = getDateOffset(dayOffset);
      for (const rt of ROOM_TYPES) { inventoryData.push({ id: generateUuidV7(), propertyId, roomTypeId: result[rt.code], businessDate, totalRooms: 0 }); }
    }
    for (let i = 0; i < inventoryData.length; i += 100) { await prisma.dailyInventory.createMany({ data: inventoryData.slice(i, i + 100), skipDuplicates: true }); }
    console.log(`  Created ${inventoryData.length} DailyInventory records`);
  } else { console.log('  DailyInventory already seeded'); }
  return { stdId: result['STD'], dlxId: result['DLX'], excId: result['EXC'], suiId: result['SUI'] };
}
