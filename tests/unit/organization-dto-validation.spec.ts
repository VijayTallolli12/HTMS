import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateHotelGroupDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-hotel-group.dto';
import { CreateRegionDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-region.dto';
import { CreateCountryDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-country.dto';
import { CreatePropertyDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-property.dto';
import { CreateBuildingDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-building.dto';
import { CreateFloorDto } from '../../apps/api-core/src/modules/organization/presentation/dto/create-floor.dto';
import { generateUuidV7 } from '@hms/shared';

describe('Organization DTO Validation Unit Tests', () => {
  describe('CreateHotelGroupDto', () => {
    it('should pass validation with valid attributes', async () => {
      const dto = plainToInstance(CreateHotelGroupDto, {
        code: 'HG-GLR',
        name: 'Global Luxury Resorts',
        description: 'Flagship enterprise brand',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when code contains invalid characters (spaces or special symbols)', async () => {
      const dto = plainToInstance(CreateHotelGroupDto, {
        code: 'HG GLR!!',
        name: 'Global Luxury Resorts',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('code');
    });

    it('should fail when name is empty', async () => {
      const dto = plainToInstance(CreateHotelGroupDto, {
        code: 'HG-GLR',
        name: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });
  });

  describe('CreateRegionDto', () => {
    it('should pass validation with valid attributes and UUID parent', async () => {
      const dto = plainToInstance(CreateRegionDto, {
        hotelGroupId: generateUuidV7(),
        code: 'APAC',
        name: 'Asia-Pacific',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when hotelGroupId is not a valid UUID', async () => {
      const dto = plainToInstance(CreateRegionDto, {
        hotelGroupId: 'invalid-non-uuid-string',
        code: 'APAC',
        name: 'Asia-Pacific',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('hotelGroupId');
    });
  });

  describe('CreateCountryDto', () => {
    it('should pass validation with valid ISO 3166-1 alpha-2 code', async () => {
      const dto = plainToInstance(CreateCountryDto, {
        regionId: generateUuidV7(),
        code: 'JP',
        name: 'Japan',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when country code is not a valid 2-letter ISO 3166-1 alpha-2 code', async () => {
      const dto = plainToInstance(CreateCountryDto, {
        regionId: generateUuidV7(),
        code: 'JPN', // 3 letters instead of 2
        name: 'Japan',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('code');
    });
  });

  describe('CreatePropertyDto', () => {
    it('should pass validation with valid enterprise attributes', async () => {
      const dto = plainToInstance(CreatePropertyDto, {
        countryId: generateUuidV7(),
        code: 'PROP-TYO-001',
        name: 'Tokyo Grandeur Palace',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when currency code is not 3 characters', async () => {
      const dto = plainToInstance(CreatePropertyDto, {
        countryId: generateUuidV7(),
        code: 'PROP-TYO-001',
        name: 'Tokyo Grandeur Palace',
        timeZone: 'Asia/Tokyo',
        currency: 'JAPANESE_YEN',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('currency');
    });
  });

  describe('CreateBuildingDto', () => {
    it('should pass validation with valid code and parent property UUID', async () => {
      const dto = plainToInstance(CreateBuildingDto, {
        propertyId: generateUuidV7(),
        code: 'MAIN',
        name: 'Main Wing',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('CreateFloorDto', () => {
    it('should pass validation with valid floorNumber integer', async () => {
      const dto = plainToInstance(CreateFloorDto, {
        buildingId: generateUuidV7(),
        code: 'FL-01',
        name: 'First Floor Suites',
        floorNumber: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when floorNumber is not an integer', async () => {
      const dto = plainToInstance(CreateFloorDto, {
        buildingId: generateUuidV7(),
        code: 'FL-01',
        name: 'First Floor Suites',
        floorNumber: 'first-level' as any,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('floorNumber');
    });
  });
});
