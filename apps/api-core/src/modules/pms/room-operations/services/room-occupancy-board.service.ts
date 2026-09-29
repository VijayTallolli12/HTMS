import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';

/**
 * W4 occupancy board: aggregates REAL operational data per room for the
 * Room Availability card UX.
 *
 * Data sources (no fabricated values):
 * - Reservation (assignedRoomId, status IN_HOUSE)  → guest stay context
 * - Guest                                          → guest name
 * - Folio (reservationId)                          → balance / currency
 * - FnbOrder (reservationId)                       → F&B activity + spend
 * - SpaAppointment (reservationId)                 → spa bookings
 * - RoomType.bedConfiguration                      → bed configuration
 * - RoomMaintenanceBlock (ACTIVE)                  → OOO/OOS indicator
 * - HousekeepingTask (open)                        → cleaning state
 *
 * All amounts are reported in the property currency (real configuration).
 */
@Injectable()
export class RoomOccupancyBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
  ) {}

  async getBoard(propertyId: string): Promise<OccupancyBoardDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, currency: true, timeZone: true, deletedAt: true },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const businessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);
    const now = new Date();

    const rooms = await this.prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: { roomNumber: 'asc' },
      select: {
        id: true,
        roomNumber: true,
        occupancyStatus: true,
        housekeepingStatus: true,
        serviceStatus: true,
        roomTypeId: true,
        floorId: true,
        roomType: { select: { id: true, code: true, name: true, bedConfiguration: true } },
      },
    });

    const inHouseReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        deletedAt: null,
        assignedRoomId: { not: null },
        status: { in: ['IN_HOUSE', 'CHECKED_IN'] },
      },
      select: {
        id: true,
        assignedRoomId: true,
        arrivalDate: true,
        departureDate: true,
        confirmationNumber: true,
        guestId: true,
        guest: {
          select: { id: true, firstName: true, lastName: true, crmProfileId: true },
        },
      },
    });

    const reservationIds = inHouseReservations.map((r) => r.id);

    const [folios, fnbOrders, spaAppointments, openHousekeeping, activeBlocks] = await Promise.all([
      reservationIds.length
        ? this.prisma.folio.findMany({
            where: { propertyId, reservationId: { in: reservationIds } },
            select: { reservationId: true, balance: true, currency: true, status: true },
          })
        : Promise.resolve([] as Array<{ reservationId: string; balance: unknown; currency: string; status: string }>),
      reservationIds.length
        ? this.prisma.fnbOrder.findMany({
            where: { propertyId, reservationId: { in: reservationIds }, status: { notIn: ['CANCELLED'] } },
            select: {
              reservationId: true,
              status: true,
              totalAmount: true,
              currency: true,
              createdAt: true,
              items: { select: { quantity: true } },
            },
          })
        : Promise.resolve([]),
      reservationIds.length
        ? this.prisma.spaAppointment.findMany({
            where: { propertyId, reservationId: { in: reservationIds }, status: { notIn: ['CANCELLED'] } },
            select: { reservationId: true, status: true, startTime: true, price: true, currency: true },
          })
        : Promise.resolve([]),
      this.prisma.housekeepingTask.findMany({
        where: { propertyId, status: { in: ['PENDING', 'IN_PROGRESS'] }, taskType: 'CLEANING' },
        select: { roomId: true, status: true },
      }),
      this.prisma.roomMaintenanceBlock.findMany({
        where: { propertyId, status: 'ACTIVE', deletedAt: null },
        select: { roomId: true, type: true, reason: true, startDate: true, endDate: true },
      }),
    ]);

    // Aggregate per reservation
    const folioByRes = new Map<string, { balance: number; currency: string; status: string }>();
    for (const f of folios) {
      const prev = folioByRes.get(f.reservationId);
      const balance = Number(f.balance);
      if (!prev || balance > prev.balance) {
        folioByRes.set(f.reservationId, { balance, currency: f.currency, status: f.status });
      }
    }

    const fnbByRes = new Map<string, { orders: number; total: number; currency: string; hasActiveOrder: boolean }>();
    for (const o of fnbOrders) {
      if (!o.reservationId) continue;
      const agg = fnbByRes.get(o.reservationId) ?? { orders: 0, total: 0, currency: o.currency, hasActiveOrder: false };
      agg.orders += 1;
      agg.total += Number(o.totalAmount);
      if (['OPEN', 'ORDERED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)) {
        agg.hasActiveOrder = true;
      }
      fnbByRes.set(o.reservationId, agg);
    }

    const spaByRes = new Map<string, { bookings: number; total: number; currency: string; upcoming: number }>();
    for (const a of spaAppointments) {
      if (!a.reservationId) continue;
      const agg = spaByRes.get(a.reservationId) ?? { bookings: 0, total: 0, currency: a.currency, upcoming: 0 };
      agg.bookings += 1;
      agg.total += Number(a.price);
      if (a.startTime >= now && ['SCHEDULED', 'CONFIRMED'].includes(a.status)) {
        agg.upcoming += 1;
      }
      spaByRes.set(a.reservationId, agg);
    }

    const resByRoom = new Map<string, (typeof inHouseReservations)[number]>();
    for (const r of inHouseReservations) {
      if (r.assignedRoomId && !resByRoom.has(r.assignedRoomId)) {
        resByRoom.set(r.assignedRoomId, r);
      }
    }
    const hkByRoom = new Map(openHousekeeping.map((t) => [t.roomId, t.status]));
    const blockByRoom = new Map(activeBlocks.map((b) => [b.roomId, b]));

    const cards: OccupancyRoomCardDto[] = rooms.map((room) => {
      const reservation = resByRoom.get(room.id) ?? null;
      const folio = reservation ? folioByRes.get(reservation.id) ?? null : null;
      const fnb = reservation ? fnbByRes.get(reservation.id) ?? null : null;
      const spa = reservation ? spaByRes.get(reservation.id) ?? null : null;
      const block = blockByRoom.get(room.id) ?? null;

      let effectiveStatus: 'OCCUPIED' | 'VACANT' | 'DIRTY' | 'CLEAN' | 'INSPECTED' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
      if (block) {
        effectiveStatus = block.type === 'OUT_OF_ORDER' ? 'OUT_OF_ORDER' : 'OUT_OF_SERVICE';
      } else if (reservation) {
        effectiveStatus = 'OCCUPIED';
      } else if (room.housekeepingStatus === 'DIRTY') {
        effectiveStatus = 'DIRTY';
      } else if (room.housekeepingStatus === 'CLEAN') {
        effectiveStatus = 'CLEAN';
      } else {
        effectiveStatus = 'INSPECTED';
      }

      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        floorId: room.floorId,
        status: effectiveStatus,
        occupancyStatus: room.occupancyStatus,
        housekeepingStatus: room.housekeepingStatus,
        serviceStatus: room.serviceStatus,
        housekeepingTaskActive: hkByRoom.get(room.id) ?? null,
        maintenance: block ? { type: block.type, reason: block.reason, endDate: block.endDate.toISOString().slice(0, 10) } : null,
        roomType: {
          id: room.roomType.id,
          code: room.roomType.code,
          name: room.roomType.name,
          bedConfiguration: (room.roomType.bedConfiguration as Record<string, unknown>) ?? null,
        },
        guest: reservation
          ? {
              name: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
              isLoyaltyMember: Boolean(reservation.guest.crmProfileId),
            }
          : null,
        stay: reservation
          ? {
              confirmationNumber: reservation.confirmationNumber,
              arrivalDate: reservation.arrivalDate.toISOString().slice(0, 10),
              departureDate: reservation.departureDate.toISOString().slice(0, 10),
            }
          : null,
        folio: folio ? { balance: folio.balance, currency: folio.currency, status: folio.status } : null,
        fnb: fnb ? { orders: fnb.orders, total: fnb.total, currency: fnb.currency, hasActiveOrder: fnb.hasActiveOrder } : null,
        spa: spa ? { bookings: spa.bookings, total: spa.total, currency: spa.currency, upcoming: spa.upcoming } : null,
      };
    });

    const summary = {
      total: cards.length,
      occupied: cards.filter((c) => c.status === 'OCCUPIED').length,
      vacant: cards.filter((c) => ['VACANT', 'CLEAN', 'INSPECTED'].includes(c.status)).length,
      dirty: cards.filter((c) => c.status === 'DIRTY').length,
      outOfOrder: cards.filter((c) => ['OUT_OF_ORDER', 'OUT_OF_SERVICE'].includes(c.status)).length,
    };

    return { businessDate: businessDate.toISOString().slice(0, 10), currency: property.currency, timeZone: property.timeZone, summary, rooms: cards };
  }
}

export interface OccupancyRoomCardDto {
  roomId: string;
  roomNumber: string;
  floorId: string;
  status: 'OCCUPIED' | 'VACANT' | 'DIRTY' | 'CLEAN' | 'INSPECTED' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
  occupancyStatus: string;
  housekeepingStatus: string;
  serviceStatus: string;
  housekeepingTaskActive: string | null;
  maintenance: { type: string; reason: string | null; endDate: string } | null;
  roomType: { id: string; code: string; name: string; bedConfiguration: Record<string, unknown> | null };
  guest: { name: string; isLoyaltyMember: boolean } | null;
  stay: { confirmationNumber: string; arrivalDate: string; departureDate: string } | null;
  folio: { balance: number; currency: string; status: string } | null;
  fnb: { orders: number; total: number; currency: string; hasActiveOrder: boolean } | null;
  spa: { bookings: number; total: number; currency: string; upcoming: number } | null;
}

export interface OccupancyBoardDto {
  businessDate: string;
  currency: string;
  timeZone: string;
  summary: { total: number; occupied: number; vacant: number; dirty: number; outOfOrder: number };
  rooms: OccupancyRoomCardDto[];
}
