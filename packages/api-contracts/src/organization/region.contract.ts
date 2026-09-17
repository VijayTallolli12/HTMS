import { OrganizationStatus } from './organization-status.enum';

export interface RegionDto {
  id: string;
  hotelGroupId: string;
  code: string;
  name: string;
  description: string | null;
  status: OrganizationStatus | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateRegionRequest {
  hotelGroupId: string;
  code: string;
  name: string;
  description?: string;
}

export interface UpdateRegionRequest {
  name?: string;
  description?: string;
  status?: OrganizationStatus | string;
}
