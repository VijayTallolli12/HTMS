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
  OccupancyBoard,
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
  AddWorkOrderNoteRequest,
  AssetDto,
  AssetListResponse,
  AssignWorkOrderRequest,
  CloseWorkOrderRequest,
  CreateAssetRequest,
  CreateMaintenanceScheduleRequest,
  CreateWorkOrderRequest,
  EngineeringSummaryDto,
  MaintenanceScheduleDto,
  MaintenanceScheduleListResponse,
  QueryAssetsDto,
  QueryMaintenanceSchedulesDto,
  QueryWorkOrdersDto,
  UpdateAssetRequest,
  UpdateMaintenanceScheduleRequest,
  UpdateWorkOrderStatusRequest,
  WorkOrderDetailDto,
  WorkOrderDto,
  WorkOrderListResponse,
  WorkOrderNoteDto,
  NightAuditStatusDto,
  NightAuditValidationReportDto,
  NightAuditRunDto,
  RunNightAuditRequest,
  NightAuditRecoveryRequest,
  PropertyBusinessDateDto,
  // CRM & Loyalty
  GuestCrmProfileDto,
  CreateGuestCrmProfileDto,
  UpdateGuestCrmProfileDto,
  GuestPreferenceDto,
  CreateGuestPreferenceDto,
  UpdateGuestPreferenceDto,
  GuestSearchDto,
  GuestSearchResultDto,
  GuestRelationshipViewDto,
  LoyaltyMembershipDto,
  CreateLoyaltyMembershipDto,
  LoyaltyTransactionDto,
  AwardPointsDto,
  RedeemPointsDto,
  AdjustPointsDto,
  QueryLoyaltyTransactionsDto,
  LoyaltyTierThresholds,
  // HR & Payroll
  EmployeeDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
  EmployeeCompensationDto,
  CreateEmployeeCompensationDto,
  PayrollPeriodDto,
  CreatePayrollPeriodDto,
  PayrollRunDto,
  CreatePayrollRunDto,
  CalculatePayrollDto,
  QueryPayrollPeriodsDto,
  QueryPayrollRunsDto,
  PayrollLineDto,
  PayrollSummaryDto,
  // Revenue Management
  RevenueKpiRangeResponse,
  OccupancyTrendResponse,
  AdrTrendResponse,
  RevenueTrendResponse,
  PickupAnalysisResponse,
  RoomTypePerformanceResponse,
  RevenueByDepartmentResponse,
  ForecastResponse,
  MarketRateProviderConfigDto,
  MarketRateResponse,
  PricingRecommendationResponse,
  CompetitorSetResponse,
  CreateMarketRateProviderRequest,
  UpdateMarketRateProviderRequest,
  CreateCompetitorSetRequest,
  UpdateCompetitorSetRequest,
  RevenueKpiRangeQuery,
  MarketRateQuery,
  PricingRecommendationQuery,
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
  /** Occupancy board: rich per-room cards (guest/stay/folio/F&B/spa). */
  getOccupancyBoard(propertyId: string) {
    return this.http.get<ApiSuccessResponse<OccupancyBoard>>(
      `${this.pmsUrl(propertyId)}/room-operations/board`,
    );
  }

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
    const idempotencyKey = `folio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return this.http.post<ApiSuccessResponse<FolioDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios`,
      dto,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  postCharge(propertyId: string, folioId: string, dto: PostChargeDto) {
    const idempotencyKey = `chg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return this.http.post<ApiSuccessResponse<FolioTransactionDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios/${folioId}/charges`,
      dto,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  recordPayment(propertyId: string, folioId: string, dto: RecordPaymentDto) {
    const idempotencyKey = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return this.http.post<ApiSuccessResponse<PaymentDto>>(
      `${this.pmsUrl(propertyId)}/finance/folios/${folioId}/payments`,
      dto,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  checkout(propertyId: string, reservationId: string) {
    // Checkout is an idempotent financial operation. The API rejects requests
    // without this header, so generate a client token for every user-initiated
    // attempt (retries of the same HTTP request remain safe at the API layer).
    const idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return this.http.post<ApiSuccessResponse<CheckoutResponseDto>>(
      `${this.pmsUrl(propertyId)}/finance/reservations/${reservationId}/checkout`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
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

  // ==========================================
  // ENGINEERING & MAINTENANCE
  // ==========================================
  getEngineeringSummary(propertyId: string) {
    return this.http.get<ApiSuccessResponse<EngineeringSummaryDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/summary`,
    );
  }

  getWorkOrders(propertyId: string, query?: QueryWorkOrdersDto) {
    const params: Record<string, string> = {};
    if (query?.status) params['status'] = query.status;
    if (query?.priority) params['priority'] = query.priority;
    if (query?.assignedTechnicianId) params['assignedTechnicianId'] = query.assignedTechnicianId;
    if (query?.roomId) params['roomId'] = query.roomId;
    if (query?.assetId) params['assetId'] = query.assetId;
    if (query?.overdue) params['overdue'] = 'true';
    if (query?.search) params['search'] = query.search;
    if (query?.page) params['page'] = String(query.page);
    if (query?.limit) params['limit'] = String(query.limit);

    return this.http.get<ApiSuccessResponse<WorkOrderListResponse>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders`,
      { params },
    );
  }

  getWorkOrder(propertyId: string, workOrderId: string) {
    return this.http.get<ApiSuccessResponse<WorkOrderDetailDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/${workOrderId}`,
    );
  }

  createWorkOrder(propertyId: string, req: CreateWorkOrderRequest) {
    return this.http.post<ApiSuccessResponse<WorkOrderDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders`,
      req,
    );
  }

  assignWorkOrder(propertyId: string, workOrderId: string, req: AssignWorkOrderRequest) {
    return this.http.post<ApiSuccessResponse<WorkOrderDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/${workOrderId}/assign`,
      req,
    );
  }

  updateWorkOrderStatus(propertyId: string, workOrderId: string, req: UpdateWorkOrderStatusRequest) {
    return this.http.patch<ApiSuccessResponse<WorkOrderDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/${workOrderId}/status`,
      req,
    );
  }

  closeWorkOrder(propertyId: string, workOrderId: string, req: CloseWorkOrderRequest) {
    return this.http.post<ApiSuccessResponse<WorkOrderDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/${workOrderId}/close`,
      req,
    );
  }

  addWorkOrderNote(propertyId: string, workOrderId: string, req: AddWorkOrderNoteRequest) {
    return this.http.post<ApiSuccessResponse<WorkOrderNoteDto>>(
      `${this.pmsUrl(propertyId)}/engineering/work-orders/${workOrderId}/notes`,
      req,
    );
  }

  getAssets(propertyId: string, query?: QueryAssetsDto) {
    const params: Record<string, string> = {};
    if (query?.status) params['status'] = query.status;
    if (query?.category) params['category'] = query.category;
    if (query?.roomId) params['roomId'] = query.roomId;
    if (query?.search) params['search'] = query.search;
    if (query?.page) params['page'] = String(query.page);
    if (query?.limit) params['limit'] = String(query.limit);

    return this.http.get<ApiSuccessResponse<AssetListResponse>>(
      `${this.pmsUrl(propertyId)}/engineering/assets`,
      { params },
    );
  }

  createAsset(propertyId: string, req: CreateAssetRequest) {
    return this.http.post<ApiSuccessResponse<AssetDto>>(
      `${this.pmsUrl(propertyId)}/engineering/assets`,
      req,
    );
  }

  updateAsset(propertyId: string, assetId: string, req: UpdateAssetRequest) {
    return this.http.patch<ApiSuccessResponse<AssetDto>>(
      `${this.pmsUrl(propertyId)}/engineering/assets/${assetId}`,
      req,
    );
  }

  getMaintenanceSchedules(propertyId: string, query?: QueryMaintenanceSchedulesDto) {
    const params: Record<string, string> = {};
    if (query?.assetId) params['assetId'] = query.assetId;
    if (query?.isActive !== undefined) params['isActive'] = String(query.isActive);
    if (query?.dueStatus) params['dueStatus'] = query.dueStatus;
    if (query?.page) params['page'] = String(query.page);
    if (query?.limit) params['limit'] = String(query.limit);

    return this.http.get<ApiSuccessResponse<MaintenanceScheduleListResponse>>(
      `${this.pmsUrl(propertyId)}/engineering/schedules`,
      { params },
    );
  }

  createMaintenanceSchedule(propertyId: string, req: CreateMaintenanceScheduleRequest) {
    return this.http.post<ApiSuccessResponse<MaintenanceScheduleDto>>(
      `${this.pmsUrl(propertyId)}/engineering/schedules`,
      req,
    );
  }

  updateMaintenanceSchedule(propertyId: string, scheduleId: string, req: UpdateMaintenanceScheduleRequest) {
    return this.http.patch<ApiSuccessResponse<MaintenanceScheduleDto>>(
      `${this.pmsUrl(propertyId)}/engineering/schedules/${scheduleId}`,
      req,
    );
  }

  // ==========================================
  // NIGHT AUDIT & HOTEL BUSINESS DATE
  // ==========================================
  getNightAuditStatus(propertyId: string) {
    return this.http.get<ApiSuccessResponse<NightAuditStatusDto>>(
      `${this.pmsUrl(propertyId)}/night-audit/status`,
    );
  }

  validateNightAudit(propertyId: string) {
    return this.http.post<ApiSuccessResponse<NightAuditValidationReportDto>>(
      `${this.pmsUrl(propertyId)}/night-audit/validate`,
      {},
    );
  }

  runNightAudit(propertyId: string, req: RunNightAuditRequest) {
    return this.http.post<ApiSuccessResponse<NightAuditRunDto>>(
      `${this.pmsUrl(propertyId)}/night-audit/run`,
      req,
    );
  }

  recoverNightAudit(propertyId: string, req: NightAuditRecoveryRequest) {
    return this.http.post<ApiSuccessResponse<PropertyBusinessDateDto>>(
      `${this.pmsUrl(propertyId)}/night-audit/recover`,
      req,
    );
  }

  getNightAuditHistory(propertyId: string, limit = 20) {
    return this.http.get<ApiSuccessResponse<NightAuditRunDto[]>>(
      `${this.pmsUrl(propertyId)}/night-audit/history?limit=${limit}`,
    );
  }

  getNightAuditRunById(propertyId: string, runId: string) {
    return this.http.get<ApiSuccessResponse<NightAuditRunDto>>(
      `${this.pmsUrl(propertyId)}/night-audit/runs/${runId}`,
    );
  }

  // ==========================================
  // CRM & LOYALTY
  // ==========================================
  searchGuests(propertyId: string, query?: GuestSearchDto) {
    const params: string[] = [];
    if (query?.query) params.push(`query=${encodeURIComponent(query.query)}`);
    if (query?.vipOnly) params.push(`vipOnly=true`);
    if (query?.tier) params.push(`tier=${query.tier}`);
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: GuestSearchResultDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/crm/guests/search${q}`);
  }

  getGuestProfile(propertyId: string, guestId: string) {
    return this.http.get<ApiSuccessResponse<GuestCrmProfileDto>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/profile`,
    );
  }

  updateGuestProfile(propertyId: string, guestId: string, dto: UpdateGuestCrmProfileDto) {
    return this.http.put<ApiSuccessResponse<GuestCrmProfileDto>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/profile`,
      dto,
    );
  }

  listPreferences(propertyId: string, guestId: string) {
    return this.http.get<ApiSuccessResponse<GuestPreferenceDto[]>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/preferences`,
    );
  }

  createPreference(propertyId: string, guestId: string, dto: CreateGuestPreferenceDto) {
    return this.http.post<ApiSuccessResponse<GuestPreferenceDto>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/preferences`,
      dto,
    );
  }

  updatePreference(propertyId: string, guestId: string, category: string, preference: string, dto: UpdateGuestPreferenceDto) {
    return this.http.put<ApiSuccessResponse<GuestPreferenceDto>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/preferences/${category}/${preference}`,
      dto,
    );
  }

  deletePreference(propertyId: string, guestId: string, category: string, preference: string) {
    return this.http.delete(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/preferences/${category}/${preference}`,
    );
  }

  getGuestRelationshipView(propertyId: string, guestId: string) {
    return this.http.get<ApiSuccessResponse<GuestRelationshipViewDto>>(
      `${this.pmsUrl(propertyId)}/crm/guests/${guestId}/relationship`,
    );
  }

  getLoyaltyMembership(propertyId: string, guestId: string) {
    return this.http.get<ApiSuccessResponse<LoyaltyMembershipDto | null>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/memberships/${guestId}`,
    );
  }

  createLoyaltyMembership(propertyId: string, dto: CreateLoyaltyMembershipDto) {
    return this.http.post<ApiSuccessResponse<LoyaltyMembershipDto>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/memberships`,
      dto,
    );
  }

  awardPoints(propertyId: string, dto: AwardPointsDto) {
    return this.http.post<ApiSuccessResponse<LoyaltyTransactionDto>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/points/award`,
      dto,
    );
  }

  redeemPoints(propertyId: string, dto: RedeemPointsDto) {
    return this.http.post<ApiSuccessResponse<LoyaltyTransactionDto>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/points/redeem`,
      dto,
    );
  }

  adjustPoints(propertyId: string, dto: AdjustPointsDto) {
    return this.http.post<ApiSuccessResponse<LoyaltyTransactionDto>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/points/adjust`,
      dto,
    );
  }

  getLoyaltyTransactions(propertyId: string, query?: QueryLoyaltyTransactionsDto) {
    const params: string[] = [];
    if (query?.membershipId) params.push(`membershipId=${query.membershipId}`);
    if (query?.type) params.push(`type=${query.type}`);
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: LoyaltyTransactionDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/crm/loyalty/transactions${q}`);
  }

  getLoyaltyTiers(propertyId: string) {
    return this.http.get<ApiSuccessResponse<LoyaltyTierThresholds>>(
      `${this.pmsUrl(propertyId)}/crm/loyalty/tiers`,
    );
  }

  // ==========================================
  // HR & PAYROLL
  // ==========================================
  getEmployees(propertyId: string, query?: QueryEmployeesDto) {
    const params: string[] = [];
    if (query?.status) params.push(`status=${query.status}`);
    if (query?.department) params.push(`department=${query.department}`);
    if (query?.search) params.push(`search=${encodeURIComponent(query.search)}`);
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: EmployeeDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/hr-payroll/employees${q}`);
  }

  getEmployeeCount(propertyId: string) {
    return this.http.get<ApiSuccessResponse<{ count: number }>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/count`,
    );
  }

  createEmployee(propertyId: string, dto: CreateEmployeeDto) {
    return this.http.post<ApiSuccessResponse<EmployeeDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees`,
      dto,
    );
  }

  getEmployee(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<EmployeeDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/${id}`,
    );
  }

  updateEmployee(propertyId: string, id: string, dto: UpdateEmployeeDto) {
    return this.http.patch<ApiSuccessResponse<EmployeeDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/${id}`,
      dto,
    );
  }

  getEmployeeCompensation(propertyId: string, employeeId: string) {
    return this.http.get<ApiSuccessResponse<EmployeeCompensationDto[]>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/${employeeId}/compensation`,
    );
  }

  getLatestCompensation(propertyId: string, employeeId: string) {
    return this.http.get<ApiSuccessResponse<EmployeeCompensationDto | null>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/${employeeId}/compensation/latest`,
    );
  }

  createCompensation(propertyId: string, employeeId: string, dto: CreateEmployeeCompensationDto) {
    return this.http.post<ApiSuccessResponse<EmployeeCompensationDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/employees/${employeeId}/compensation`,
      dto,
    );
  }

  getPayrollPeriods(propertyId: string, query?: QueryPayrollPeriodsDto) {
    const params: string[] = [];
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: PayrollPeriodDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/hr-payroll/payroll/periods${q}`);
  }

  getCurrentPayrollPeriod(propertyId: string) {
    return this.http.get<ApiSuccessResponse<PayrollPeriodDto | null>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/periods/current`,
    );
  }

  createPayrollPeriod(propertyId: string, dto: CreatePayrollPeriodDto) {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/periods`,
      dto,
    );
  }

  getPayrollPeriod(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<PayrollPeriodDto | null>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/periods/${id}`,
    );
  }

  getPayrollRuns(propertyId: string, query?: QueryPayrollRunsDto) {
    const params: string[] = [];
    if (query?.page) params.push(`page=${query.page}`);
    if (query?.limit) params.push(`limit=${query.limit}`);

    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: PayrollRunDto[]; total: number; page: number; limit: number }>
    >(`${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs${q}`);
  }

  createPayrollRun(propertyId: string, dto: CreatePayrollRunDto) {
    return this.http.post<ApiSuccessResponse<PayrollRunDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs`,
      dto,
    );
  }

  getPayrollRun(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<PayrollRunDto | null>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs/${id}`,
    );
  }

  calculatePayrollRun(propertyId: string, id: string, dto: CalculatePayrollDto) {
    return this.http.post<ApiSuccessResponse<PayrollRunDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs/${id}/calculate`,
      dto,
    );
  }

  finalizePayrollRun(propertyId: string, id: string) {
    return this.http.post<ApiSuccessResponse<PayrollRunDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs/${id}/finalize`,
      {},
    );
  }

  getPayslips(propertyId: string, runId: string) {
    return this.http.get<ApiSuccessResponse<PayrollLineDto[]>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/runs/${runId}/payslips`,
    );
  }

  getPayrollSummary(propertyId: string) {
    return this.http.get<ApiSuccessResponse<PayrollSummaryDto>>(
      `${this.pmsUrl(propertyId)}/hr-payroll/payroll/summary`,
    );
  }

  // ==========================================
  // REVENUE MANAGEMENT
  // ==========================================
  getRevenueKpiRange(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<RevenueKpiRangeResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/kpi?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getOccupancyTrend(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<OccupancyTrendResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/trends/occupancy?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getAdrTrend(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<AdrTrendResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/trends/adr?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getRevenueTrend(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<RevenueTrendResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/trends/revenue?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getPickupAnalysis(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<PickupAnalysisResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/pickup?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getRoomTypePerformance(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<RoomTypePerformanceResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/performance/room-types?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  getRevenueByDepartment(propertyId: string, businessDate: string) {
    return this.http.get<ApiSuccessResponse<RevenueByDepartmentResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/department?businessDate=${businessDate}`,
    );
  }

  getForecast(propertyId: string, startDate: string, endDate: string) {
    return this.http.get<ApiSuccessResponse<ForecastResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/forecast?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  // Market Rate Providers
  getMarketRateProviders(propertyId: string) {
    return this.http.get<ApiSuccessResponse<MarketRateProviderConfigDto[]>>(
      `${this.pmsUrl(propertyId)}/revenue/market-rate/providers`,
    );
  }

  createMarketRateProvider(propertyId: string, dto: CreateMarketRateProviderRequest) {
    return this.http.post<ApiSuccessResponse<MarketRateProviderConfigDto>>(
      `${this.pmsUrl(propertyId)}/revenue/market-rate/providers`,
      dto,
    );
  }

  updateMarketRateProvider(propertyId: string, id: string, dto: UpdateMarketRateProviderRequest) {
    return this.http.patch<ApiSuccessResponse<MarketRateProviderConfigDto>>(
      `${this.pmsUrl(propertyId)}/revenue/market-rate/providers/${id}`,
      dto,
    );
  }

  getMarketRates(propertyId: string, query: MarketRateQuery) {
    const params: string[] = [];
    params.push(`startDate=${query.startDate}`);
    params.push(`endDate=${query.endDate}`);
    if (query.roomTypeId) params.push(`roomTypeId=${query.roomTypeId}`);
    if (query.competitorCode) params.push(`competitorCode=${query.competitorCode}`);
    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<ApiSuccessResponse<MarketRateResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/market-rate/rates${q}`,
    );
  }

  // Pricing Recommendations
  getPricingRecommendations(propertyId: string, query: PricingRecommendationQuery) {
    const params: string[] = [];
    params.push(`startDate=${query.startDate}`);
    params.push(`endDate=${query.endDate}`);
    if (query.roomTypeId) params.push(`roomTypeId=${query.roomTypeId}`);
    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<ApiSuccessResponse<PricingRecommendationResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/pricing/recommendations${q}`,
    );
  }

  // Competitor Set
  getCompetitorSet(propertyId: string) {
    return this.http.get<ApiSuccessResponse<CompetitorSetResponse>>(
      `${this.pmsUrl(propertyId)}/revenue/competitors`,
    );
  }

  createCompetitorSet(propertyId: string, dto: CreateCompetitorSetRequest) {
    return this.http.post<ApiSuccessResponse<any>>(
      `${this.pmsUrl(propertyId)}/revenue/competitors`,
      dto,
    );
  }

  updateCompetitorSet(propertyId: string, id: string, dto: UpdateCompetitorSetRequest) {
    return this.http.patch<ApiSuccessResponse<any>>(
      `${this.pmsUrl(propertyId)}/revenue/competitors/${id}`,
      dto,
    );
  }
}
