import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  IRatePlanDeletionValidator,
  RATE_PLAN_DELETION_VALIDATOR,
} from '../contracts/rate-plan-deletion-validator.interface';
import { CreateRatePlanDto } from '../dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from '../dto/update-rate-plan.dto';
import { UpdateRatePlanRoomTypeDto } from '../dto/update-rate-plan-room-type.dto';
import { SetDailyRateOverrideDto } from '../dto/set-daily-rate-override.dto';
import { DailyRateDto, PmsEventType, RatePlanDto, RatePlanRoomTypeDto } from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class RatePlanService {
  private readonly logger = new Logger(RatePlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RATE_PLAN_DELETION_VALIDATOR)
    private readonly deletionValidator: IRatePlanDeletionValidator,
  ) {}

  public async create(propertyId: string, dto: CreateRatePlanDto): Promise<RatePlanDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found.`);
    }

    // Currency must match property currency
    if (dto.currency.toUpperCase() !== property.currency.toUpperCase()) {
      throw new BadRequestException(
        `RatePlan currency '${dto.currency}' must match Property currency '${property.currency}'.`,
      );
    }

    const validFrom = new Date(dto.validFrom);
    const validTo = new Date(dto.validTo);
    if (validTo < validFrom) {
      throw new BadRequestException('validTo must be greater than or equal to validFrom.');
    }

    if (dto.maxStayDays && dto.minStayDays && dto.minStayDays > dto.maxStayDays) {
      throw new BadRequestException('minStayDays cannot exceed maxStayDays.');
    }

    const existing = await this.prisma.ratePlan.findFirst({
      where: { propertyId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `RatePlan with code '${dto.code}' already exists for property '${propertyId}'.`,
      );
    }

    // Verify all applicable room types belong to this property
    for (const rpt of dto.applicableRoomTypes) {
      const rt = await this.prisma.roomType.findFirst({
        where: { id: rpt.roomTypeId, propertyId, deletedAt: null },
      });
      if (!rt) {
        throw new BadRequestException(
          `RoomType '${rpt.roomTypeId}' not found or belongs to another property.`,
        );
      }
    }

    const ratePlanId = generateUuidV7();

    const event = createCloudEvent({
      type: PmsEventType.RATE_PLAN_CREATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/rate-plans/${ratePlanId}`,
      subject: ratePlanId,
      propertyId,
      data: {
        ratePlanId,
        propertyId,
        code: dto.code,
        name: dto.name,
        currency: dto.currency.toUpperCase(),
        validFrom: dto.validFrom,
        validTo: dto.validTo,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.ratePlan.create({
        data: {
          id: ratePlanId,
          propertyId,
          code: dto.code,
          name: dto.name,
          description: dto.description || null,
          currency: dto.currency.toUpperCase(),
          mealPlanCode: dto.mealPlanCode ?? 'RO',
          pricingModel: dto.pricingModel ?? 'PER_ROOM',
          isClosed: dto.isClosed ?? false,
          isClosedToArrival: dto.isClosedToArrival ?? false,
          isClosedToDeparture: dto.isClosedToDeparture ?? false,
          minStayDays: dto.minStayDays ?? 1,
          maxStayDays: dto.maxStayDays ?? null,
          validFrom,
          validTo,
          cancellationPolicy: dto.cancellationPolicy ?? null,
          isActive: true,
        },
      });

      for (const rpt of dto.applicableRoomTypes) {
        await tx.ratePlanRoomType.create({
          data: {
            id: generateUuidV7(),
            propertyId,
            ratePlanId,
            roomTypeId: rpt.roomTypeId,
            baseRateAmount: rpt.baseRateAmount,
            extraAdultRate: rpt.extraAdultRate ?? 0,
            extraChildRate: rpt.extraChildRate ?? 0,
            isActive: true,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return plan;
    });

    return this.findById(propertyId, result.id);
  }

  public async findAll(propertyId: string, activeOnly: boolean = false): Promise<RatePlanDto[]> {
    const plans = await this.prisma.ratePlan.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        roomTypes: {
          where: { deletedAt: null },
        },
      },
      orderBy: { code: 'asc' },
    });
    return plans.map((p) => this.mapToDto(p));
  }

  public async findById(propertyId: string, id: string): Promise<RatePlanDto> {
    const plan = await this.prisma.ratePlan.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`RatePlan '${id}' not found.`);
    }
    return this.mapToDto(plan);
  }

  public async update(
    propertyId: string,
    id: string,
    dto: UpdateRatePlanDto,
  ): Promise<RatePlanDto> {
    const existing = await this.prisma.ratePlan.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`RatePlan '${id}' not found.`);
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const validTo = dto.validTo ? new Date(dto.validTo) : existing.validTo;
    if (validTo < validFrom) {
      throw new BadRequestException('validTo must be greater than or equal to validFrom.');
    }

    const minStay = dto.minStayDays ?? existing.minStayDays;
    const maxStay = dto.maxStayDays !== undefined ? dto.maxStayDays : existing.maxStayDays;
    if (maxStay !== null && minStay > maxStay) {
      throw new BadRequestException('minStayDays cannot exceed maxStayDays.');
    }

    const event = createCloudEvent({
      type: PmsEventType.RATE_PLAN_UPDATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/rate-plans/${id}`,
      subject: id,
      propertyId,
      data: {
        ratePlanId: id,
        propertyId,
        code: existing.code,
        name: dto.name ?? existing.name,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.ratePlan.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description !== undefined ? dto.description : existing.description,
          mealPlanCode: dto.mealPlanCode ?? existing.mealPlanCode,
          pricingModel: dto.pricingModel ?? existing.pricingModel,
          isClosed: dto.isClosed !== undefined ? dto.isClosed : existing.isClosed,
          isClosedToArrival:
            dto.isClosedToArrival !== undefined
              ? dto.isClosedToArrival
              : existing.isClosedToArrival,
          isClosedToDeparture:
            dto.isClosedToDeparture !== undefined
              ? dto.isClosedToDeparture
              : existing.isClosedToDeparture,
          minStayDays: minStay,
          maxStayDays: maxStay,
          validFrom,
          validTo,
          cancellationPolicy:
            dto.cancellationPolicy !== undefined
              ? dto.cancellationPolicy
              : existing.cancellationPolicy,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });
    });

    return this.findById(propertyId, id);
  }

  public async delete(propertyId: string, id: string): Promise<RatePlanDto> {
    const existing = await this.prisma.ratePlan.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`RatePlan '${id}' not found.`);
    }

    const validation = await this.deletionValidator.canDeleteRatePlan(propertyId, id);
    if (!validation.allowed) {
      throw new ConflictException(`Cannot delete RatePlan: ${validation.reason}`);
    }

    await this.prisma.ratePlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return this.mapToDto({ ...existing, deletedAt: new Date(), isActive: false });
  }

  public async updateRoomTypeMapping(
    propertyId: string,
    ratePlanId: string,
    roomTypeId: string,
    dto: UpdateRatePlanRoomTypeDto,
  ): Promise<RatePlanRoomTypeDto> {
    const mapping = await this.prisma.ratePlanRoomType.findFirst({
      where: { propertyId, ratePlanId, roomTypeId, deletedAt: null },
    });
    if (!mapping) {
      throw new NotFoundException('RatePlanRoomType mapping not found.');
    }

    const updated = await this.prisma.ratePlanRoomType.update({
      where: { id: mapping.id },
      data: {
        baseRateAmount:
          dto.baseRateAmount !== undefined ? dto.baseRateAmount : mapping.baseRateAmount,
        extraAdultRate:
          dto.extraAdultRate !== undefined ? dto.extraAdultRate : mapping.extraAdultRate,
        extraChildRate:
          dto.extraChildRate !== undefined ? dto.extraChildRate : mapping.extraChildRate,
        isActive: dto.isActive !== undefined ? dto.isActive : mapping.isActive,
      },
    });

    return this.mapRoomTypeDto(updated);
  }

  public async setDailyRateOverride(
    propertyId: string,
    dto: SetDailyRateOverrideDto,
  ): Promise<DailyRateDto> {
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: { id: dto.ratePlanId, propertyId, deletedAt: null },
    });
    if (!ratePlan) {
      throw new NotFoundException(`RatePlan '${dto.ratePlanId}' not found.`);
    }

    const bDate = new Date(`${dto.businessDate.slice(0, 10)}T00:00:00.000Z`);
    if (bDate < ratePlan.validFrom || bDate > ratePlan.validTo) {
      throw new BadRequestException('businessDate is outside RatePlan validity window.');
    }

    const existing = await this.prisma.dailyRate.findUnique({
      where: {
        uq_daily_rates_plan_room_date: {
          ratePlanId: dto.ratePlanId,
          roomTypeId: dto.roomTypeId,
          businessDate: bDate,
        },
      },
    });

    const event = createCloudEvent({
      type: PmsEventType.DAILY_RATE_OVERRIDDEN,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/daily-rates/${dto.ratePlanId}/${dto.roomTypeId}`,
      subject: `${dto.ratePlanId}:${dto.roomTypeId}:${dto.businessDate}`,
      propertyId,
      data: {
        ratePlanId: dto.ratePlanId,
        roomTypeId: dto.roomTypeId,
        propertyId,
        businessDate: dto.businessDate,
        baseRateAmount: dto.baseRateAmount,
        isClosed: dto.isClosed,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let dailyRate;
      if (existing) {
        dailyRate = await tx.dailyRate.update({
          where: { id: existing.id },
          data: {
            baseRateAmount: dto.baseRateAmount,
            extraAdultRate: dto.extraAdultRate !== undefined ? dto.extraAdultRate : null,
            extraChildRate: dto.extraChildRate !== undefined ? dto.extraChildRate : null,
            isClosed: dto.isClosed ?? false,
            isClosedToArrival: dto.isClosedToArrival !== undefined ? dto.isClosedToArrival : null,
            isClosedToDeparture:
              dto.isClosedToDeparture !== undefined ? dto.isClosedToDeparture : null,
            minStayDays: dto.minStayDays !== undefined ? dto.minStayDays : null,
            maxStayDays: dto.maxStayDays !== undefined ? dto.maxStayDays : null,
          },
        });
      } else {
        dailyRate = await tx.dailyRate.create({
          data: {
            id: generateUuidV7(),
            propertyId,
            ratePlanId: dto.ratePlanId,
            roomTypeId: dto.roomTypeId,
            businessDate: bDate,
            baseRateAmount: dto.baseRateAmount,
            extraAdultRate: dto.extraAdultRate ?? null,
            extraChildRate: dto.extraChildRate ?? null,
            isClosed: dto.isClosed ?? false,
            isClosedToArrival: dto.isClosedToArrival ?? null,
            isClosedToDeparture: dto.isClosedToDeparture ?? null,
            minStayDays: dto.minStayDays ?? null,
            maxStayDays: dto.maxStayDays ?? null,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return dailyRate;
    });

    return {
      id: result.id,
      propertyId: result.propertyId,
      ratePlanId: result.ratePlanId,
      roomTypeId: result.roomTypeId,
      businessDate: result.businessDate.toISOString().slice(0, 10),
      baseRateAmount: result.baseRateAmount.toString(),
      extraAdultRate: result.extraAdultRate ? result.extraAdultRate.toString() : null,
      extraChildRate: result.extraChildRate ? result.extraChildRate.toString() : null,
      isClosed: result.isClosed,
      isClosedToArrival: result.isClosedToArrival,
      isClosedToDeparture: result.isClosedToDeparture,
      minStayDays: result.minStayDays,
      maxStayDays: result.maxStayDays,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapToDto(entity: any): RatePlanDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      currency: entity.currency,
      mealPlanCode: entity.mealPlanCode,
      pricingModel: entity.pricingModel,
      isClosed: entity.isClosed,
      isClosedToArrival: entity.isClosedToArrival,
      isClosedToDeparture: entity.isClosedToDeparture,
      minStayDays: entity.minStayDays,
      maxStayDays: entity.maxStayDays,
      validFrom: entity.validFrom.toISOString().slice(0, 10),
      validTo: entity.validTo.toISOString().slice(0, 10),
      cancellationPolicy: entity.cancellationPolicy,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      deletedAt: entity.deletedAt ? entity.deletedAt.toISOString() : null,
      roomTypes: entity.roomTypes ? entity.roomTypes.map((rt: any) => this.mapRoomTypeDto(rt)) : [],
    };
  }

  private mapRoomTypeDto(entity: any): RatePlanRoomTypeDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      ratePlanId: entity.ratePlanId,
      roomTypeId: entity.roomTypeId,
      baseRateAmount: entity.baseRateAmount.toString(),
      extraAdultRate: entity.extraAdultRate.toString(),
      extraChildRate: entity.extraChildRate.toString(),
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      deletedAt: entity.deletedAt ? entity.deletedAt.toISOString() : null,
    };
  }
}
