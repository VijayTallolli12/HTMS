import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateCrmProfileDto,
  UpdateCrmProfileDto,
  CreateGuestPreferenceDto,
  UpdateGuestPreferenceDto,
  GuestSearchDto,
} from '../dto';
import {
  GuestCrmProfileDto,
  GuestPreferenceDto,
  GuestSearchResultDto,
} from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create CRM profile for a guest
   */
  async getOrCreateProfile(propertyId: string, guestId: string): Promise<GuestCrmProfileDto> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, propertyId, deletedAt: null },
    });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    let profile = await this.prisma.guestCrmProfile.findFirst({
      where: { propertyId, guestId, deletedAt: null },
    });

    if (!profile) {
      profile = await this.prisma.guestCrmProfile.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          guestId,
          vipFlag: false,
          marketingConsent: false,
          tags: [],
        },
      });
    }

    return this.mapProfileToDto(profile);
  }

  /**
   * Get CRM profile by guest ID
   */
  async getProfile(propertyId: string, guestId: string): Promise<GuestCrmProfileDto | null> {
    const profile = await this.prisma.guestCrmProfile.findFirst({
      where: { propertyId, guestId, deletedAt: null },
    });
    return profile ? this.mapProfileToDto(profile) : null;
  }

  /**
   * Update CRM profile
   */
  async updateProfile(
    propertyId: string,
    guestId: string,
    dto: UpdateCrmProfileDto,
  ): Promise<GuestCrmProfileDto> {
    const profile = await this.prisma.guestCrmProfile.findFirst({
      where: { propertyId, guestId, deletedAt: null },
    });
    if (!profile) {
      throw new NotFoundException('CRM profile not found');
    }

    const updated = await this.prisma.guestCrmProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.vipFlag !== undefined && { vipFlag: dto.vipFlag }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.communicationPreferences !== undefined && {
          communicationPreferences: dto.communicationPreferences as any,
        }),
        ...(dto.marketingConsent !== undefined && { marketingConsent: dto.marketingConsent }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });

    return this.mapProfileToDto(updated);
  }

  /**
   * Search guests with CRM data
   */
  async searchGuests(
    propertyId: string,
    query: GuestSearchDto,
  ): Promise<{ items: GuestSearchResultDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.GuestWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.vipOnly
        ? {
            crmProfile: { vipFlag: true, deletedAt: null },
          }
        : {}),
      ...(query.tier
        ? {
            loyalty: { tier: query.tier, active: true, deletedAt: null },
          }
        : {}),
      ...(query.query
        ? {
            OR: [
              { firstName: { contains: query.query, mode: 'insensitive' } },
              { lastName: { contains: query.query, mode: 'insensitive' } },
              { email: { contains: query.query, mode: 'insensitive' } },
              { phone: { contains: query.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        include: {
          crmProfile: true,
          loyalty: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.guest.count({ where }),
    ]);

    return {
      items: items.map((g) => this.mapGuestToSearchResult(g)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get guest relationship view (full profile with reservations, folios, etc.)
   */
  async getGuestRelationshipView(propertyId: string, guestId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, propertyId, deletedAt: null },
      include: {
        crmProfile: true,
        preferences: true,
        loyalty: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        reservations: {
          where: { deletedAt: null },
          orderBy: { arrivalDate: 'desc' },
          take: 20,
        },
      },
    });

    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    // Get folios for this guest
    const folios = await this.prisma.folio.findMany({
      where: { propertyId, guestId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      guest: {
        id: guest.id,
        propertyId: guest.propertyId,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        identificationType: guest.identificationType,
        identificationNumber: guest.identificationNumber,
        createdAt: guest.createdAt.toISOString(),
        updatedAt: guest.updatedAt.toISOString(),
      },
      crmProfile: guest.crmProfile ? this.mapProfileToDto(guest.crmProfile) : null,
      preferences: guest.preferences.map((p) => this.mapPreferenceToDto(p)),
      loyaltyMembership: guest.loyalty
        ? {
            id: guest.loyalty.id,
            propertyId: guest.loyalty.propertyId,
            guestId: guest.loyalty.guestId,
            membershipNumber: guest.loyalty.membershipNumber,
            tier: guest.loyalty.tier,
            pointsBalance: guest.loyalty.pointsBalance,
            lifetimePoints: guest.loyalty.lifetimePoints,
            joinedDate: guest.loyalty.joinedDate.toISOString().slice(0, 10),
            active: guest.loyalty.active,
            createdAt: guest.loyalty.createdAt.toISOString(),
            updatedAt: guest.loyalty.updatedAt.toISOString(),
          }
        : null,
      loyaltyTransactions: guest.loyalty?.transactions.map((t) => ({
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
      })) || [],
      reservations: guest.reservations.map((r) => ({
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        status: r.status,
        arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
        departureDate: r.departureDate.toISOString().slice(0, 10),
        totalAmount: Number(r.totalAmount),
        currency: r.currency,
        createdAt: r.createdAt.toISOString(),
      })),
      folios: folios.map((f) => ({
        id: f.id,
        folioNumber: f.folioNumber,
        status: f.status,
        balance: Number(f.balance),
        currency: f.currency,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Create guest preference
   */
  async createPreference(
    propertyId: string,
    guestId: string,
    dto: CreateGuestPreferenceDto,
  ): Promise<GuestPreferenceDto> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, propertyId, deletedAt: null },
    });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    try {
      const preference = await this.prisma.guestPreference.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          guestId,
          category: dto.category,
          preference: dto.preference,
          value: dto.value,
        },
      });
      return this.mapPreferenceToDto(preference);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Preference already exists for this guest');
      }
      throw err;
    }
  }

  /**
   * Update guest preference
   */
  async updatePreference(
    propertyId: string,
    guestId: string,
    category: string,
    preference: string,
    dto: UpdateGuestPreferenceDto,
  ): Promise<GuestPreferenceDto> {
    const pref = await this.prisma.guestPreference.findFirst({
      where: { propertyId, guestId, category, preference },
    });
    if (!pref) {
      throw new NotFoundException('Preference not found');
    }

    const updated = await this.prisma.guestPreference.update({
      where: { id: pref.id },
      data: { value: dto.value },
    });

    return this.mapPreferenceToDto(updated);
  }

  /**
   * Delete guest preference
   */
  async deletePreference(
    propertyId: string,
    guestId: string,
    category: string,
    preference: string,
  ): Promise<void> {
    const pref = await this.prisma.guestPreference.findFirst({
      where: { propertyId, guestId, category, preference },
    });
    if (!pref) {
      throw new NotFoundException('Preference not found');
    }

    await this.prisma.guestPreference.delete({ where: { id: pref.id } });
  }

  /**
   * List guest preferences
   */
  async listPreferences(propertyId: string, guestId: string): Promise<GuestPreferenceDto[]> {
    const prefs = await this.prisma.guestPreference.findMany({
      where: { propertyId, guestId },
      orderBy: [{ category: 'asc' }, { preference: 'asc' }],
    });
    return prefs.map((p) => this.mapPreferenceToDto(p));
  }

  private mapProfileToDto(profile: any): GuestCrmProfileDto {
    return {
      id: profile.id,
      propertyId: profile.propertyId,
      guestId: profile.guestId,
      vipFlag: profile.vipFlag,
      notes: profile.notes,
      communicationPreferences: profile.communicationPreferences as any,
      marketingConsent: profile.marketingConsent,
      tags: profile.tags,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapPreferenceToDto(pref: any): GuestPreferenceDto {
    return {
      id: pref.id,
      propertyId: pref.propertyId,
      guestId: pref.guestId,
      category: pref.category,
      preference: pref.preference,
      value: pref.value,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    };
  }

  private mapGuestToSearchResult(guest: any): GuestSearchResultDto {
    return {
      id: guest.id,
      propertyId: guest.propertyId,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      vipFlag: guest.crmProfile?.vipFlag || false,
      loyaltyTier: guest.loyalty?.tier || null,
      pointsBalance: guest.loyalty?.pointsBalance || null,
      createdAt: guest.createdAt.toISOString(),
    };
  }
}