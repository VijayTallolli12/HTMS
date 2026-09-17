import { OrganizationStatus } from './organization-status.enum';

export interface PropertyDto {
  id: string;
  countryId: string;
  code: string;
  name: string;
  legalName: string | null;
  status: OrganizationStatus | string;
  timeZone: string;
  currency: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreatePropertyRequest {
  countryId: string;
  code: string;
  name: string;
  legalName?: string;
  timeZone: string;
  currency: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export interface UpdatePropertyRequest {
  name?: string;
  legalName?: string;
  status?: OrganizationStatus | string;
  timeZone?: string;
  currency?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}
