import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { AtsCalculatorService } from '../../inventory/services/ats-calculator.service';
import {
  RevenueKpiDto,
  RevenueKpiRangeResponse,
  OccupancyTrendResponse,
  AdrTrendResponse,
  RevenueTrendResponse,
  PickupAnalysisResponse,
  PickupByRoomTypeResponse,
  RoomTypePerformanceResponse,
  RevenueByDepartmentResponse,
  ForecastResponse,
  MarketRateProviderConfigDto,
  MarketRateDto,
  MarketRateResponse,
  PricingRecommendationResponse,
  CompetitorSetDto,
  CompetitorSetResponse,
  CreateMarketRateProviderRequest,
  UpdateMarketRateProviderRequest,
  CreateCompetitorSetRequest,
  UpdateCompetitorSetRequest,
} from '@hms/api-contracts';
import { generateUuidV7 } from '@hms/shared';

function toUtcMidnight(dateInput: string | Date): Date {
  const str = typeof dateInput === 'string' ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

function formatDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function decimalToString(d: Prisma.Decimal | number | string | null | undefined): string {
  if (d === null || d === undefined) return '0.00';
  if (typeof d === 'number') return d.toFixed(2);
  if (typeof d === 'string') return Number(d).toFixed(2);
  return d.toFixed(2);
}

function stringToDecimal(s: string): Prisma.Decimal {
  return new Prisma.Decimal(s);
}

function pruneDecimal(d: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(d.toFixed(2));
}

@Injectable()
export class RevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    private readonly inventoryService: InventoryService,
    private readonly atsCalculator: AtsCalculatorService,
  ) {}

  // ==========================================
  // REVENUE KPIs
  // ==========================================
  async getKpiRange(propertyId: string, startDate: string, endDate: string): Promise<RevenueKpiRangeResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    if (start > end) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    // Fetch daily inventory records
    const dailyInventories = await this.prisma.dailyInventory.findMany({
      where: {
        propertyId,
        businessDate: { gte: start, lte: end },
      },
      orderBy: { businessDate: 'asc' },
    });

    // Fetch daily rates for ADR calculation
    const dailyRates = await this.prisma.dailyRate.findMany({
      where: {
        propertyId,
        businessDate: { gte: start, lte: end },
      },
    });

    // Fetch reservations for room revenue
    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        arrivalDate: { lte: end },
        departureDate: { gte: start },
      },
      include: {
        rateNights: {
          where: {
            businessDate: { gte: start, lte: end },
          },
        },
      },
    });

    // Fetch folio transactions for revenue by department
    const folioTransactions = await this.prisma.folioTransaction.findMany({
      where: {
        folio: { propertyId },
        postedAt: { gte: start, lte: end },
      },
      include: { folio: true },
    });

    // Group daily inventories by date
    const inventoryByDate = new Map<string, typeof dailyInventories>();
    for (const inv of dailyInventories) {
      const dateStr = formatDateString(inv.businessDate);
      if (!inventoryByDate.has(dateStr)) {
        inventoryByDate.set(dateStr, []);
      }
      inventoryByDate.get(dateStr)!.push(inv);
    }

    // Group daily rates by date
    const ratesByDate = new Map<string, typeof dailyRates>();
    for (const rate of dailyRates) {
      const dateStr = formatDateString(rate.businessDate);
      if (!ratesByDate.has(dateStr)) {
        ratesByDate.set(dateStr, []);
      }
      ratesByDate.get(dateStr)!.push(rate);
    }

    // Calculate KPIs for each date
    const dataPoints: RevenueKpiDto[] = [];
    const dateRange: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      dateRange.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    let totalOccupancy = 0;
    let totalAdr = new Prisma.Decimal(0);
    let totalRevpar = new Prisma.Decimal(0);
    let totalRoomRevenue = new Prisma.Decimal(0);
    let totalPickup = new Prisma.Decimal(0);
    let validDays = 0;

    for (const date of dateRange) {
      const dateStr = formatDateString(date);
      const inventories = inventoryByDate.get(dateStr) || [];
      const rates = ratesByDate.get(dateStr) || [];

      // Calculate totals from inventory
      const totalRooms = inventories.reduce((sum, inv) => sum + inv.totalRooms, 0);
      const totalBooked = inventories.reduce((sum, inv) => sum + inv.bookedCount, 0);
      const totalOutOfOrder = inventories.reduce((sum, inv) => sum + inv.outOfOrderCount, 0);
      const totalOutOfService = inventories.reduce((sum, inv) => sum + inv.outOfServiceCount, 0);
      const totalAvailable = inventories.reduce((sum, inv) => {
        const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
        return sum + ats;
      }, 0);
      const occupiedRooms = totalBooked;
      const occupancyPercent = totalAvailable > 0 ? Math.round((occupiedRooms / totalAvailable) * 100 * 100) / 100 : 0;

      // Calculate ADR from actual reservations (more accurate than rates)
      const relevantReservations = reservations.filter((r) => {
        const arr = toUtcMidnight(r.arrivalDate);
        const dep = toUtcMidnight(r.departureDate);
        return arr <= date && date < dep;
      });

      let roomRevenue = new Prisma.Decimal(0);
      let occupiedRoomNights = 0;

      for (const res of relevantReservations) {
        for (const rn of res.rateNights) {
          if (formatDateString(rn.businessDate) === dateStr) {
            roomRevenue = roomRevenue.add(rn.totalAmount);
            occupiedRoomNights++;
          }
        }
      }

      const adr = occupiedRoomNights > 0 ? roomRevenue.div(occupiedRoomNights) : new Prisma.Decimal(0);
      const revpar = totalAvailable > 0 ? roomRevenue.div(totalAvailable) : new Prisma.Decimal(0);

      // Pickup calculation (new bookings on this date minus cancellations)
      const newBookingsToday = await this.prisma.reservation.count({
        where: {
          propertyId,
          createdAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        },
      });

      const cancellationsToday = await this.prisma.reservation.count({
        where: {
          propertyId,
          status: 'CANCELLED',
          updatedAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
        },
      });

      const pickup = newBookingsToday - cancellationsToday;
      const pickupPercent = totalAvailable > 0 ? Math.round((pickup / totalAvailable) * 10000) / 100 : 0;

      // Forecast occupancy (simple deterministic: based on current booking pace)
      const futureDate = new Date(date);
      futureDate.setUTCDate(futureDate.getUTCDate() + 7);
      const futureBookings = await this.prisma.reservation.count({
        where: {
          propertyId,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          arrivalDate: { lte: futureDate },
          departureDate: { gt: date },
        },
      });
      const forecastOccupancy = totalAvailable > 0 ? Math.round((futureBookings / totalAvailable) * 10000) / 100 : 0;

      const kpi: RevenueKpiDto = {
        propertyId,
        businessDate: dateStr,
        occupancyPercent,
        adr: decimalToString(adr),
        revpar: decimalToString(revpar),
        roomRevenue: decimalToString(roomRevenue),
        totalAvailableRooms: totalAvailable,
        totalBookedRooms: occupiedRooms,
        totalOutOfOrderRooms: totalOutOfOrder,
        totalOutOfServiceRooms: totalOutOfService,
        pickup: decimalToString(pickup),
        pickupPercent,
        forecastOccupancyPercent: forecastOccupancy,
        createdAt: new Date().toISOString(),
      };

      dataPoints.push(kpi);

      totalOccupancy += occupancyPercent;
      totalAdr = totalAdr.add(adr);
      totalRevpar = totalRevpar.add(revpar);
      totalRoomRevenue = totalRoomRevenue.add(roomRevenue);
      totalPickup = totalPickup.add(pickup);
      validDays++;
    }

    const summary = {
      avgOccupancy: validDays > 0 ? Math.round((totalOccupancy / validDays) * 100) / 100 : 0,
      avgAdr: validDays > 0 ? decimalToString(totalAdr.div(validDays)) : '0.00',
      avgRevpar: validDays > 0 ? decimalToString(totalRevpar.div(validDays)) : '0.00',
      totalRoomRevenue: decimalToString(totalRoomRevenue),
      totalPickup: decimalToString(totalPickup),
    };

    return { propertyId, dataPoints, summary };
  }

  async getOccupancyTrend(propertyId: string, startDate: string, endDate: string): Promise<OccupancyTrendResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    const dailyInventories = await this.prisma.dailyInventory.findMany({
      where: { propertyId, businessDate: { gte: start, lte: end } },
      orderBy: { businessDate: 'asc' },
    });

    const byDate = new Map<string, typeof dailyInventories>();
    for (const inv of dailyInventories) {
      const ds = formatDateString(inv.businessDate);
      if (!byDate.has(ds)) byDate.set(ds, []);
      byDate.get(ds)!.push(inv);
    }

    const data = [];
    let current = new Date(start);
    while (current <= end) {
      const ds = formatDateString(current);
      const inventories = byDate.get(ds) || [];
      const totalRooms = inventories.reduce((sum, inv) => sum + inv.totalRooms, 0);
      const totalBooked = inventories.reduce((sum, inv) => sum + inv.bookedCount, 0);
      const totalAvailable = inventories.reduce((sum, inv) => {
        const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
        return sum + ats;
      }, 0);
      const occupancyPercent = totalAvailable > 0 ? Math.round((totalBooked / totalAvailable) * 10000) / 100 : 0;

      data.push({
        date: ds,
        occupancyPercent,
        availableRooms: totalAvailable,
        occupiedRooms: totalBooked,
        bookedRooms: totalBooked,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data };
  }

  async getAdrTrend(propertyId: string, startDate: string, endDate: string): Promise<AdrTrendResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    const dailyInventories = await this.prisma.dailyInventory.findMany({
      where: { propertyId, businessDate: { gte: start, lte: end } },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        arrivalDate: { lte: end },
        departureDate: { gte: start },
      },
      include: { rateNights: true },
    });

    const byDate = new Map<string, { revenue: Prisma.Decimal; occupied: number }>();
    for (const res of reservations) {
      for (const rn of res.rateNights) {
        const ds = formatDateString(rn.businessDate);
        const d = new Date(rn.businessDate);
        if (d >= start && d <= end) {
          if (!byDate.has(ds)) byDate.set(ds, { revenue: new Prisma.Decimal(0), occupied: 0 });
          const entry = byDate.get(ds)!;
          entry.revenue = entry.revenue.add(rn.totalAmount);
          entry.occupied++;
        }
      }
    }

    const dailyInventoriesMap = new Map<string, number>();
    for (const inv of dailyInventories) {
      const ds = formatDateString(inv.businessDate);
      const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
      dailyInventoriesMap.set(ds, (dailyInventoriesMap.get(ds) || 0) + ats);
    }

    const data: Array<{ date: string; adr: string; roomRevenue: string; occupiedRooms: number }> = [];
    let current = new Date(start);
    while (current <= end) {
      const ds = formatDateString(current);
      const entry = byDate.get(ds);
      const available = dailyInventoriesMap.get(ds) || 0;
      const occupied = entry?.occupied || 0;
      const revenue = entry?.revenue || new Prisma.Decimal(0);
      const adr = occupied > 0 ? revenue.div(occupied) : new Prisma.Decimal(0);

      data.push({
        date: ds,
        adr: decimalToString(adr),
        roomRevenue: decimalToString(revenue),
        occupiedRooms: occupied,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data };
  }

  async getRevenueTrend(propertyId: string, startDate: string, endDate: string): Promise<RevenueTrendResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    const occupancyTrend = await this.getOccupancyTrend(propertyId, startDate, endDate);
    const adrTrend = await this.getAdrTrend(propertyId, startDate, endDate);

    const occMap = new Map(occupancyTrend.data.map((d) => [d.date, d.occupancyPercent]));
    const adrMap = new Map(adrTrend.data.map((d) => [d.date, d.adr]));

    const data = [];
    for (const occ of occupancyTrend.data) {
      data.push({
        date: occ.date,
        roomRevenue: adrMap.get(occ.date) ? decimalToString(stringToDecimal(adrMap.get(occ.date)!).mul(occ.occupiedRooms)) : '0.00',
        occupancyPercent: occ.occupancyPercent,
        adr: adrMap.get(occ.date) || '0.00',
      });
    }

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data };
  }

  // ==========================================
  // PICKUP ANALYSIS
  // ==========================================
  async getPickupAnalysis(propertyId: string, startDate: string, endDate: string): Promise<PickupAnalysisResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    if (start > end) throw new BadRequestException('startDate cannot be after endDate');

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    });

    const cancellations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CANCELLED',
        updatedAt: { gte: start, lte: end },
      },
    });

    // Group by createdAt date
    const bookingsByDate = new Map<string, number>();
    for (const res of reservations) {
      const ds = formatDateString(res.createdAt);
      bookingsByDate.set(ds, (bookingsByDate.get(ds) || 0) + 1);
    }

    const cancellationsByDate = new Map<string, number>();
    for (const res of cancellations) {
      const ds = formatDateString(res.updatedAt);
      cancellationsByDate.set(ds, (cancellationsByDate.get(ds) || 0) + 1);
    }

    // Get total available rooms for pace calculation
    const totalAvailableAgg = await this.prisma.dailyInventory.aggregate({
      where: { propertyId },
      _sum: { totalRooms: true },
    });

    const totalRooms = totalAvailableAgg._sum.totalRooms || 0;

    const data = [];
    let cumulativeBooked = 0;
    let totalNewBookings = 0;
    let totalCancellations = 0;

    let current = new Date(start);
    while (current <= end) {
      const ds = formatDateString(current);
      const newBookings = bookingsByDate.get(ds) || 0;
      const cancels = cancellationsByDate.get(ds) || 0;
      const netPickup = newBookings - cancels;

      cumulativeBooked += netPickup;
      totalNewBookings += newBookings;
      totalCancellations += cancels;

      // 7-day rolling booking pace
      let rollingBookings = 0;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(current);
        checkDate.setUTCDate(checkDate.getUTCDate() - i);
        const cds = formatDateString(checkDate);
        rollingBookings += bookingsByDate.get(cds) || 0;
      }
      const bookingPace = rollingBookings / 7;

      // Occupancy pace (7-day rolling)
      let rollingOccupancy = 0;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(current);
        checkDate.setUTCDate(checkDate.getUTCDate() - i);
        const inv = await this.prisma.dailyInventory.findFirst({
          where: { propertyId, businessDate: checkDate },
        });
        if (inv) {
          const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
          rollingOccupancy += (inv.bookedCount / Math.max(ats, 1)) * 100;
        }
      }
      const occupancyPace = rollingOccupancy / 7;

      // Booking window (average days between booking and arrival for new bookings on this date)
      let bookingWindowSum = 0;
      let bookingWindowCount = 0;
      for (const res of reservations) {
        if (formatDateString(res.createdAt) === ds) {
          const arr = toUtcMidnight(res.arrivalDate);
          const created = toUtcMidnight(res.createdAt);
          const diff = Math.round((arr.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
          bookingWindowSum += diff;
          bookingWindowCount++;
        }
      }
      const bookingWindow = bookingWindowCount > 0 ? bookingWindowSum / bookingWindowCount : 0;

      data.push({
        date: ds,
        newBookings,
        cancellations: cancels,
        netPickup,
        cumulativeBooked,
        bookingPace: Math.round(bookingPace * 100) / 100,
        occupancyPace: Math.round(occupancyPace * 100) / 100,
        bookingWindowDays: Math.round(bookingWindow * 100) / 100,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    const summary = {
      totalNewBookings,
      totalCancellations,
      netPickup: totalNewBookings - totalCancellations,
      avgBookingPace: data.length > 0 ? Math.round((totalNewBookings / data.length) * 100) / 100 : 0,
      avgBookingWindow: data.length > 0 ? Math.round(data.reduce((s, d) => s + d.bookingWindowDays, 0) / data.length * 100) / 100 : 0,
    };

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data, summary };
  }

  async getPickupByRoomType(propertyId: string, startDate: string, endDate: string): Promise<PickupByRoomTypeResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, isActive: true, deletedAt: null },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
      },
      include: { roomType: true },
    });

    const cancellations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CANCELLED',
        updatedAt: { gte: start, lte: end },
      },
      include: { roomType: true },
    });

    const data = [];
    for (const rt of roomTypes) {
      const rtBookings = reservations.filter((r) => r.roomTypeId === rt.id).length;
      const rtCancels = cancellations.filter((r) => r.roomTypeId === rt.id).length;

      const inventory = await this.prisma.dailyInventory.findMany({
        where: { propertyId, roomTypeId: rt.id, businessDate: { gte: start, lte: end } },
      });
      const totalAvailable = inventory.reduce((s, inv) => {
        const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
        return s + ats;
      }, 0);

      data.push({
        roomTypeId: rt.id,
        roomTypeCode: rt.code,
        roomTypeName: rt.name,
        newBookings: rtBookings,
        cancellations: rtCancels,
        netPickup: rtBookings - rtCancels,
        occupancyPercent: totalAvailable > 0 ? Math.round((rtBookings / totalAvailable) * 10000) / 100 : 0,
      });
    }

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data };
  }

  // ==========================================
  // ROOM TYPE PERFORMANCE
  // ==========================================
  async getRoomTypePerformance(propertyId: string, startDate: string, endDate: string): Promise<RoomTypePerformanceResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, isActive: true, deletedAt: null },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        arrivalDate: { lte: end },
        departureDate: { gte: start },
      },
      include: { rateNights: true, roomType: true },
    });

    const data = [];
    for (const rt of roomTypes) {
      const typeReservations = reservations.filter((r) => r.roomTypeId === rt.id);
      let roomRevenue = new Prisma.Decimal(0);
      let occupiedRoomNights = 0;

      for (const res of typeReservations) {
        for (const rn of res.rateNights) {
          const d = toUtcMidnight(rn.businessDate);
          if (d >= start && d <= end) {
            roomRevenue = roomRevenue.add(rn.totalAmount);
            occupiedRoomNights++;
          }
        }
      }

      const inventory = await this.prisma.dailyInventory.findMany({
        where: { propertyId, roomTypeId: rt.id, businessDate: { gte: start, lte: end } },
      });
      const totalAvailable = inventory.reduce((s, inv) => {
        const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
        return s + ats;
      }, 0);

      const adr = occupiedRoomNights > 0 ? roomRevenue.div(occupiedRoomNights) : new Prisma.Decimal(0);
      const revpar = totalAvailable > 0 ? roomRevenue.div(totalAvailable) : new Prisma.Decimal(0);

      // Pickup for this room type
      const newBookings = await this.prisma.reservation.count({
        where: { propertyId, roomTypeId: rt.id, createdAt: { gte: start, lte: end }, status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] } },
      });
      const cancels = await this.prisma.reservation.count({
        where: { propertyId, roomTypeId: rt.id, status: 'CANCELLED', updatedAt: { gte: start, lte: end } },
      });

      // Count physical rooms for this room type
      const roomCount = await this.prisma.room.count({
        where: { propertyId, roomTypeId: rt.id, deletedAt: null },
      });

      data.push({
        roomTypeId: rt.id,
        roomTypeCode: rt.code,
        roomTypeName: rt.name,
        totalRooms: roomCount,
        occupancyPercent: totalAvailable > 0 ? Math.round((occupiedRoomNights / totalAvailable) * 10000) / 100 : 0,
        adr: decimalToString(adr),
        revpar: decimalToString(revpar),
        roomRevenue: decimalToString(roomRevenue),
        availableRoomNights: totalAvailable,
        occupiedRoomNights,
        pickup: decimalToString(newBookings - cancels),
      });
    }

    return { propertyId, startDate: formatDateString(start), endDate: formatDateString(end), data };
  }

  // ==========================================
  // REVENUE BY DEPARTMENT
  // ==========================================
  async getRevenueByDepartment(propertyId: string, businessDate: string): Promise<RevenueByDepartmentResponse> {
    const date = toUtcMidnight(businessDate);
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Room revenue from reservations
    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        arrivalDate: { lt: nextDay },
        departureDate: { gt: date },
      },
      include: { rateNights: { where: { businessDate: date } } },
    });

    let roomRevenue = new Prisma.Decimal(0);
    for (const res of reservations) {
      for (const rn of res.rateNights) {
        roomRevenue = roomRevenue.add(rn.totalAmount);
      }
    }

    // F&B revenue - use postedAt on FolioTransaction
    const fnbTransactions = await this.prisma.folioTransaction.findMany({
      where: {
        folio: { propertyId },
        postedAt: { gte: date, lt: nextDay },
        transactionCode: { startsWith: 'FNB' },
      },
    });
    const fnbRevenue = fnbTransactions.reduce((sum, t) => sum.add(t.amount), new Prisma.Decimal(0));

    // Spa revenue
    const spaTransactions = await this.prisma.folioTransaction.findMany({
      where: {
        folio: { propertyId },
        postedAt: { gte: date, lt: nextDay },
        transactionCode: 'SPA',
      },
    });
    const spaRevenue = spaTransactions.reduce((sum, t) => sum.add(t.amount), new Prisma.Decimal(0));

    // Events revenue
    const eventTransactions = await this.prisma.folioTransaction.findMany({
      where: {
        folio: { propertyId },
        postedAt: { gte: date, lt: nextDay },
        transactionCode: 'EVT',
      },
    });
    const eventRevenue = eventTransactions.reduce((sum, t) => sum.add(t.amount), new Prisma.Decimal(0));

    // Other revenue
    const otherTransactions = await this.prisma.folioTransaction.findMany({
      where: {
        folio: { propertyId },
        postedAt: { gte: date, lt: nextDay },
        transactionCode: { notIn: ['FNB%', 'SPA', 'EVT', 'ROOM'] },
      },
    });
    const otherRevenue = otherTransactions.reduce((sum, t) => sum.add(t.amount), new Prisma.Decimal(0));

    const totalRevenue = roomRevenue.add(fnbRevenue).add(spaRevenue).add(eventRevenue).add(otherRevenue);

    const data = [
      { department: 'ROOMS', revenue: decimalToString(roomRevenue), percentage: totalRevenue.gt(0) ? Math.round(Number(roomRevenue.div(totalRevenue).mul(100)) * 100) / 100 : 0 },
      { department: 'FNB', revenue: decimalToString(fnbRevenue), percentage: totalRevenue.gt(0) ? Math.round(Number(fnbRevenue.div(totalRevenue).mul(100)) * 100) / 100 : 0 },
      { department: 'SPA', revenue: decimalToString(spaRevenue), percentage: totalRevenue.gt(0) ? Math.round(Number(spaRevenue.div(totalRevenue).mul(100)) * 100) / 100 : 0 },
      { department: 'EVENTS', revenue: decimalToString(eventRevenue), percentage: totalRevenue.gt(0) ? Math.round(Number(eventRevenue.div(totalRevenue).mul(100)) * 100) / 100 : 0 },
      { department: 'OTHER', revenue: decimalToString(otherRevenue), percentage: totalRevenue.gt(0) ? Math.round(Number(otherRevenue.div(totalRevenue).mul(100)) * 100) / 100 : 0 },
    ];

    return { propertyId, businessDate: formatDateString(date), data };
  }

  // ==========================================
  // FORECAST (DETERMINISTIC)
  // ==========================================
  async getForecast(propertyId: string, startDate: string, endDate: string): Promise<ForecastResponse> {
    const start = toUtcMidnight(startDate);
    const end = toUtcMidnight(endDate);

    // Get historical occupancy for the same day-of-week in past 90 days
    const ninetyDaysAgo = new Date(start);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

    const historicalInventories = await this.prisma.dailyInventory.findMany({
      where: { propertyId, businessDate: { gte: ninetyDaysAgo, lt: start } },
    });

    // Calculate average occupancy by day-of-week
    const dowAverages = new Map<number, number[]>();
    for (const inv of historicalInventories) {
      const d = toUtcMidnight(inv.businessDate);
      const dow = d.getUTCDay();
      const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
      if (ats > 0) {
        const occ = (inv.bookedCount / ats) * 100;
        if (!dowAverages.has(dow)) dowAverages.set(dow, []);
        dowAverages.get(dow)!.push(occ);
      }
    }

    const dowAvgMap = new Map<number, number>();
    for (const [dow, values] of dowAverages) {
      dowAvgMap.set(dow, values.reduce((a, b) => a + b, 0) / values.length);
    }

    const data = [];
    let current = new Date(start);
    while (current <= end) {
      const ds = formatDateString(current);
      const dow = current.getUTCDay();
      const baseOccupancy = dowAvgMap.get(dow) || 50;

      // Adjust for current bookings
      const futureInventories = await this.prisma.dailyInventory.findMany({
        where: { propertyId, businessDate: current },
      });
      const totalAvailable = futureInventories.reduce((s, inv) => {
        const { ats } = this.atsCalculator.calculateDailyAts(inv, false);
        return s + ats;
      }, 0);
      const totalBooked = futureInventories.reduce((s, inv) => s + inv.bookedCount, 0);
      const currentOccupancy = totalAvailable > 0 ? (totalBooked / totalAvailable) * 100 : 0;

      // Blend historical (60%) with current bookings (40%)
      const forecastOccupancy = Math.round((baseOccupancy * 0.6 + currentOccupancy * 0.4) * 100) / 100;

      let demandLevel: 'HIGH_DEMAND' | 'NORMAL_DEMAND' | 'LOW_DEMAND' = 'NORMAL_DEMAND';
      if (forecastOccupancy >= 85) demandLevel = 'HIGH_DEMAND';
      else if (forecastOccupancy <= 40) demandLevel = 'LOW_DEMAND';

      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      const daysOut = Math.round((current.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOut <= 7) confidence = 'HIGH';
      else if (daysOut <= 30) confidence = 'MEDIUM';
      else confidence = 'LOW';

      data.push({
        date: ds,
        demandLevel,
        occupancyForecast: forecastOccupancy,
        reason: `Based on ${dowAvgMap.has(dow) ? 'historical' : 'baseline'} day-of-week pattern and ${daysOut}d booking pace`,
        confidence,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return {
      propertyId,
      startDate: formatDateString(start),
      endDate: formatDateString(end),
      data,
      methodology: 'Deterministic forecast blending 90-day historical day-of-week patterns (60% weight) with current booking pace (40% weight). Not AI-based.',
    };
  }

  // ==========================================
  // MARKET RATE PROVIDER (DEMO)
  // ==========================================
  async getMarketRateProviders(propertyId: string): Promise<MarketRateProviderConfigDto[]> {
    const providers = await this.prisma.marketRateProvider.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((p) => ({
      id: p.id,
      propertyId: p.propertyId,
      providerName: p.providerName,
      providerType: p.providerType as 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM',
      isEnabled: p.isEnabled,
      configuration: p.configuration as Record<string, any>,
      lastSyncAt: p.lastSyncAt?.toISOString() || null,
      lastError: p.lastError || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async createMarketRateProvider(propertyId: string, dto: CreateMarketRateProviderRequest): Promise<MarketRateProviderConfigDto> {
    const created = await this.prisma.marketRateProvider.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        providerName: dto.providerName,
        providerType: dto.providerType,
        configuration: dto.configuration || {},
        isEnabled: true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      providerName: created.providerName,
      providerType: created.providerType as 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM',
      isEnabled: created.isEnabled,
      configuration: created.configuration as Record<string, any>,
      lastSyncAt: null,
      lastError: null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateMarketRateProvider(propertyId: string, id: string, dto: UpdateMarketRateProviderRequest): Promise<MarketRateProviderConfigDto> {
    const updated = await this.prisma.marketRateProvider.update({
      where: { id, propertyId },
      data: {
        ...(dto.providerName && { providerName: dto.providerName }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.configuration && { configuration: dto.configuration }),
      },
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      providerName: updated.providerName,
      providerType: updated.providerType as 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM',
      isEnabled: updated.isEnabled,
      configuration: updated.configuration as Record<string, any>,
      lastSyncAt: updated.lastSyncAt?.toISOString() || null,
      lastError: updated.lastError || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getMarketRates(propertyId: string, query: { startDate: string; endDate: string; roomTypeId?: string; competitorCode?: string }): Promise<MarketRateResponse> {
    const start = toUtcMidnight(query.startDate);
    const end = toUtcMidnight(query.endDate);

    // Generate demo market rates based on compset
    const providers = await this.prisma.marketRateProvider.findMany({
      where: { propertyId, isEnabled: true },
    });

    const competitors = await this.prisma.competitorSet.findMany({
      where: { propertyId, isActive: true },
    });

    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, isActive: true, deletedAt: null, ...(query.roomTypeId ? { id: query.roomTypeId } : {}) },
    });

    const data: MarketRateDto[] = [];

    for (const rt of roomTypes) {
      const baseRate = await this.prisma.ratePlanRoomType.findFirst({
        where: { propertyId, roomTypeId: rt.id, isActive: true },
        orderBy: { baseRateAmount: 'desc' },
      });

      const ourRate = baseRate ? Number(baseRate.baseRateAmount) : 30000;

      for (const comp of competitors) {
        if (query.competitorCode && comp.competitorCode !== query.competitorCode) continue;

        // Demo: competitor rate is our rate +/- 10-20%
        const variance = 0.9 + Math.random() * 0.2;
        const compRate = Math.round(ourRate * variance);

        let current = new Date(start);
        while (current <= end) {
          data.push({
            date: formatDateString(current),
            competitorCode: comp.competitorCode,
            competitorName: comp.competitorName,
            roomTypeCode: rt.code,
            rate: compRate.toString(),
            source: 'DEMO_COMPSET',
            capturedAt: new Date().toISOString(),
          });
          current.setUTCDate(current.getUTCDate() + 1);
        }
      }
    }

    return { propertyId, data };
  }

  // ==========================================
  // PRICING RECOMMENDATIONS
  // ==========================================
  async getPricingRecommendations(propertyId: string, query: { startDate: string; endDate: string; roomTypeId?: string }): Promise<PricingRecommendationResponse> {
    const start = toUtcMidnight(query.startDate);
    const end = toUtcMidnight(query.endDate);

    const forecast = await this.getForecast(propertyId, query.startDate, query.endDate);
    const marketRates = await this.getMarketRates(propertyId, {
      startDate: query.startDate,
      endDate: query.endDate,
      roomTypeId: query.roomTypeId,
    });

    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, isActive: true, deletedAt: null, ...(query.roomTypeId ? { id: query.roomTypeId } : {}) },
    });

    const marketRateMap = new Map<string, number>();
    for (const mr of marketRates.data) {
      const key = `${mr.date}|${mr.roomTypeCode}`;
      const rateNum = Number(mr.rate);
      if (!marketRateMap.has(key) || rateNum > marketRateMap.get(key)!) {
        marketRateMap.set(key, rateNum);
      }
    }

    const data = [];
    for (const rt of roomTypes) {
      const baseRate = await this.prisma.ratePlanRoomType.findFirst({
        where: { propertyId, roomTypeId: rt.id, isActive: true },
        orderBy: { baseRateAmount: 'desc' },
      });

      let current = new Date(start);
      while (current <= end) {
        const ds = formatDateString(current);
        const forecastPoint = forecast.data.find((f) => f.date === ds);
        const demandLevel = forecastPoint?.demandLevel || 'NORMAL_DEMAND';
        const marketRateKey = `${ds}|${rt.code}`;
        const marketAvg = marketRateMap.get(marketRateKey);

        const ourRate = baseRate ? Number(baseRate.baseRateAmount) : 30000;
        let recommendedRate = ourRate;
        let reason = '';
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

        switch (demandLevel) {
          case 'HIGH_DEMAND':
            recommendedRate = Math.round(ourRate * 1.15);
            reason = 'High forecasted occupancy (>85%) suggests rate increase opportunity';
            confidence = 'HIGH';
            break;
          case 'LOW_DEMAND':
            recommendedRate = Math.round(ourRate * 0.9);
            reason = 'Low forecasted occupancy (<40%) suggests rate decrease to stimulate demand';
            confidence = 'MEDIUM';
            break;
          default:
            recommendedRate = ourRate;
            reason = 'Normal demand forecast, maintain current rate';
            confidence = 'LOW';
            break;
        }

        // Adjust based on market rates
        if (marketAvg) {
          if (recommendedRate < marketAvg * 0.95) {
            recommendedRate = Math.min(recommendedRate, Math.round(marketAvg * 0.98));
            reason += '; below market average, slight increase recommended';
          } else if (recommendedRate > marketAvg * 1.05) {
            recommendedRate = Math.max(recommendedRate, Math.round(marketAvg * 1.02));
            reason += '; above market average, consider competitiveness';
          }
        }

        data.push({
          date: ds,
          roomTypeId: rt.id,
          roomTypeCode: rt.code,
          roomTypeName: rt.name,
          currentRate: ourRate.toString(),
          recommendedRate: recommendedRate.toString(),
          demandLevel,
          reason,
          confidence,
          marketRate: marketAvg?.toString(),
          competitorAvgRate: marketAvg?.toString(),
        });

        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    return {
      propertyId,
      data,
      generatedAt: new Date().toISOString(),
      methodology: 'Rules-based recommendations: HIGH_DEMAND (+15%), NORMAL (0%), LOW_DEMAND (-10%), adjusted by compset market rates. Not AI-based.',
    };
  }

  // ==========================================
  // COMPETITOR SET
  // ==========================================
  async getCompetitorSet(propertyId: string): Promise<CompetitorSetResponse> {
    const competitors = await this.prisma.competitorSet.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      propertyId,
      data: competitors.map((c) => ({
        id: c.id,
        propertyId: c.propertyId,
        competitorCode: c.competitorCode,
        competitorName: c.competitorName,
        isActive: c.isActive,
        segment: c.segment as 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY',
        distanceKm: c.distanceKm ? Number(c.distanceKm) : undefined,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  async createCompetitorSet(propertyId: string, dto: CreateCompetitorSetRequest): Promise<CompetitorSetDto> {
    const existing = await this.prisma.competitorSet.findFirst({
      where: { propertyId, competitorCode: dto.competitorCode },
    });
    if (existing) throw new BadRequestException(`Competitor code '${dto.competitorCode}' already exists`);

    const created = await this.prisma.competitorSet.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        competitorCode: dto.competitorCode,
        competitorName: dto.competitorName,
        segment: dto.segment || 'UPSCALE',
        distanceKm: dto.distanceKm ? new Prisma.Decimal(dto.distanceKm) : null,
        isActive: true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      competitorCode: created.competitorCode,
      competitorName: created.competitorName,
      isActive: created.isActive,
      segment: created.segment as 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY',
      distanceKm: created.distanceKm ? Number(created.distanceKm) : undefined,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateCompetitorSet(propertyId: string, id: string, dto: UpdateCompetitorSetRequest): Promise<CompetitorSetDto> {
    const updated = await this.prisma.competitorSet.update({
      where: { id, propertyId },
      data: {
        ...(dto.competitorName && { competitorName: dto.competitorName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.segment && { segment: dto.segment }),
        ...(dto.distanceKm !== undefined && { distanceKm: dto.distanceKm ? new Prisma.Decimal(dto.distanceKm) : null }),
      },
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      competitorCode: updated.competitorCode,
      competitorName: updated.competitorName,
      isActive: updated.isActive,
      segment: updated.segment as 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY',
      distanceKm: updated.distanceKm ? Number(updated.distanceKm) : undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}