import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface ReservationIds {
  r1_today_unassigned: string; r2_today_assigned: string; r3_in_stay: string;
  r4_upcoming: string; r5_future: string; r6_departure: string;
}

function getDateOffset(days: number): Date {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}

interface ReservationDef {
  confirmationNumber: string; guestKey: string; roomTypeKey: string; ratePlanKey: string;
  arrivalDaysOffset: number; departureDaysOffset: number; adultsCount: number; childrenCount: number;
  status: string; assignedRoomKey: string | null; assignedDaysOffset: number; checkInAt: boolean;
  totalAmount: number; resultKey: keyof ReservationIds;
}

const RESERVATIONS: ReservationDef[] = [
  { confirmationNumber: 'DEMO-001', guestKey: 'guestAhmed', roomTypeKey: 'DLX', ratePlanKey: 'BAR', arrivalDaysOffset: 0, departureDaysOffset: 2, adultsCount: 2, childrenCount: 0, status: 'CONFIRMED', assignedRoomKey: null, assignedDaysOffset: 0, checkInAt: false, totalAmount: 90000, resultKey: 'r1_today_unassigned' },
  { confirmationNumber: 'DEMO-002', guestKey: 'guestDaniel', roomTypeKey: 'EXC', ratePlanKey: 'BAR', arrivalDaysOffset: 0, departureDaysOffset: 3, adultsCount: 2, childrenCount: 1, status: 'CONFIRMED', assignedRoomKey: 'room104', assignedDaysOffset: 0, checkInAt: false, totalAmount: 225000, resultKey: 'r2_today_assigned' },
  { confirmationNumber: 'DEMO-003', guestKey: 'guestSara', roomTypeKey: 'SUI', ratePlanKey: 'BAR', arrivalDaysOffset: -2, departureDaysOffset: 3, adultsCount: 2, childrenCount: 0, status: 'CHECKED_IN', assignedRoomKey: 'room105', assignedDaysOffset: -2, checkInAt: true, totalAmount: 750000, resultKey: 'r3_in_stay' },
  { confirmationNumber: 'DEMO-004', guestKey: 'guestOmar', roomTypeKey: 'DLX', ratePlanKey: 'CORP', arrivalDaysOffset: 3, departureDaysOffset: 5, adultsCount: 1, childrenCount: 0, status: 'CONFIRMED', assignedRoomKey: null, assignedDaysOffset: 3, checkInAt: false, totalAmount: 80000, resultKey: 'r4_upcoming' },
  { confirmationNumber: 'DEMO-005', guestKey: 'guestMaria', roomTypeKey: 'EXC', ratePlanKey: 'BAR', arrivalDaysOffset: 7, departureDaysOffset: 10, adultsCount: 2, childrenCount: 1, status: 'CONFIRMED', assignedRoomKey: null, assignedDaysOffset: 7, checkInAt: false, totalAmount: 225000, resultKey: 'r5_future' },
  { confirmationNumber: 'DEMO-006', guestKey: 'guestJames', roomTypeKey: 'STD', ratePlanKey: 'BAR', arrivalDaysOffset: -1, departureDaysOffset: 0, adultsCount: 1, childrenCount: 0, status: 'CHECKED_IN', assignedRoomKey: 'room001', assignedDaysOffset: -1, checkInAt: true, totalAmount: 25000, resultKey: 'r6_departure' },
];

export async function seedReservations(
  propertyId: string, guestIds: Record<string, string>,
  roomTypeIds: { stdId: string; dlxId: string; excId: string; suiId: string },
  roomIds: Record<string, string>,
): Promise<ReservationIds> {
  const prisma = getPrismaClient();
  console.log('Seeding reservations...');
  const roomTypeMap: Record<string, string> = { STD: roomTypeIds.stdId, DLX: roomTypeIds.dlxId, EXC: roomTypeIds.excId, SUI: roomTypeIds.suiId };
  const barPlan = await prisma.ratePlan.findFirst({ where: { propertyId, code: 'BAR' } });
  const corpPlan = await prisma.ratePlan.findFirst({ where: { propertyId, code: 'CORP' } });
  const ratePlanMap: Record<string, string> = { BAR: barPlan!.id, CORP: corpPlan!.id };
  const result: Record<string, string> = {};

  for (const def of RESERVATIONS) {
    let existing = await prisma.reservation.findFirst({ where: { propertyId, confirmationNumber: def.confirmationNumber } });
    if (!existing) {
      const arrivalDate = getDateOffset(def.arrivalDaysOffset);
      const departureDate = getDateOffset(def.departureDaysOffset);
      const guestId = guestIds[def.guestKey];
      const roomTypeId = roomTypeMap[def.roomTypeKey];
      const ratePlanId = ratePlanMap[def.ratePlanKey];
      const assignedRoomId = def.assignedRoomKey ? roomIds[def.assignedRoomKey] : null;
      const nights = def.departureDaysOffset - def.arrivalDaysOffset;
      const perNightRate = Math.round(def.totalAmount / nights);

      existing = await prisma.reservation.create({
        data: { id: generateUuidV7(), propertyId, confirmationNumber: def.confirmationNumber, status: def.status, guestId, roomTypeId, ratePlanId, arrivalDate, departureDate, adultsCount: def.adultsCount, childrenCount: def.childrenCount, totalAmount: def.totalAmount, currency: 'JPY', assignedRoomId, assignedAt: assignedRoomId ? getDateOffset(def.assignedDaysOffset) : null, assignedBy: assignedRoomId ? 'SYSTEM_SEED' : null, checkInAt: def.checkInAt ? getDateOffset(def.arrivalDaysOffset) : null, checkedInBy: def.checkInAt ? 'SYSTEM_SEED' : null },
      });
      console.log(`  Created Reservation: ${def.confirmationNumber} [${def.status}]`);

      const rateNightData: Array<{ id: string; propertyId: string; reservationId: string; businessDate: Date; baseRateAmount: number; totalAmount: number; currency: string }> = [];
      for (let night = 0; night < nights; night++) {
        rateNightData.push({ id: generateUuidV7(), propertyId, reservationId: existing.id, businessDate: getDateOffset(def.arrivalDaysOffset + night), baseRateAmount: perNightRate, totalAmount: perNightRate, currency: 'JPY' });
      }
      if (rateNightData.length > 0) { await prisma.reservationRateNight.createMany({ data: rateNightData }); }

      if (assignedRoomId) {
        await prisma.reservationAssignmentLog.create({
          data: { id: generateUuidV7(), propertyId, reservationId: existing.id, previousRoomId: null, newRoomId: assignedRoomId, action: 'ASSIGN', reason: 'Initial room assignment during demo seed', actorId: 'SYSTEM_SEED' },
        });
      }
      if (def.checkInAt && assignedRoomId) {
        await prisma.roomStatusLog.create({
          data: { id: generateUuidV7(), propertyId, roomId: assignedRoomId, previousHousekeepingStatus: 'INSPECTED', newHousekeepingStatus: 'INSPECTED', previousServiceStatus: 'IN_SERVICE', newServiceStatus: 'IN_SERVICE', reason: 'Room occupied during check-in (demo seed)', source: 'SYSTEM_SEED', changedBy: 'SYSTEM_SEED' },
        });
      }

    } else {
      console.log(`  Reservation exists: ${def.confirmationNumber}`);
    }
    result[def.resultKey] = existing.id;
  }

  // Reconcile bookedCount: reset all to 0, then increment for each reservation night
  console.log('  Reconciling inventory bookedCount...');
  await prisma.dailyInventory.updateMany({ where: { propertyId }, data: { bookedCount: 0, version: { increment: 1 } } });
  for (const def of RESERVATIONS) {
    const roomTypeId = roomTypeMap[def.roomTypeKey];
    const nights = def.departureDaysOffset - def.arrivalDaysOffset;
    for (let night = 0; night < nights; night++) {
      const nightDate = getDateOffset(def.arrivalDaysOffset + night);
      await prisma.dailyInventory.updateMany({
        where: { propertyId, roomTypeId, businessDate: nightDate },
        data: { bookedCount: { increment: 1 }, version: { increment: 1 } },
      });
    }
  }
  console.log('  bookedCount reconciliation complete');

  return result as ReservationIds;
}
