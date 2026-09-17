import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { HotelGroupService } from './application/services/hotel-group.service';
import { RegionService } from './application/services/region.service';
import { CountryService } from './application/services/country.service';
import { PropertyService } from './application/services/property.service';
import { BuildingService } from './application/services/building.service';
import { FloorService } from './application/services/floor.service';
import { HierarchyService } from './application/services/hierarchy.service';
import { HotelGroupController } from './presentation/controllers/hotel-group.controller';
import { RegionController } from './presentation/controllers/region.controller';
import { CountryController } from './presentation/controllers/country.controller';
import { PropertyController } from './presentation/controllers/property.controller';
import { BuildingController } from './presentation/controllers/building.controller';
import { FloorController } from './presentation/controllers/floor.controller';
import { OrganizationHierarchyController } from './presentation/controllers/organization-hierarchy.controller';

@Module({
  controllers: [
    HotelGroupController,
    RegionController,
    CountryController,
    PropertyController,
    BuildingController,
    FloorController,
    OrganizationHierarchyController,
  ],
  providers: [
    PrismaService,
    HotelGroupService,
    RegionService,
    CountryService,
    PropertyService,
    BuildingService,
    FloorService,
    HierarchyService,
  ],
  exports: [
    PrismaService,
    HotelGroupService,
    RegionService,
    CountryService,
    PropertyService,
    BuildingService,
    FloorService,
    HierarchyService,
  ],
})
export class OrganizationModule {}
