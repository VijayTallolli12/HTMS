import { OrganizationStatus } from './organization-status.enum';

export interface FloorDto {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  floorNumber: number;
  status: OrganizationStatus | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFloorRequest {
  buildingId: string;
  code: string;
  name: string;
  floorNumber: number;
}

export interface UpdateFloorRequest {
  name?: string;
  floorNumber?: number;
  status?: OrganizationStatus | string;
}
