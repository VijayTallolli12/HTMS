import { OrganizationStatus } from './organization-status.enum';

export interface HotelGroupDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: OrganizationStatus | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateHotelGroupRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateHotelGroupRequest {
  name?: string;
  description?: string;
  status?: OrganizationStatus | string;
}
