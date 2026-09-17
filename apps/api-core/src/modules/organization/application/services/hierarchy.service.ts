import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OrganizationHierarchyTree } from '@hms/api-contracts';

@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async getHierarchyTree(includeDeleted = false): Promise<OrganizationHierarchyTree> {
    const deletedFilter = includeDeleted ? {} : { deletedAt: null };

    const groups = await this.prisma.hotelGroup.findMany({
      where: deletedFilter,
      orderBy: { name: 'asc' },
      include: {
        regions: {
          where: deletedFilter,
          orderBy: { name: 'asc' },
          include: {
            countries: {
              where: deletedFilter,
              orderBy: { name: 'asc' },
              include: {
                properties: {
                  where: deletedFilter,
                  orderBy: { name: 'asc' },
                  include: {
                    buildings: {
                      where: deletedFilter,
                      orderBy: { name: 'asc' },
                      include: {
                        floors: {
                          where: deletedFilter,
                          orderBy: { floorNumber: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const formattedGroups = groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      description: g.description,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      deletedAt: g.deletedAt ? g.deletedAt.toISOString() : null,
      regions: g.regions.map((r) => ({
        id: r.id,
        hotelGroupId: r.hotelGroupId,
        code: r.code,
        name: r.name,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
        countries: r.countries.map((c) => ({
          id: c.id,
          regionId: c.regionId,
          code: c.code,
          name: c.name,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
          properties: c.properties.map((p) => ({
            id: p.id,
            countryId: p.countryId,
            code: p.code,
            name: p.name,
            legalName: p.legalName,
            status: p.status,
            timeZone: p.timeZone,
            currency: p.currency,
            addressLine1: p.addressLine1,
            addressLine2: p.addressLine2,
            city: p.city,
            stateProvince: p.stateProvince,
            postalCode: p.postalCode,
            phone: p.phone,
            email: p.email,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
            buildings: p.buildings.map((b) => ({
              id: b.id,
              propertyId: b.propertyId,
              code: b.code,
              name: b.name,
              description: b.description,
              status: b.status,
              createdAt: b.createdAt.toISOString(),
              updatedAt: b.updatedAt.toISOString(),
              deletedAt: b.deletedAt ? b.deletedAt.toISOString() : null,
              floors: b.floors.map((f) => ({
                id: f.id,
                buildingId: f.buildingId,
                code: f.code,
                name: f.name,
                floorNumber: f.floorNumber,
                status: f.status,
                createdAt: f.createdAt.toISOString(),
                updatedAt: f.updatedAt.toISOString(),
                deletedAt: f.deletedAt ? f.deletedAt.toISOString() : null,
              })),
            })),
          })),
        })),
      })),
    }));

    return { groups: formattedGroups };
  }
}
