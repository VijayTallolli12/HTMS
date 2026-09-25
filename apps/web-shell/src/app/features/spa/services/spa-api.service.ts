import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  SpaServiceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaAppointmentDto,
  CreateSpaServiceDto,
  CreateSpaTherapistDto,
  CreateSpaRoomDto,
  CreateSpaAppointmentDto,
  UpdateSpaAppointmentStatusDto,
  CompleteSpaAppointmentDto,
  QuerySpaAppointmentsDto,
  SpaRoomStatus,
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
  // Services
  // -------------------------------------------------------------
  getServices(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<SpaServiceDto[]>>(
      `${this.spaUrl(propertyId)}/services?includeInactive=${includeInactive}`,
    );
  }

  createService(propertyId: string, dto: CreateSpaServiceDto) {
    return this.http.post<ApiSuccessResponse<SpaServiceDto>>(
      `${this.spaUrl(propertyId)}/services`,
      dto,
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

