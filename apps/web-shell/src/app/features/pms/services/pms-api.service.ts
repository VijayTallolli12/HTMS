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
  ReservationDto,
  CreateReservationDto,
  CancelReservationDto,
  QueryReservationsDto,
  RoomStatusDto,
  UpdateRoomStatusRequest,
  QueryRoomStatusDto,
  RoomStatusLogDto,
  AssignRoomDto,
  UnassignRoomDto,
  CheckInDto,
  QueryEligibleRoomsDto,
  EligibleRoomDto,
  CheckInResponseDto,
  ReservationAssignmentLogDto,
  FolioDto,
  FolioDetailDto,
  CreateFolioDto,
  PostChargeDto,
  RecordPaymentDto,
  FolioTransactionDto,
  PaymentDto,
  CheckoutResponseDto,
  HousekeepingTaskDto,
  InspectionResult,
  QueryHousekeepingTasksDto,
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

  // ==========================================
  // ROOM TYPES
  // ==========================================
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

  // ==========================================
  // ROOMS
  // ==========================================
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

  // ==========================================
  // RATE PLANS
  // ==========================================
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

  // ==========================================
  // INVENTORY & ATS CALENDAR
  // ==========================================
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

  // ==========================================
  // RESERVATIONS (T05)
  // ==========================================
  getReservations(propertyId: string, query?: QueryReservationsDto) {
    const params: string[] = [];
    if (query?.arrivalDate) params.push(`arrivalDate=${query.arrivalDate}`);
    if (query?.departureDate) params.push(`departureDate=${query.departureDate}`);
    if (query?.status) params.push(`status=${query.status}`);
    if (query?.roomTypeId) params.push(`roomTypeId=${query.roomTypeId}`);
    if (query?.guestName) params.push(`guestName=${encodeURIComponent(query.guestName)}`);
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: ReservationDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/reservations${q}`);
  }

  getReservation(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<ReservationDto>>(
      `${this.pmsUrl(propertyId)}/reservations/${id}`,
    );
  }

  createReservation(propertyId: string, dto: CreateReservationDto) {
    return this.http.post<ApiSuccessResponse<ReservationDto>>(
      `${this.pmsUrl(propertyId)}/reservations`,
      dto,
    );
  }

  cancelReservation(propertyId: string, id: string, dto: CancelReservationDto) {
    return this.http.post<ApiSuccessResponse<ReservationDto>>(
      `${this.pmsUrl(propertyId)}/reservations/${id}/cancel`,
      dto,
    );
  }

  // ==========================================
  // ROOM OPERATIONS (T06)
  // ==========================================
  getRoomOperationsRooms(propertyId: string, query?: QueryRoomStatusDto) {
    const params: string[] = [];
    if (query?.buildingId) params.push(`buildingId=${query.buildingId}`);
    if (query?.floorId) params.push(`floorId=${query.floorId}`);
    if (query?.roomTypeId) params.push(`roomTypeId=${query.roomTypeId}`);
    if (query?.housekeepingStatus) params.push(`housekeepingStatus=${query.housekeepingStatus}`);
    if (query?.serviceStatus) params.push(`serviceStatus=${query.serviceStatus}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<ApiSuccessResponse<RoomStatusDto[]>>(
      `${this.pmsUrl(propertyId)}/room-operations/rooms${q}`,
    );
  }

  getRoomOperationsRoom(propertyId: string, roomId: string) {
    return this.http.get<ApiSuccessResponse<RoomStatusDto>>(
      `${this.pmsUrl(propertyId)}/room-operations/rooms/${roomId}`,
    );
  }

  updateRoomHousekeepingStatus(propertyId: string, roomId: string, dto: UpdateRoomStatusRequest) {
    return this.http.patch<ApiSuccessResponse<RoomStatusDto>>(
      `${this.pmsUrl(propertyId)}/room-operations/rooms/${roomId}/status`,
      dto,
    );
  }

  getRoomHistory(propertyId: string, roomId: string) {
    return this.http.get<ApiSuccessResponse<RoomStatusLogDto[]>>(
      `${this.pmsUrl(propertyId)}/room-operations/rooms/${roomId}/history`,
    );
  }

  // ==========================================
  // FRONT OFFICE (T07)
  // ==========================================
  getEligibleRooms(propertyId: string, query: QueryEligibleRoomsDto) {
    const params: string[] = [`reservationId=${query.reservationId}`];
    if (query.includeDirty !== undefined) params.push(`includeDirty=${query.includeDirty}`);
    if (query.buildingId) params.push(`buildingId=${query.buildingId}`);
    if (query.floorId) params.push(`floorId=${query.floorId}`);

    return this.http.get<ApiSuccessResponse<EligibleRoomDto[]>>(
      `${this.pmsUrl(propertyId)}/front-office/eligible-rooms?${params.join('&')}`,
    );
  }

  assignRoom(propertyId: string, reservationId: string, dto: AssignRoomDto) {
    return this.http.post<ApiSuccessResponse<ReservationDto>>(
      `${this.pmsUrl(propertyId)}/front-office/reservations/${reservationId}/assign-room`,
      dto,
    );
  }

  unassignRoom(propertyId: string, reservationId: string, dto: UnassignRoomDto) {
    return this.http.post<ApiSuccessResponse<ReservationDto>>(
      `${this.pmsUrl(propertyId)}/front-office/reservations/${reservationId}/unassign-room`,
      dto,
    );
  }

  checkIn(propertyId: string, reservationId: string, dto: CheckInDto) {
    return this.http.post<ApiSuccessResponse<CheckInResponseDto>>(
      `${this.pmsUrl(propertyId)}/front-office/reservations/${reservationId}/check-in`,
      dto,
    );
  }

  getAssignmentLogs(propertyId: string, reservationId: string) {
    return this.http.get<
      ApiSuccessResponse<{ items: ReservationAssignmentLogDto[]; total: number }>
    >(`${this.pmsUrl(propertyId)}/front-office/reservations/${reservationId}/assignment-logs`);
  }

  // ==========================================
  // FINANCE & FOLIO SETTLEMENT (T08)
  // ==========================================
  getFolios(propertyId: string, reservationId: string) {
    return this.http.get<ApiSuccessResponse<FolioDto[]>>(
      `${this.pmsUrl(propertyId)}/finance/folios?reservationId=${reservationId}`,
    );
  }

  getFolioById(propertyId: string, folioId: string) {
    return this.http.get<ApiSuccessResponse<FolioDetailDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios/${folioId}`,
    );
  }

  createFolio(propertyId: string, dto: CreateFolioDto) {
    return this.http.post<ApiSuccessResponse<FolioDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios`,
      dto,
    );
  }

  postCharge(propertyId: string, folioId: string, dto: PostChargeDto) {
    return this.http.post<ApiSuccessResponse<FolioTransactionDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios/${folioId}/charges`,
      dto,
    );
  }

  recordPayment(propertyId: string, folioId: string, dto: RecordPaymentDto) {
    return this.http.post<ApiSuccessResponse<PaymentDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios/${folioId}/payments`,
      dto,
    );
  }

  checkout(propertyId: string, reservationId: string) {
    return this.http.post<ApiSuccessResponse<CheckoutResponseDto>>(
      `${this.pmsUrl(propertyId)}/finance/reservations/${reservationId}/checkout`,
      {},
    );
  }

  // ==========================================
  // HOUSEKEEPING OPERATIONS (W1-T10)
  // ==========================================
  getHousekeepingTasks(propertyId: string, query?: QueryHousekeepingTasksDto) {
    const params: string[] = [];
    if (query?.status) params.push(`status=${query.status}`);
    if (query?.taskType) params.push(`taskType=${query.taskType}`);
    if (query?.assignedAttendantId) params.push(`assignedAttendantId=${query.assignedAttendantId}`);
    if (query?.roomId) params.push(`roomId=${query.roomId}`);
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: HousekeepingTaskDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/housekeeping/tasks${queryStr}`);
  }

  getHousekeepingTaskById(propertyId: string, taskId: string) {
    return this.http.get<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}`,
    );
  }

  assignHousekeepingTask(propertyId: string, taskId: string, assignedAttendantId: string) {
    return this.http.post<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}/assign`,
      { assignedAttendantId },
    );
  }

  claimHousekeepingTask(propertyId: string, taskId: string) {
    return this.http.post<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}/claim`,
      {},
    );
  }

  startHousekeepingCleaning(propertyId: string, taskId: string) {
    return this.http.patch<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}/start`,
      {},
    );
  }

  completeHousekeepingCleaning(propertyId: string, taskId: string) {
    return this.http.patch<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}/complete`,
      {},
    );
  }

  inspectHousekeepingTask(
    propertyId: string,
    taskId: string,
    result: InspectionResult,
    notes?: string,
  ) {
    return this.http.post<ApiSuccessResponse<HousekeepingTaskDto>>(
      `${this.pmsUrl(propertyId)}/housekeeping/tasks/${taskId}/inspect`,
      { result, notes },
    );
  }
}
