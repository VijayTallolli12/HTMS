import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyHierarchyPath } from '../../domain/types/resource-scope.types';

@Injectable()
export class HierarchyValidationService {
  private readonly logger = new Logger(HierarchyValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves and verifies structural hierarchy path for a property:
   * Property -> Country -> Region -> HotelGroup.
   *
   * Validates:
   * 1. Property exists, is active, and is not soft-deleted.
   * 2. If expectedHotelGroupId is provided, verifies containment within that hotel group.
   *
   * Throws ForbiddenException (403) on hierarchy failure or cross-tenant attempts.
   */
  async validatePropertyHierarchy(
    propertyId: string,
    expectedHotelGroupId?: string,
  ): Promise<PropertyHierarchyPath> {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new ForbiddenException('Invalid property identifier.');
    }

    const path = await this.getPropertyHierarchy(propertyId);
    if (!path || path.status !== 'ACTIVE') {
      throw new ForbiddenException('Resource outside authorized organizational hierarchy.');
    }

    if (expectedHotelGroupId && path.hotelGroupId !== expectedHotelGroupId) {
      this.logger.warn(
        `Cross-tenant access rejected: Property ${propertyId} (belongs to group ${path.hotelGroupId}) attempted under active group ${expectedHotelGroupId}`,
      );
      throw new ForbiddenException('Cross-tenant property access prohibited.');
    }

    return path;
  }

  /**
   * Retrieves structural hierarchy path for a property without throwing.
   */
  async getPropertyHierarchy(propertyId: string): Promise<PropertyHierarchyPath | null> {
    if (!propertyId) return null;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        country: {
          include: {
            region: true,
          },
        },
      },
    });

    if (!property || Boolean(property.deletedAt)) {
      return null;
    }

    const country = property.country;
    const region = country?.region;
    const hotelGroupId = region?.hotelGroupId;

    if (!country || !region || !hotelGroupId) {
      return null;
    }

    return {
      propertyId: property.id,
      propertyCode: property.code,
      countryId: country.id,
      regionId: region.id,
      hotelGroupId,
      status: property.status,
    };
  }
}
