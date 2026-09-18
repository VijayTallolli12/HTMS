import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RoomTypeDto,
  CreateRoomTypeRequest,
  UpdateRoomTypeRequest,
  RoomDto,
  CreateRoomRequest,
  UpdateRoomRequest,
  RatePlanDto,
  CreateRatePlanRequest,
  UpdateRatePlanRequest,
  DailyInventoryDto,
  StayQuoteResponse,
  ApiSuccessResponse,
} from '@hms/api-contracts';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PmsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private pmsUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/pms`;
  }

  // Room Types
  getRoomTypes(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<RoomTypeDto[]>>(
      `${this.pmsUrl(propertyId)}/room-types?includeInactive=${includeInactive}`,
    );
  }

  getRoomType(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<RoomTypeDto>>(
      `${this.pmsUrl(propertyId)}/room-types/${id}`,
    );
  }

  createRoomType(propertyId: string, dto: CreateRoomTypeRequest) {
    return this.http.post<ApiSuccessResponse<RoomTypeDto>>(
      `${this.pmsUrl(propertyId)}/room-types`,
      dto,
    );
  }

  updateRoomType(propertyId: string, id: string, dto: UpdateRoomTypeRequest) {
    return this.http.put<ApiSuccessResponse<RoomTypeDto>>(
      `${this.pmsUrl(propertyId)}/room-types/${id}`,
      dto,
    );
  }

  deleteRoomType(propertyId: string, id: string) {
    return this.http.delete<ApiSuccessResponse<RoomTypeDto>>(
      `${this.pmsUrl(propertyId)}/room-types/${id}`,
    );
  }

  // Rooms
  getRooms(
    propertyId: string,
    filters?: { buildingId?: string; floorId?: string; roomTypeId?: string; activeOnly?: boolean },
  ) {
    const params: string[] = [];
    if (filters?.buildingId) params.push(`buildingId=${filters.buildingId}`);
    if (filters?.floorId) params.push(`floorId=${filters.floorId}`);
    if (filters?.roomTypeId) params.push(`roomTypeId=${filters.roomTypeId}`);
    if (filters?.activeOnly !== undefined) params.push(`activeOnly=${filters.activeOnly}`);

    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<ApiSuccessResponse<RoomDto[]>>(`${this.pmsUrl(propertyId)}/rooms${query}`);
  }

  createRoom(propertyId: string, dto: CreateRoomRequest) {
    return this.http.post<ApiSuccessResponse<RoomDto>>(`${this.pmsUrl(propertyId)}/rooms`, dto);
  }

  updateRoom(propertyId: string, id: string, dto: UpdateRoomRequest) {
    return this.http.put<ApiSuccessResponse<RoomDto>>(
      `${this.pmsUrl(propertyId)}/rooms/${id}`,
      dto,
    );
  }

  deleteRoom(propertyId: string, id: string) {
    return this.http.delete<ApiSuccessResponse<RoomDto>>(`${this.pmsUrl(propertyId)}/rooms/${id}`);
  }

  // Rate Plans
  getRatePlans(propertyId: string, includeInactive = false) {
    return this.http.get<ApiSuccessResponse<RatePlanDto[]>>(
      `${this.pmsUrl(propertyId)}/rate-plans?includeInactive=${includeInactive}`,
    );
  }

  createRatePlan(propertyId: string, dto: CreateRatePlanRequest) {
    return this.http.post<ApiSuccessResponse<RatePlanDto>>(
      `${this.pmsUrl(propertyId)}/rate-plans`,
      dto,
    );
  }

  updateRatePlan(propertyId: string, id: string, dto: UpdateRatePlanRequest) {
    return this.http.put<ApiSuccessResponse<RatePlanDto>>(
      `${this.pmsUrl(propertyId)}/rate-plans/${id}`,
      dto,
    );
  }

  deleteRatePlan(propertyId: string, id: string) {
    return this.http.delete<ApiSuccessResponse<RatePlanDto>>(
      `${this.pmsUrl(propertyId)}/rate-plans/${id}`,
    );
  }

  // Inventory & ATS Calendar
  getInventoryCalendar(
    propertyId: string,
    startDate: string,
    endDate: string,
    roomTypeId?: string,
  ) {
    const query = roomTypeId
      ? `?startDate=${startDate}&endDate=${endDate}&roomTypeId=${roomTypeId}`
      : `?startDate=${startDate}&endDate=${endDate}`;
    return this.http.get<ApiSuccessResponse<DailyInventoryDto[]>>(
      `${this.pmsUrl(propertyId)}/inventory/calendar${query}`,
    );
  }

  // Stay Quote & Availability
  getStayQuote(
    propertyId: string,
    arrivalDate: string,
    departureDate: string,
    adults: number,
    children?: number,
    roomTypeId?: string,
  ) {
    let query = `?arrivalDate=${arrivalDate}&departureDate=${departureDate}&adults=${adults}`;
    if (children !== undefined) query += `&children=${children}`;
    if (roomTypeId) query += `&roomTypeId=${roomTypeId}`;

    return this.http.get<ApiSuccessResponse<StayQuoteResponse>>(
      `${this.pmsUrl(propertyId)}/availability/quote${query}`,
    );
  }
}
