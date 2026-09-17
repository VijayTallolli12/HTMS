import { HotelGroupDto } from './hotel-group.contract';
import { RegionDto } from './region.contract';
import { CountryDto } from './country.contract';
import { PropertyDto } from './property.contract';
import { BuildingDto } from './building.contract';
import { FloorDto } from './floor.contract';

export interface HierarchyFloorNode extends FloorDto {}

export interface HierarchyBuildingNode extends BuildingDto {
  floors: HierarchyFloorNode[];
}

export interface HierarchyPropertyNode extends PropertyDto {
  buildings: HierarchyBuildingNode[];
}

export interface HierarchyCountryNode extends CountryDto {
  properties: HierarchyPropertyNode[];
}

export interface HierarchyRegionNode extends RegionDto {
  countries: HierarchyCountryNode[];
}

export interface HierarchyHotelGroupNode extends HotelGroupDto {
  regions: HierarchyRegionNode[];
}

export interface OrganizationHierarchyTree {
  groups: HierarchyHotelGroupNode[];
}
