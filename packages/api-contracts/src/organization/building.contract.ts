import { OrganizationStatus } from './organization-status.enum';

export interface BuildingDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description: string | null;
  status: OrganizationStatus | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateBuildingRequest {
  propertyId: string;
  code: string;
  name: string;
  description?: string;
}

export interface UpdateBuildingRequest {
  name?: string;
  description?: string;
  status?: OrganizationStatus | string;
}
