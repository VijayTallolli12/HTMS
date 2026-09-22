import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  HotelGroupDto,
  RegionDto,
  CountryDto,
  PropertyDto,
  BuildingDto,
  FloorDto,
  OrganizationHierarchyTree,
  CreateHotelGroupRequest,
  CreateRegionRequest,
  CreateCountryRequest,
  CreatePropertyRequest,
  CreateBuildingRequest,
  CreateFloorRequest,
  UpdateHotelGroupRequest,
  UpdateRegionRequest,
  UpdateCountryRequest,
  UpdatePropertyRequest,
  UpdateBuildingRequest,
  UpdateFloorRequest,
  ApiSuccessResponse,
} from '@hms/api-contracts';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/organization`;

  private readonly activePropertyKey = 'hms_active_property';

  private getStoredProperty(): PropertyDto | null {
    try {
      const item = localStorage.getItem(this.activePropertyKey);
      if (!item || item === 'null' || item === 'undefined') {
        return null;
      }
      const parsed = JSON.parse(item);
      return parsed && parsed.id ? parsed : null;
    } catch {
      return null;
    }
  }

  readonly activePropertyContext = signal<PropertyDto | null>(this.getStoredProperty());

  loadInitialProperty(): void {
    const stored = this.getStoredProperty();
    if (stored) {
      this.activePropertyContext.set(stored);
    }
    this.getProperties().subscribe({
      next: (res) => {
        if (res.data && res.data.length > 0) {
          const current = this.activePropertyContext();
          const match = (current ? res.data.find((p) => p.id === current.id) : null) || res.data[0];
          this.setActiveProperty(match);
        }
      },
      error: () => {
        // Preserves active demo property context if API lacks read permission
      },
    });
  }

  getHierarchyTree() {
    return this.http.get<ApiSuccessResponse<OrganizationHierarchyTree>>(
      `${this.baseUrl}/hierarchy/tree`,
    );
  }

  getGroups() {
    return this.http.get<ApiSuccessResponse<HotelGroupDto[]>>(`${this.baseUrl}/groups`);
  }

  createGroup(dto: CreateHotelGroupRequest) {
    return this.http.post<ApiSuccessResponse<HotelGroupDto>>(`${this.baseUrl}/groups`, dto);
  }

  updateGroup(id: string, dto: UpdateHotelGroupRequest) {
    return this.http.patch<ApiSuccessResponse<HotelGroupDto>>(`${this.baseUrl}/groups/${id}`, dto);
  }

  deleteGroup(id: string) {
    return this.http.delete<ApiSuccessResponse<HotelGroupDto>>(`${this.baseUrl}/groups/${id}`);
  }

  getRegions(hotelGroupId?: string) {
    const url = hotelGroupId
      ? `${this.baseUrl}/regions?hotelGroupId=${hotelGroupId}`
      : `${this.baseUrl}/regions`;
    return this.http.get<ApiSuccessResponse<RegionDto[]>>(url);
  }

  createRegion(dto: CreateRegionRequest) {
    return this.http.post<ApiSuccessResponse<RegionDto>>(`${this.baseUrl}/regions`, dto);
  }

  updateRegion(id: string, dto: UpdateRegionRequest) {
    return this.http.patch<ApiSuccessResponse<RegionDto>>(`${this.baseUrl}/regions/${id}`, dto);
  }

  deleteRegion(id: string) {
    return this.http.delete<ApiSuccessResponse<RegionDto>>(`${this.baseUrl}/regions/${id}`);
  }

  getCountries(regionId?: string) {
    const url = regionId
      ? `${this.baseUrl}/countries?regionId=${regionId}`
      : `${this.baseUrl}/countries`;
    return this.http.get<ApiSuccessResponse<CountryDto[]>>(url);
  }

  createCountry(dto: CreateCountryRequest) {
    return this.http.post<ApiSuccessResponse<CountryDto>>(`${this.baseUrl}/countries`, dto);
  }

  updateCountry(id: string, dto: UpdateCountryRequest) {
    return this.http.patch<ApiSuccessResponse<CountryDto>>(`${this.baseUrl}/countries/${id}`, dto);
  }

  deleteCountry(id: string) {
    return this.http.delete<ApiSuccessResponse<CountryDto>>(`${this.baseUrl}/countries/${id}`);
  }

  getProperties(countryId?: string) {
    const url = countryId
      ? `${this.baseUrl}/properties?countryId=${countryId}`
      : `${this.baseUrl}/properties`;
    return this.http.get<ApiSuccessResponse<PropertyDto[]>>(url);
  }

  createProperty(dto: CreatePropertyRequest) {
    return this.http.post<ApiSuccessResponse<PropertyDto>>(`${this.baseUrl}/properties`, dto);
  }

  updateProperty(id: string, dto: UpdatePropertyRequest) {
    return this.http.patch<ApiSuccessResponse<PropertyDto>>(
      `${this.baseUrl}/properties/${id}`,
      dto,
    );
  }

  deleteProperty(id: string) {
    return this.http.delete<ApiSuccessResponse<PropertyDto>>(`${this.baseUrl}/properties/${id}`);
  }

  getBuildings(propertyId?: string) {
    const url = propertyId
      ? `${this.baseUrl}/buildings?propertyId=${propertyId}`
      : `${this.baseUrl}/buildings`;
    return this.http.get<ApiSuccessResponse<BuildingDto[]>>(url);
  }

  createBuilding(dto: CreateBuildingRequest) {
    return this.http.post<ApiSuccessResponse<BuildingDto>>(`${this.baseUrl}/buildings`, dto);
  }

  updateBuilding(id: string, dto: UpdateBuildingRequest) {
    return this.http.patch<ApiSuccessResponse<BuildingDto>>(`${this.baseUrl}/buildings/${id}`, dto);
  }

  deleteBuilding(id: string) {
    return this.http.delete<ApiSuccessResponse<BuildingDto>>(`${this.baseUrl}/buildings/${id}`);
  }

  getFloors(buildingId?: string) {
    const url = buildingId
      ? `${this.baseUrl}/floors?buildingId=${buildingId}`
      : `${this.baseUrl}/floors`;
    return this.http.get<ApiSuccessResponse<FloorDto[]>>(url);
  }

  createFloor(dto: CreateFloorRequest) {
    return this.http.post<ApiSuccessResponse<FloorDto>>(`${this.baseUrl}/floors`, dto);
  }

  updateFloor(id: string, dto: UpdateFloorRequest) {
    return this.http.patch<ApiSuccessResponse<FloorDto>>(`${this.baseUrl}/floors/${id}`, dto);
  }

  deleteFloor(id: string) {
    return this.http.delete<ApiSuccessResponse<FloorDto>>(`${this.baseUrl}/floors/${id}`);
  }

  setActiveProperty(property: PropertyDto | null): void {
    if (property) {
      localStorage.setItem(this.activePropertyKey, JSON.stringify(property));
    } else {
      localStorage.removeItem(this.activePropertyKey);
    }
    this.activePropertyContext.set(property);
  }
}
