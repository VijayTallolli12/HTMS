import { DepartmentCode } from '@hms/api-contracts';

export interface ResourceScopeTarget {
  readonly hotelGroupId?: string;
  readonly regionId?: string;
  readonly countryId?: string;
  readonly propertyId?: string;
  readonly departmentCode?: DepartmentCode | string;
}

export interface PropertyHierarchyPath {
  readonly propertyId: string;
  readonly propertyCode: string;
  readonly countryId: string;
  readonly regionId: string;
  readonly hotelGroupId: string;
  readonly status: string;
}
