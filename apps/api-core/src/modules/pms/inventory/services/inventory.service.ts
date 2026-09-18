import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DailyInventoryDto, StayQuoteOption, StayQuoteResponse } from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { AtsCalculatorService } from './ats-calculator.service';
import { evaluateStayRestrictions, StayEvaluationInput } from './stay-restriction-evaluator';
import { QueryAvailabilityDto } from '../dto/query-availability.dto';
import { QueryInventoryCalendarDto } from '../dto/query-inventory-calendar.dto';

function toUtcMidnight(dateInput: string | Date): Date {
  const str =
    typeof dateInput === 'string' ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

function formatDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    private readonly atsCalculator: AtsCalculatorService,
  ) {}

  /**
   * Retrieves operational daily inventory ledger entries within a date range,
   * calculating authoritative ATS for each entry.
   */
  public async getInventoryCalendar(
    propertyId: string,
    query: QueryInventoryCalendarDto,
  ): Promise<DailyInventoryDto[]> {
    const start = toUtcMidnight(query.startDate);
    const end = toUtcMidnight(query.endDate);

    if (start > end) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const records = await this.prisma.dailyInventory.findMany({
      where: {
        propertyId,
        businessDate: {
          gte: start,
          lte: end,
        },
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      },
      orderBy: [{ businessDate: 'asc' }, { roomTypeId: 'asc' }],
    });

    return records.map((inv) => {
      const { ats, physicalAvailable, maxSellable } = this.atsCalculator.calculateDailyAts(
        inv,
        false,
      );

      return {
        id: inv.id,
        propertyId: inv.propertyId,
        roomTypeId: inv.roomTypeId,
        businessDate: formatDateString(inv.businessDate),
        totalRooms: inv.totalRooms,
        outOfOrderCount: inv.outOfOrderCount,
        outOfServiceCount: inv.outOfServiceCount,
        blockedCount: inv.blockedCount,
        bookedCount: inv.bookedCount,
        overbookingLimit: inv.overbookingLimit,
        ats,
        physicalAvailable,
        maxSellable,
        version: inv.version,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Evaluates stay availability, restriction checks, and nightly rate breakdown
   * across active RoomTypes and RatePlans.
   */
  public async getStayQuote(
    propertyId: string,
    query: QueryAvailabilityDto,
  ): Promise<StayQuoteResponse> {
    const arrivalDate = toUtcMidnight(query.arrivalDate);
    const departureDate = toUtcMidnight(query.departureDate);

    if (arrivalDate >= departureDate) {
      throw new BadRequestException('departureDate must be strictly after arrivalDate');
    }

    const lengthOfStay = Math.round(
      (departureDate.getTime() - arrivalDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (lengthOfStay > 90) {
      throw new BadRequestException('Availability quote cannot exceed 90 nights');
    }

    // Verify property existence
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Query active room types
    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        ...(query.roomTypeId ? { id: query.roomTypeId } : {}),
      },
    });

    // Query active rate plans
    const ratePlans = await this.prisma.ratePlan.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        roomTypes: {
          where: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    // Query daily rates in range [arrivalDate, departureDate]
    // (departureDate is included so CTD on departure date can be evaluated)
    const dailyRates = await this.prisma.dailyRate.findMany({
      where: {
        propertyId,
        businessDate: {
          gte: arrivalDate,
          lte: departureDate,
        },
      },
    });

    // Query daily inventory in range [arrivalDate, departureDate)
    const dailyInventories = await this.prisma.dailyInventory.findMany({
      where: {
        propertyId,
        businessDate: {
          gte: arrivalDate,
          lt: departureDate,
        },
      },
    });

    const options: StayQuoteOption[] = [];

    for (const rt of roomTypes) {
      // Check physical occupancy limits
      const totalGuests = query.adults + (query.children || 0);
      if (
        query.adults > rt.maxAdults ||
        (query.children !== undefined && query.children > rt.maxChildren) ||
        totalGuests > rt.maxOccupancy
      ) {
        continue; // Does not satisfy physical room occupancy invariants
      }

      for (const rp of ratePlans) {
        const mapping = rp.roomTypes.find((rprt) => rprt.roomTypeId === rt.id);
        if (!mapping) {
          continue; // Rate plan not mapped to this room type
        }

        const planDailyRates = dailyRates.filter(
          (dr) => dr.ratePlanId === rp.id && dr.roomTypeId === rt.id,
        );

        const typeInventories = dailyInventories.filter((inv) => inv.roomTypeId === rt.id);

        const evaluationInput: StayEvaluationInput = {
          propertyId,
          roomTypeId: rt.id,
          ratePlan: {
            id: rp.id,
            code: rp.code,
            name: rp.name,
            currency: rp.currency,
            isClosed: rp.isClosed,
            isClosedToArrival: rp.isClosedToArrival,
            isClosedToDeparture: rp.isClosedToDeparture,
            minStayDays: rp.minStayDays,
            maxStayDays: rp.maxStayDays,
            validFrom: rp.validFrom,
            validTo: rp.validTo,
            baseRateAmount: Number(mapping.baseRateAmount),
            dailyRates: planDailyRates.map((dr) => ({
              businessDate: dr.businessDate,
              baseRateAmount: Number(dr.baseRateAmount),
              extraAdultRate: dr.extraAdultRate ? Number(dr.extraAdultRate) : null,
              extraChildRate: dr.extraChildRate ? Number(dr.extraChildRate) : null,
              isClosed: dr.isClosed,
              isClosedToArrival: dr.isClosedToArrival,
              isClosedToDeparture: dr.isClosedToDeparture,
              minStayDays: dr.minStayDays,
              maxStayDays: dr.maxStayDays,
            })),
          },
          arrivalDate,
          departureDate,
          inventoryRecords: typeInventories,
          includeOutOfServiceInAts: false,
        };

        const result = evaluateStayRestrictions(evaluationInput, this.atsCalculator);

        options.push({
          ratePlanId: rp.id,
          ratePlanCode: rp.code,
          ratePlanName: rp.name,
          roomTypeId: rt.id,
          roomTypeCode: rt.code,
          roomTypeName: rt.name,
          totalAmount: result.totalAmount,
          currency: rp.currency,
          nightlyRates: result.nightlyRates,
          isAvailable: result.isAvailable,
          rejectionReason: result.rejectionReason,
        });
      }
    }

    return {
      propertyId,
      arrivalDate: formatDateString(arrivalDate),
      departureDate: formatDateString(departureDate),
      lengthOfStay,
      options,
    };
  }

  /**
   * Concurrency-safe atomic multi-day inventory reservation using Prisma OCC.
   * Deterministic ordering by businessDate ASC guarantees deadlock prevention.
   */
  public async reserveInventoryRange(
    propertyId: string,
    roomTypeId: string,
    arrivalDate: Date | string,
    departureDate: Date | string,
    count: number = 1,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const arr = toUtcMidnight(arrivalDate);
    const dep = toUtcMidnight(departureDate);

    if (arr >= dep) {
      throw new BadRequestException('departureDate must be strictly after arrivalDate');
    }

    const nights = Math.round((dep.getTime() - arr.getTime()) / (24 * 60 * 60 * 1000));

    const execute = async (client: Prisma.TransactionClient) => {
      // Deterministic ordering: ORDER BY businessDate ASC
      const rows = await client.dailyInventory.findMany({
        where: {
          propertyId,
          roomTypeId,
          businessDate: {
            gte: arr,
            lt: dep,
          },
        },
        orderBy: {
          businessDate: 'asc',
        },
      });

      if (rows.length < nights) {
        throw new ConflictException('Inventory rows missing for stay window');
      }

      // Authoritative ATS validation for every night
      for (const row of rows) {
        const { ats } = this.atsCalculator.calculateDailyAts(row, false);
        if (ats < count) {
          throw new ConflictException(
            `Insufficient ATS inventory on ${formatDateString(row.businessDate)} (available: ${ats}, requested: ${count})`,
          );
        }
      }

      // Apply OCC increment atomically in deterministic order
      for (const row of rows) {
        const res = await client.dailyInventory.updateMany({
          where: {
            id: row.id,
            version: row.version,
          },
          data: {
            bookedCount: { increment: count },
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict on date ${formatDateString(row.businessDate)}`,
          );
        }
      }
    };

    if (tx) {
      return execute(tx);
    }

    await this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000,
    });
  }

  /**
   * Concurrency-safe atomic multi-day inventory release using Prisma OCC.
   * Deterministic ordering by businessDate ASC guarantees deadlock prevention.
   */
  public async releaseInventoryRange(
    propertyId: string,
    roomTypeId: string,
    arrivalDate: Date | string,
    departureDate: Date | string,
    count: number = 1,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const arr = toUtcMidnight(arrivalDate);
    const dep = toUtcMidnight(departureDate);

    if (arr >= dep) {
      throw new BadRequestException('departureDate must be strictly after arrivalDate');
    }

    const nights = Math.round((dep.getTime() - arr.getTime()) / (24 * 60 * 60 * 1000));

    const execute = async (client: Prisma.TransactionClient) => {
      // Deterministic ordering: ORDER BY businessDate ASC
      const rows = await client.dailyInventory.findMany({
        where: {
          propertyId,
          roomTypeId,
          businessDate: {
            gte: arr,
            lt: dep,
          },
        },
        orderBy: {
          businessDate: 'asc',
        },
      });

      if (rows.length < nights) {
        throw new ConflictException('Inventory rows missing for stay window');
      }

      // Validate that bookedCount will not become negative
      for (const row of rows) {
        if (row.bookedCount < count) {
          throw new ConflictException(
            `Cannot release ${count} rooms: bookedCount on ${formatDateString(row.businessDate)} is only ${row.bookedCount}`,
          );
        }
      }

      // Apply OCC decrement atomically in deterministic order
      for (const row of rows) {
        const res = await client.dailyInventory.updateMany({
          where: {
            id: row.id,
            version: row.version,
          },
          data: {
            bookedCount: { decrement: count },
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict on date ${formatDateString(row.businessDate)}`,
          );
        }
      }
    };

    if (tx) {
      return execute(tx);
    }

    await this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000,
    });
  }

  /**
   * Concurrency-safe atomic multi-day maintenance capacity adjustment using Prisma OCC.
   * Deterministic ordering by businessDate ASC guarantees deadlock prevention.
   */
  public async adjustMaintenanceCapacity(
    propertyId: string,
    roomTypeId: string,
    startDate: Date | string,
    endDate: Date | string,
    type: 'OUT_OF_ORDER' | 'OUT_OF_SERVICE',
    direction: 'INCREMENT' | 'DECREMENT',
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const arr = toUtcMidnight(startDate);
    const dep = toUtcMidnight(endDate);

    if (arr >= dep) {
      throw new BadRequestException('endDate must be strictly after startDate');
    }

    const nights = Math.round((dep.getTime() - arr.getTime()) / (24 * 60 * 60 * 1000));
    const delta = direction === 'INCREMENT' ? 1 : -1;
    const updateField = type === 'OUT_OF_ORDER' ? 'outOfOrderCount' : 'outOfServiceCount';

    const execute = async (client: Prisma.TransactionClient) => {
      // Deterministic ordering: ORDER BY businessDate ASC
      const rows = await client.dailyInventory.findMany({
        where: {
          propertyId,
          roomTypeId,
          businessDate: {
            gte: arr,
            lt: dep,
          },
        },
        orderBy: {
          businessDate: 'asc',
        },
      });

      if (rows.length < nights) {
        throw new ConflictException('Inventory rows missing for maintenance window');
      }

      // If decrementing, validate that counter does not drop below 0
      if (direction === 'DECREMENT') {
        for (const row of rows) {
          if (row[updateField] < 1) {
            throw new ConflictException(
              `Cannot decrement ${updateField} on ${formatDateString(row.businessDate)}: current count is ${row[updateField]}`,
            );
          }
        }
      }

      // Apply OCC increment/decrement atomically in deterministic order
      for (const row of rows) {
        const res = await client.dailyInventory.updateMany({
          where: {
            id: row.id,
            version: row.version,
          },
          data: {
            [updateField]: { increment: delta },
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict on date ${formatDateString(row.businessDate)}`,
          );
        }
      }
    };

    if (tx) {
      return execute(tx);
    }

    await this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000,
    });
  }
}
