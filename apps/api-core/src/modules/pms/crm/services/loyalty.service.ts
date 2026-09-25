import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateLoyaltyMembershipDto,
  AwardPointsDto,
  RedeemPointsDto,
  AdjustPointsDto,
  QueryLoyaltyTransactionsDto,
} from '../dto';
import {
  LoyaltyMembershipDto,
  LoyaltyTransactionDto,
  LoyaltyTier,
  LoyaltyTransactionType,
} from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

const TIER_THRESHOLDS: Record<LoyaltyTier, { min: number; max: number | null }> = {
  STANDARD: { min: 0, max: 999 },
  SILVER: { min: 1000, max: 4999 },
  GOLD: { min: 5000, max: 19999 },
  PLATINUM: { min: 20000, max: null },
};

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get loyalty membership for a guest
   */
  async getMembership(propertyId: string, guestId: string): Promise<LoyaltyMembershipDto | null> {
    const membership = await this.prisma.loyaltyMembership.findFirst({
      where: { propertyId, guestId, deletedAt: null },
    });
    return membership ? this.mapMembershipToDto(membership) : null;
  }

  /**
   * Create loyalty membership for a guest
   */
  async createMembership(
    propertyId: string,
    dto: CreateLoyaltyMembershipDto,
  ): Promise<LoyaltyMembershipDto> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: dto.guestId, propertyId, deletedAt: null },
    });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    const existing = await this.prisma.loyaltyMembership.findFirst({
      where: { propertyId, guestId: dto.guestId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Loyalty membership already exists for this guest');
    }

    const membershipNumber = await this.generateMembershipNumber(propertyId);

    const membership = await this.prisma.loyaltyMembership.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        guestId: dto.guestId,
        membershipNumber,
        tier: dto.tier || LoyaltyTier.STANDARD,
        pointsBalance: dto.pointsBalance || 0,
        lifetimePoints: dto.pointsBalance || 0,
        joinedDate: new Date(),
        active: true,
      },
    });

    return this.mapMembershipToDto(membership);
  }

  /**
   * Award points to a membership
   */
  async awardPoints(
    propertyId: string,
    dto: AwardPointsDto,
    createdBy: string,
  ): Promise<LoyaltyTransactionDto> {
    const membership = await this.prisma.loyaltyMembership.findFirst({
      where: { id: dto.membershipId, propertyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Loyalty membership not found');
    }

    if (!membership.active) {
      throw new BadRequestException('Loyalty membership is not active');
    }

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.loyaltyTransaction.findFirst({
        where: { propertyId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.mapTransactionToDto(existing);
      }
    }

    const newBalance = membership.pointsBalance + dto.points;
    const newLifetime = membership.lifetimePoints + dto.points;
    const newTier = this.calculateTier(newLifetime);

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const txRecord = await tx.loyaltyTransaction.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          membershipId: dto.membershipId,
          type: LoyaltyTransactionType.EARN,
          points: dto.points,
          reference: dto.reference || null,
          referenceType: dto.referenceType || null,
          description: dto.description || `Earned ${dto.points} points`,
          idempotencyKey: dto.idempotencyKey || null,
          createdBy,
        },
      });

      // Update membership
      await tx.loyaltyMembership.update({
        where: { id: dto.membershipId },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: newLifetime,
          tier: newTier,
        },
      });

      return txRecord;
    });

    return this.mapTransactionToDto(transaction);
  }

  /**
   * Redeem points from a membership
   */
  async redeemPoints(
    propertyId: string,
    dto: RedeemPointsDto,
    createdBy: string,
  ): Promise<LoyaltyTransactionDto> {
    const membership = await this.prisma.loyaltyMembership.findFirst({
      where: { id: dto.membershipId, propertyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Loyalty membership not found');
    }

    if (!membership.active) {
      throw new BadRequestException('Loyalty membership is not active');
    }

    if (membership.pointsBalance < dto.points) {
      throw new BadRequestException('Insufficient points balance');
    }

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.loyaltyTransaction.findFirst({
        where: { propertyId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.mapTransactionToDto(existing);
      }
    }

    const newBalance = membership.pointsBalance - dto.points;

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const txRecord = await tx.loyaltyTransaction.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          membershipId: dto.membershipId,
          type: LoyaltyTransactionType.REDEEM,
          points: -dto.points,
          reference: dto.reference || null,
          referenceType: dto.referenceType || null,
          description: dto.description || `Redeemed ${dto.points} points`,
          idempotencyKey: dto.idempotencyKey || null,
          createdBy,
        },
      });

      // Update membership
      await tx.loyaltyMembership.update({
        where: { id: dto.membershipId },
        data: {
          pointsBalance: newBalance,
        },
      });

      return txRecord;
    });

    return this.mapTransactionToDto(transaction);
  }

  /**
   * Adjust points (manual adjustment)
   */
  async adjustPoints(
    propertyId: string,
    dto: AdjustPointsDto,
    createdBy: string,
  ): Promise<LoyaltyTransactionDto> {
    const membership = await this.prisma.loyaltyMembership.findFirst({
      where: { id: dto.membershipId, propertyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Loyalty membership not found');
    }

    if (!membership.active) {
      throw new BadRequestException('Loyalty membership is not active');
    }

    const newBalance = membership.pointsBalance + dto.points;
    if (newBalance < 0) {
      throw new BadRequestException('Adjustment would result in negative points balance');
    }

    const newLifetime = membership.lifetimePoints + Math.max(0, dto.points);
    const newTier = this.calculateTier(newLifetime);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.loyaltyTransaction.findFirst({
        where: { propertyId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.mapTransactionToDto(existing);
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const txRecord = await tx.loyaltyTransaction.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          membershipId: dto.membershipId,
          type: LoyaltyTransactionType.ADJUST,
          points: dto.points,
          reference: null,
          referenceType: 'MANUAL',
          description: dto.description,
          idempotencyKey: dto.idempotencyKey || null,
          createdBy,
        },
      });

      // Update membership
      await tx.loyaltyMembership.update({
        where: { id: dto.membershipId },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: newLifetime,
          tier: newTier,
        },
      });

      return txRecord;
    });

    return this.mapTransactionToDto(transaction);
  }

  /**
   * Get transaction history
   */
  async getTransactions(
    propertyId: string,
    query: QueryLoyaltyTransactionsDto,
  ): Promise<{ items: LoyaltyTransactionDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.LoyaltyTransactionWhereInput = {
      propertyId,
      ...(query.membershipId ? { membershipId: query.membershipId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.loyaltyTransaction.count({ where }),
    ]);

    return {
      items: items.map((t) => this.mapTransactionToDto(t)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get tier thresholds
   */
  getTierThresholds(): Record<LoyaltyTier, { min: number; max: number | null }> {
    return TIER_THRESHOLDS;
  }

  /**
   * Calculate tier based on lifetime points
   */
  calculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM.min) return LoyaltyTier.PLATINUM;
    if (lifetimePoints >= TIER_THRESHOLDS.GOLD.min) return LoyaltyTier.GOLD;
    if (lifetimePoints >= TIER_THRESHOLDS.SILVER.min) return LoyaltyTier.SILVER;
    return LoyaltyTier.STANDARD;
  }

  private async generateMembershipNumber(propertyId: string): Promise<string> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    const prefix = property?.code?.substring(0, 3).toUpperCase() || 'HMS';
    const count = await this.prisma.loyaltyMembership.count({ where: { propertyId } });
    return `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }

  private mapMembershipToDto(m: any): LoyaltyMembershipDto {
    return {
      id: m.id,
      propertyId: m.propertyId,
      guestId: m.guestId,
      membershipNumber: m.membershipNumber,
      tier: m.tier,
      pointsBalance: m.pointsBalance,
      lifetimePoints: m.lifetimePoints,
      joinedDate: m.joinedDate.toISOString().slice(0, 10),
      active: m.active,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  private mapTransactionToDto(t: any): LoyaltyTransactionDto {
    return {
      id: t.id,
      propertyId: t.propertyId,
      membershipId: t.membershipId,
      type: t.type,
      points: t.points,
      reference: t.reference,
      referenceType: t.referenceType,
      description: t.description,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
    };
  }
}