import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  SpaServiceDto,
  SpaServiceDetailDto,
  SpaServicePriceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaAppointmentDto,
  CreateSpaServiceDto,
  UpdateSpaServiceDto,
  CreateSpaTherapistDto,
  CreateSpaRoomDto,
  CreateSpaAppointmentDto,
  UpdateSpaAppointmentStatusDto,
  CompleteSpaAppointmentDto,
  QuerySpaAppointmentsDto,
  SpaRoomStatus,
  SpaServiceCategoryDto,
  CreateSpaServiceCategoryDto,
  UpdateSpaServiceCategoryDto,
  SpaServiceAddonDto,
  CreateSpaServiceAddonDto,
  UpdateSpaServiceAddonDto,
  UpdateSpaServicePriceDto,
  UpdateSpaServiceAvailabilityDto,
  QuerySpaServicesDto,
  SpaServiceAvailability,
} from '@hms/api-contracts';
import { environment } from '../../../../environments/environment';

export interface InHouseGuestOption {
  reservationId: string;
  confirmationNumber: string;
  roomNumber: string;
  guestName: string;
  folioId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SpaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private spaUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/spa`;
  }

  // -------------------------------------------------------------
  // Service Categories
  // -------------------------------------------------------------
  getCategories(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<SpaServiceCategoryDto[]>>(
      `${this.spaUrl(propertyId)}/categories?includeInactive=${includeInactive}`,
    );
  }

  getCategory(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<SpaServiceCategoryDto>>(
      `${this.spaUrl(propertyId)}/categories/${id}`,
    );
  }

  createCategory(propertyId: string, dto: CreateSpaServiceCategoryDto) {
    return this.http.post<ApiSuccessResponse<SpaServiceCategoryDto>>(
      `${this.spaUrl(propertyId)}/categories`,
      dto,
    );
  }

  updateCategory(propertyId: string, id: string, dto: UpdateSpaServiceCategoryDto) {
    return this.http.patch<ApiSuccessResponse<SpaServiceCategoryDto>>(
      `${this.spaUrl(propertyId)}/categories/${id}`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Services
  // -------------------------------------------------------------
  getServices(propertyId: string, query?: QuerySpaServicesDto) {
    const params = new URLSearchParams();
    if (query?.categoryId) params.set('categoryId', query.categoryId);
    if (query?.availability) params.set('availability', query.availability);
    if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
    if (query?.search) params.set('search', query.search);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<ApiSuccessResponse<SpaServiceDto[]>>(
      `${this.spaUrl(propertyId)}/services${qs}`,
    );
  }

  getService(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<SpaServiceDto>>(
      `${this.spaUrl(propertyId)}/services/${id}`,
    );
  }

  getServiceDetail(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<SpaServiceDetailDto>>(
      `${this.spaUrl(propertyId)}/services/${id}/detail`,
    );
  }

  createService(propertyId: string, dto: CreateSpaServiceDto) {
    return this.http.post<ApiSuccessResponse<SpaServiceDto>>(
      `${this.spaUrl(propertyId)}/services`,
      dto,
    );
  }

  updateService(propertyId: string, id: string, dto: UpdateSpaServiceDto) {
    return this.http.patch<ApiSuccessResponse<SpaServiceDto>>(
      `${this.spaUrl(propertyId)}/services/${id}`,
      dto,
    );
  }

  updateServicePrice(propertyId: string, id: string, dto: UpdateSpaServicePriceDto) {
    return this.http.patch<ApiSuccessResponse<SpaServicePriceDto>>(
      `${this.spaUrl(propertyId)}/services/${id}/price`,
      dto,
    );
  }

  updateServiceAvailability(propertyId: string, id: string, dto: UpdateSpaServiceAvailabilityDto) {
    return this.http.patch<ApiSuccessResponse<SpaServiceDto>>(
      `${this.spaUrl(propertyId)}/services/${id}/availability`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Service Addons
  // -------------------------------------------------------------
  getAddons(propertyId: string, serviceId: string) {
    return this.http.get<ApiSuccessResponse<SpaServiceAddonDto[]>>(
      `${this.spaUrl(propertyId)}/services/${serviceId}/addons`,
    );
  }

  getAddon(propertyId: string, serviceId: string, id: string) {
    return this.http.get<ApiSuccessResponse<SpaServiceAddonDto>>(
      `${this.spaUrl(propertyId)}/services/${serviceId}/addons/${id}`,
    );
  }

  createAddon(propertyId: string, serviceId: string, dto: CreateSpaServiceAddonDto) {
    return this.http.post<ApiSuccessResponse<SpaServiceAddonDto>>(
      `${this.spaUrl(propertyId)}/services/${serviceId}/addons`,
      dto,
    );
  }

  updateAddon(propertyId: string, serviceId: string, id: string, dto: UpdateSpaServiceAddonDto) {
    return this.http.patch<ApiSuccessResponse<SpaServiceAddonDto>>(
      `${this.spaUrl(propertyId)}/services/${serviceId}/addons/${id}`,
      dto,
    );
  }

  deleteAddon(propertyId: string, serviceId: string, id: string) {
    return this.http.delete(
      `${this.spaUrl(propertyId)}/services/${serviceId}/addons/${id}`,
    );
  }

  // -------------------------------------------------------------
  // Therapists
  // -------------------------------------------------------------
  getTherapists(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<SpaTherapistDto[]>>(
      `${this.spaUrl(propertyId)}/therapists?includeInactive=${includeInactive}`,
    );
  }

  createTherapist(propertyId: string, dto: CreateSpaTherapistDto) {
    return this.http.post<ApiSuccessResponse<SpaTherapistDto>>(
      `${this.spaUrl(propertyId)}/therapists`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Rooms
  // -------------------------------------------------------------
  getRooms(propertyId: string, status?: SpaRoomStatus) {
    const query = status ? `?status=${status}` : '';
    return this.http.get<ApiSuccessResponse<SpaRoomDto[]>>(
      `${this.spaUrl(propertyId)}/rooms${query}`,
    );
  }

  createRoom(propertyId: string, dto: CreateSpaRoomDto) {
    return this.http.post<ApiSuccessResponse<SpaRoomDto>>(
      `${this.spaUrl(propertyId)}/rooms`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // In-House Checked-in Guests
  // -------------------------------------------------------------
  getInHouseGuests(propertyId: string) {
    return this.http.get<ApiSuccessResponse<InHouseGuestOption[]>>(
      `${this.spaUrl(propertyId)}/in-house-guests`,
    );
  }

  // -------------------------------------------------------------
  // Appointments
  // -------------------------------------------------------------
  getAppointments(propertyId: string, query?: QuerySpaAppointmentsDto) {
    const params = new URLSearchParams();
    if (query?.date) params.set('date', query.date);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);
    if (query?.status) params.set('status', query.status);
    if (query?.therapistId) params.set('therapistId', query.therapistId);
    if (query?.roomId) params.set('roomId', query.roomId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<ApiSuccessResponse<SpaAppointmentDto[]>>(
      `${this.spaUrl(propertyId)}/appointments${qs}`,
    );
  }

  getAppointment(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<SpaAppointmentDto>>(
      `${this.spaUrl(propertyId)}/appointments/${id}`,
    );
  }

  createAppointment(propertyId: string, dto: CreateSpaAppointmentDto) {
    return this.http.post<ApiSuccessResponse<SpaAppointmentDto>>(
      `${this.spaUrl(propertyId)}/appointments`,
      dto,
    );
  }

  updateAppointmentStatus(
    propertyId: string,
    id: string,
    dto: UpdateSpaAppointmentStatusDto,
  ) {
    return this.http.post<ApiSuccessResponse<SpaAppointmentDto>>(
      `${this.spaUrl(propertyId)}/appointments/${id}/status`,
      dto,
    );
  }

  completeAppointment(
    propertyId: string,
    id: string,
    dto: CompleteSpaAppointmentDto,
  ) {
    return this.http.post<ApiSuccessResponse<SpaAppointmentDto>>(
      `${this.spaUrl(propertyId)}/appointments/${id}/complete`,
      dto,
    );
  }
}