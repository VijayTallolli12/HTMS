// Organization Domain Events conforming to CloudEvents v1.0 & Event Catalog
// Architecture Freeze: September 16, 2026

export enum OrganizationEventType {
  GROUP_CREATED = 'com.enterprise_hms.organization.group_created.v1',
  REGION_CREATED = 'com.enterprise_hms.organization.region_created.v1',
  COUNTRY_CREATED = 'com.enterprise_hms.organization.country_created.v1',
  PROPERTY_CREATED = 'com.enterprise_hms.organization.property_created.v1',
  BUILDING_CREATED = 'com.enterprise_hms.organization.building_created.v1',
  FLOOR_CREATED = 'com.enterprise_hms.organization.floor_created.v1',
}

export interface GroupCreatedData {
  groupId: string;
  code: string;
  name: string;
  status: string;
}

export interface RegionCreatedData {
  regionId: string;
  hotelGroupId: string;
  code: string;
  name: string;
  status: string;
}

export interface CountryCreatedData {
  countryId: string;
  regionId: string;
  code: string;
  name: string;
  status: string;
}

export interface PropertyCreatedData {
  propertyId: string;
  countryId: string;
  code: string;
  name: string;
  status: string;
  timeZone: string;
  currency: string;
}

export interface BuildingCreatedData {
  buildingId: string;
  propertyId: string;
  code: string;
  name: string;
  status: string;
}

export interface FloorCreatedData {
  floorId: string;
  buildingId: string;
  code: string;
  name: string;
  floorNumber: number;
  status: string;
}
