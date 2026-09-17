import { HierarchyValidationService } from '../../apps/api-core/src/modules/identity/application/services/hierarchy-validation.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('HierarchyValidationService (Unit)', () => {
  let service: HierarchyValidationService;
  let mockPrisma: jest.Mocked<Partial<PrismaService>>;

  beforeEach(() => {
    mockPrisma = {
      property: {
        findUnique: jest.fn(),
      } as any,
    };

    service = new HierarchyValidationService(mockPrisma as PrismaService);
  });

  describe('getPropertyHierarchy', () => {
    it('should return hierarchy path when property exists with valid ancestry', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue({
        id: 'prop-1',
        code: 'P-1',
        status: 'ACTIVE',
        countryId: 'country-1',
        country: {
          id: 'country-1',
          regionId: 'reg-1',
          region: {
            id: 'reg-1',
            hotelGroupId: 'group-1',
          },
        },
      });

      const result = await service.getPropertyHierarchy('prop-1');

      expect(result).toEqual({
        propertyId: 'prop-1',
        propertyCode: 'P-1',
        countryId: 'country-1',
        regionId: 'reg-1',
        hotelGroupId: 'group-1',
        status: 'ACTIVE',
      });
    });

    it('should return null when property does not exist', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getPropertyHierarchy('prop-missing');

      expect(result).toBeNull();
    });

    it('should return null when property has broken ancestry (missing country/region)', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue({
        id: 'prop-broken',
        countryId: 'country-1',
        country: null,
      });

      const result = await service.getPropertyHierarchy('prop-broken');

      expect(result).toBeNull();
    });
  });

  describe('validatePropertyHierarchy', () => {
    it('should succeed when property belongs to expected hotel group', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue({
        id: 'prop-1',
        code: 'P-1',
        status: 'ACTIVE',
        countryId: 'country-1',
        country: {
          id: 'country-1',
          regionId: 'reg-1',
          region: {
            id: 'reg-1',
            hotelGroupId: 'group-1',
          },
        },
      });

      const result = await service.validatePropertyHierarchy('prop-1', 'group-1');

      expect(result.hotelGroupId).toBe('group-1');
      expect(result.propertyId).toBe('prop-1');
    });

    it('should throw ForbiddenException when property does not exist', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validatePropertyHierarchy('prop-missing', 'group-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when property belongs to another hotel group (cross-tenant)', async () => {
      (mockPrisma.property!.findUnique as jest.Mock).mockResolvedValue({
        id: 'prop-1',
        countryId: 'country-1',
        country: {
          id: 'country-1',
          regionId: 'reg-1',
          region: {
            id: 'reg-1',
            hotelGroupId: 'group-2',
          },
        },
      });

      await expect(service.validatePropertyHierarchy('prop-1', 'group-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
