import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api-core/src/app.module';
import { GlobalHttpExceptionFilter } from '../../apps/api-core/src/common/filters/http-exception.filter';
import { getPrismaClient, PrismaClient } from '@hms/database';

describe('NestJS Organization API Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const testSuffix = Date.now().toString().slice(-6);
  const groupCode = `HG-API-${testSuffix}`;
  const regionCode = `REG-API-${testSuffix}`;
  const countryCode = 'FR';
  const propertyCode = `PROP-API-${testSuffix}`;
  const buildingCode = `BLD-API-${testSuffix}`;
  const floorCode = `FL-API-${testSuffix}`;

  let createdGroupId: string;
  let createdRegionId: string;
  let createdCountryId: string;
  let createdPropertyId: string;
  let createdBuildingId: string;
  let createdFloorId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalHttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    try {
      if (createdFloorId) await prisma.floor.deleteMany({ where: { id: createdFloorId } });
      if (createdBuildingId) await prisma.building.deleteMany({ where: { id: createdBuildingId } });
      if (createdPropertyId) await prisma.property.deleteMany({ where: { id: createdPropertyId } });
      if (createdCountryId) await prisma.country.deleteMany({ where: { id: createdCountryId } });
      if (createdRegionId) await prisma.region.deleteMany({ where: { id: createdRegionId } });
      if (createdGroupId) await prisma.hotelGroup.deleteMany({ where: { id: createdGroupId } });
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('1. POST /api/v1/organization/groups creates a new hotel group', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/groups')
      .set('X-Correlation-ID', 'corr_group_test')
      .send({
        code: groupCode,
        name: 'API Test Hotel Group',
        description: 'Testing hotel group creation via API',
      })
      .expect(201);

    expect(res.headers['x-correlation-id']).toBe('corr_group_test');
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.code).toBe(groupCode);
    expect(res.body.data.status).toBe('ACTIVE');

    createdGroupId = res.body.data.id;
  });

  it('2. POST /api/v1/organization/groups rejects duplicate code with HTTP 409 and RFC 7807', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/groups')
      .send({
        code: groupCode,
        name: 'Duplicate Group',
      })
      .expect(409);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.status).toBe(409);
    expect(res.body.code).toBe('RESOURCE_CONFLICT');
    expect(res.body.detail).toContain(groupCode);
  });

  it('3. POST /api/v1/organization/regions creates a region under hotel group', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/regions')
      .send({
        hotelGroupId: createdGroupId,
        code: regionCode,
        name: 'API Test Region',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.hotelGroupId).toBe(createdGroupId);

    createdRegionId = res.body.data.id;
  });

  it('4. POST /api/v1/organization/countries creates a country under region', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/countries')
      .send({
        regionId: createdRegionId,
        code: countryCode,
        name: 'API Test Country',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(countryCode);

    createdCountryId = res.body.data.id;
  });

  it('5. POST /api/v1/organization/properties creates a property with valid timezone & currency', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/properties')
      .send({
        countryId: createdCountryId,
        code: propertyCode,
        name: 'API Test Luxury Palace',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.timeZone).toBe('Asia/Tokyo');
    expect(res.body.data.currency).toBe('JPY');

    createdPropertyId = res.body.data.id;
  });

  it('6. POST /api/v1/organization/properties rejects invalid timezone with HTTP 400 RFC 7807', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/properties')
      .send({
        countryId: createdCountryId,
        code: `PROP-INVALID-${testSuffix}`,
        name: 'Invalid TZ Palace',
        timeZone: 'Invalid/City',
        currency: 'USD',
      })
      .expect(400);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.status).toBe(400);
    expect(res.body.detail).toContain('Invalid/City');
  });

  it('7. POST /api/v1/organization/buildings creates a building under property', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/buildings')
      .send({
        propertyId: createdPropertyId,
        code: buildingCode,
        name: 'API Test Wing',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.propertyId).toBe(createdPropertyId);

    createdBuildingId = res.body.data.id;
  });

  it('8. POST /api/v1/organization/floors creates a floor under building', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organization/floors')
      .send({
        buildingId: createdBuildingId,
        code: floorCode,
        name: 'Floor 1 Suites',
        floorNumber: 1,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.floorNumber).toBe(1);

    createdFloorId = res.body.data.id;
  });

  it('9. GET /api/v1/organization/hierarchy/tree returns full recursive tree structure', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/organization/hierarchy/tree')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.groups).toBeDefined();
    expect(Array.isArray(res.body.data.groups)).toBe(true);

    const testGroupInTree = res.body.data.groups.find((g: any) => g.id === createdGroupId);
    expect(testGroupInTree).toBeDefined();
    expect(testGroupInTree.regions.length).toBeGreaterThan(0);
    const testRegionInTree = testGroupInTree.regions.find((r: any) => r.id === createdRegionId);
    expect(testRegionInTree).toBeDefined();
    expect(testRegionInTree.countries.length).toBeGreaterThan(0);
  });
});
