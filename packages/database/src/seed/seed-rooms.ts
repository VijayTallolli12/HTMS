import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface RoomIds {
  room101: string; room102: string; room103: string; room104: string; room105: string;
  room401: string; room402: string; room403: string; room404: string; room405: string;
  room001: string; room002: string; room003: string; room004: string; room005: string;
}

function getDateOffset(days: number): Date {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}

const ROOM_DEFS = [
  { roomNumber: '101', name: 'Presidential Suite 101', roomTypeCode: 'SUI', buildingCode: 'MAIN', floorCode: 'FL-01', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '102', name: 'Presidential Suite 102', roomTypeCode: 'SUI', buildingCode: 'MAIN', floorCode: 'FL-01', housekeepingStatus: 'CLEAN', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '103', name: 'Executive Room 103', roomTypeCode: 'EXC', buildingCode: 'MAIN', floorCode: 'FL-01', housekeepingStatus: 'DIRTY', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '104', name: 'Executive Room 104', roomTypeCode: 'EXC', buildingCode: 'MAIN', floorCode: 'FL-01', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '105', name: 'Executive Room 105', roomTypeCode: 'EXC', buildingCode: 'MAIN', floorCode: 'FL-01', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'OCCUPIED', maintenanceBlock: null },
  { roomNumber: '401', name: 'Executive Suite 401', roomTypeCode: 'EXC', buildingCode: 'EAST', floorCode: 'FL-04', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '402', name: 'Deluxe Room 402', roomTypeCode: 'DLX', buildingCode: 'EAST', floorCode: 'FL-04', housekeepingStatus: 'CLEAN', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '403', name: 'Deluxe Room 403', roomTypeCode: 'DLX', buildingCode: 'EAST', floorCode: 'FL-04', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '404', name: 'Deluxe Room 404', roomTypeCode: 'DLX', buildingCode: 'EAST', floorCode: 'FL-04', housekeepingStatus: 'DIRTY', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '405', name: 'Deluxe Room 405', roomTypeCode: 'DLX', buildingCode: 'EAST', floorCode: 'FL-04', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '001', name: 'Standard Room 001', roomTypeCode: 'STD', buildingCode: 'MAIN', floorCode: 'FL-00', housekeepingStatus: 'INSPECTED', serviceStatus: 'IN_SERVICE', occupancyStatus: 'OCCUPIED', maintenanceBlock: null },
  { roomNumber: '002', name: 'Standard Room 002', roomTypeCode: 'STD', buildingCode: 'MAIN', floorCode: 'FL-00', housekeepingStatus: 'CLEAN', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '003', name: 'Standard Room 003', roomTypeCode: 'STD', buildingCode: 'MAIN', floorCode: 'FL-00', housekeepingStatus: 'INSPECTED', serviceStatus: 'OUT_OF_ORDER', occupancyStatus: 'VACANT', maintenanceBlock: { type: 'OUT_OF_ORDER', reason: 'Plumbing repair', endDays: 5 } },
  { roomNumber: '004', name: 'Standard Room 004', roomTypeCode: 'STD', buildingCode: 'MAIN', floorCode: 'FL-00', housekeepingStatus: 'DIRTY', serviceStatus: 'IN_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: null },
  { roomNumber: '005', name: 'Standard Room 005', roomTypeCode: 'STD', buildingCode: 'MAIN', floorCode: 'FL-00', housekeepingStatus: 'INSPECTED', serviceStatus: 'OUT_OF_SERVICE', occupancyStatus: 'VACANT', maintenanceBlock: { type: 'OUT_OF_SERVICE', reason: 'AC maintenance', endDays: 2 } },
];

export async function seedRooms(propertyId: string, buildings: Array<{ id: string; code: string }>, floors: Array<{ id: string; buildingId: string; code: string }>, roomTypeIds: { stdId: string; dlxId: string; excId: string; suiId: string }): Promise<RoomIds> {
  const prisma = getPrismaClient();
  console.log('Seeding rooms...');
  const buildingMap = new Map(buildings.map((b) => [b.code, b.id]));
  const floorMap = new Map(floors.map((f) => [`${f.buildingId}:${f.code}`, f.id]));
  const rtMap: Record<string, string> = { STD: roomTypeIds.stdId, DLX: roomTypeIds.dlxId, EXC: roomTypeIds.excId, SUI: roomTypeIds.suiId };
  const result: Record<string, string> = {};
  const today = getDateOffset(0);

  for (const def of ROOM_DEFS) {
    const buildingId = buildingMap.get(def.buildingCode)!;
    const floorId = floorMap.get(`${buildingId}:${def.floorCode}`)!;
    const roomTypeId = rtMap[def.roomTypeCode];
    let existing = await prisma.room.findFirst({ where: { propertyId, roomNumber: def.roomNumber } });
    if (!existing) {
      existing = await prisma.room.create({ data: { id: generateUuidV7(), propertyId, buildingId, floorId, roomTypeId, roomNumber: def.roomNumber, name: def.name, housekeepingStatus: def.housekeepingStatus, serviceStatus: def.serviceStatus, occupancyStatus: def.occupancyStatus, isActive: true } });
      console.log(`  Created Room: ${def.roomNumber} [${def.housekeepingStatus}/${def.serviceStatus}/${def.occupancyStatus}]`);
    } else { console.log(`  Room exists: ${def.roomNumber}`); }
    result[`room${def.roomNumber}`] = existing.id;

    if (def.maintenanceBlock) {
      const existingBlock = await prisma.roomMaintenanceBlock.findFirst({ where: { propertyId, roomId: existing.id, status: 'ACTIVE' } });
      if (!existingBlock) {
        await prisma.roomMaintenanceBlock.create({ data: { id: generateUuidV7(), propertyId, roomId: existing.id, type: def.maintenanceBlock.type, reason: def.maintenanceBlock.reason, startDate: today, endDate: getDateOffset(def.maintenanceBlock.endDays), status: 'ACTIVE', createdBy: 'SYSTEM_SEED' } });
        console.log(`  Created MaintenanceBlock: Room ${def.roomNumber} [${def.maintenanceBlock.type}]`);
      }
      const rtId = rtMap[def.roomTypeCode];
      for (let day = 0; day <= def.maintenanceBlock.endDays; day++) {
        const updateData = def.maintenanceBlock.type === 'OUT_OF_ORDER' ? { outOfOrderCount: { increment: 1 } } : { outOfServiceCount: { increment: 1 } };
        await prisma.dailyInventory.updateMany({ where: { propertyId, roomTypeId: rtId, businessDate: getDateOffset(day) }, data: updateData });
      }
    }
  }
  // Ensure occupied rooms have correct occupancyStatus (idempotent)
  const occupiedRooms = ROOM_DEFS.filter((d) => d.occupancyStatus === 'OCCUPIED');
  for (const def of occupiedRooms) {
    const roomId = result[`room${def.roomNumber}`];
    if (roomId) {
      const updated = await prisma.room.updateMany({ where: { id: roomId, propertyId, occupancyStatus: { not: 'OCCUPIED' } }, data: { occupancyStatus: 'OCCUPIED' } });
      if (updated.count > 0) { console.log(`  Updated Room ${def.roomNumber} -> OCCUPIED`); }
    }
  }

  const roomCounts: Record<string, number> = {};
  for (const def of ROOM_DEFS) { roomCounts[def.roomTypeCode] = (roomCounts[def.roomTypeCode] || 0) + 1; }
  for (const [code, count] of Object.entries(roomCounts)) { await prisma.dailyInventory.updateMany({ where: { propertyId, roomTypeId: rtMap[code] }, data: { totalRooms: count } }); }
  console.log('  Updated DailyInventory totalRooms');
  return result as RoomIds;
}
