import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  EventVenueDto,
  EventPackageDto,
  EventResourceDto,
  EventBookingDto,
  CreateEventVenueDto,
  UpdateEventVenueDto,
  CreateEventPackageDto,
  UpdateEventPackageDto,
  CreateEventResourceDto,
  UpdateEventResourceDto,
  CreateEventBookingDto,
  UpdateEventBookingStatusDto,
  CompleteEventBookingDto,
  QueryEventBookingsDto,
  AllocateResourcesDto,
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
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private eventsUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/events`;
  }

  // -------------------------------------------------------------
  // Venues
  // -------------------------------------------------------------
  getVenues(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<EventVenueDto[]>>(
      `${this.eventsUrl(propertyId)}/venues?includeInactive=${includeInactive}`,
    );
  }

  createVenue(propertyId: string, dto: CreateEventVenueDto) {
    return this.http.post<ApiSuccessResponse<EventVenueDto>>(
      `${this.eventsUrl(propertyId)}/venues`,
      dto,
    );
  }

  updateVenue(propertyId: string, id: string, dto: UpdateEventVenueDto) {
    return this.http.patch<ApiSuccessResponse<EventVenueDto>>(
      `${this.eventsUrl(propertyId)}/venues/${id}`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Packages
  // -------------------------------------------------------------
  getPackages(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<EventPackageDto[]>>(
      `${this.eventsUrl(propertyId)}/packages?includeInactive=${includeInactive}`,
    );
  }

  createPackage(propertyId: string, dto: CreateEventPackageDto) {
    return this.http.post<ApiSuccessResponse<EventPackageDto>>(
      `${this.eventsUrl(propertyId)}/packages`,
      dto,
    );
  }

  updatePackage(propertyId: string, id: string, dto: UpdateEventPackageDto) {
    return this.http.patch<ApiSuccessResponse<EventPackageDto>>(
      `${this.eventsUrl(propertyId)}/packages/${id}`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------
  getResources(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<EventResourceDto[]>>(
      `${this.eventsUrl(propertyId)}/resources?includeInactive=${includeInactive}`,
    );
  }

  createResource(propertyId: string, dto: CreateEventResourceDto) {
    return this.http.post<ApiSuccessResponse<EventResourceDto>>(
      `${this.eventsUrl(propertyId)}/resources`,
      dto,
    );
  }

  updateResource(propertyId: string, id: string, dto: UpdateEventResourceDto) {
    return this.http.patch<ApiSuccessResponse<EventResourceDto>>(
      `${this.eventsUrl(propertyId)}/resources/${id}`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------
  getBookings(propertyId: string, query?: QueryEventBookingsDto) {
    let params: any = {};
    if (query?.date) params.date = query.date;
    if (query?.status) params.status = query.status;
    if (query?.venueId) params.venueId = query.venueId;

    return this.http.get<ApiSuccessResponse<EventBookingDto[]>>(
      `${this.eventsUrl(propertyId)}/bookings`,
      { params },
    );
  }

  getBooking(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<EventBookingDto>>(
      `${this.eventsUrl(propertyId)}/bookings/${id}`,
    );
  }

  createBooking(propertyId: string, dto: CreateEventBookingDto) {
    return this.http.post<ApiSuccessResponse<EventBookingDto>>(
      `${this.eventsUrl(propertyId)}/bookings`,
      dto,
    );
  }

  updateBookingStatus(
    propertyId: string,
    id: string,
    dto: UpdateEventBookingStatusDto,
  ) {
    return this.http.patch<ApiSuccessResponse<EventBookingDto>>(
      `${this.eventsUrl(propertyId)}/bookings/${id}/status`,
      dto,
    );
  }

  allocateResources(
    propertyId: string,
    id: string,
    dto: AllocateResourcesDto,
  ) {
    return this.http.post<ApiSuccessResponse<EventBookingDto>>(
      `${this.eventsUrl(propertyId)}/bookings/${id}/resources`,
      dto,
    );
  }

  completeBooking(
    propertyId: string,
    id: string,
    dto: CompleteEventBookingDto,
  ) {
    return this.http.post<ApiSuccessResponse<EventBookingDto>>(
      `${this.eventsUrl(propertyId)}/bookings/${id}/complete`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // In-House Hotel Guests Lookup
  // -------------------------------------------------------------
  getInHouseGuests(propertyId: string) {
    return this.http.get<ApiSuccessResponse<InHouseGuestOption[]>>(
      `${this.eventsUrl(propertyId)}/in-house-guests`,
    );
  }
}

