import { OrganizationStatus } from './organization-status.enum';

export interface CountryDto {
  id: string;
  regionId: string;
  code: string; // ISO 3166-1 alpha-2
  name: string;
  status: OrganizationStatus | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCountryRequest {
  regionId: string;
  code: string;
  name: string;
}

export interface UpdateCountryRequest {
  name?: string;
  status?: OrganizationStatus | string;
}
