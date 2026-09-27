import { Component, inject, signal, OnInit, effect, TemplateRef, ViewChild, AfterViewInit, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { PmsApiService } from '../pms/services/pms-api.service';
import {
  ReservationDto,
  RoomStatusDto,
  RevenueKpiDto,
  RevenueKpiRangeResponse,
  OccupancyTrendResponse,
  AdrTrendResponse,
  RevenueTrendResponse,
  PickupAnalysisResponse,
  RoomTypePerformanceResponse,
  RevenueByDepartmentResponse,
  ForecastResponse,
} from '@hms/api-contracts';
import {
  HmsKpiStripComponent,
  HmsDataTableComponent,
  HmsAlertComponent,
  HmsEmptyComponent,
  HmsLoadingComponent,
  HmsButtonComponent,
  HmsStatusPillComponent,
} from '../../shared/index';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface DashboardStats {
  arrivalsToday: number;
  departuresToday: number;
  occupiedRooms: number;
  availableCleanRooms: number;
  maintenanceRooms: number;
  totalRooms: number;
  occupancyRate: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    HmsKpiStripComponent,
    HmsDataTableComponent,
    HmsAlertComponent,
    HmsEmptyComponent,
    HmsLoadingComponent,
    HmsButtonComponent,
    HmsStatusPillComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Operational stats (existing)
  readonly stats = signal<{
    arrivalsToday: number;
    departuresToday: number;
    occupiedRooms: number;
    availableCleanRooms: number;
    maintenanceRooms: number;
    totalRooms: number;
    occupancyRate: number;
  }>({
    arrivalsToday: 0,
    departuresToday: 0,
    occupiedRooms: 0,
    availableCleanRooms: 0,
    maintenanceRooms: 0,
    totalRooms: 0,
    occupancyRate: 0,
  });

  // Revenue V2 data
  readonly revenueKpiRange = signal<RevenueKpiRangeResponse | null>(null);
  readonly occupancyTrend = signal<OccupancyTrendResponse | null>(null);
  readonly adrTrend = signal<AdrTrendResponse | null>(null);
  readonly revenueTrend = signal<RevenueTrendResponse | null>(null);
  readonly pickupAnalysis = signal<PickupAnalysisResponse | null>(null);
  readonly roomTypePerformance = signal<RoomTypePerformanceResponse | null>(null);
  readonly revenueByDepartment = signal<RevenueByDepartmentResponse | null>(null);
  readonly forecast = signal<ForecastResponse | null>(null);

  // Date range for revenue queries
  readonly revenueStartDate = signal<string>((() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })());
  readonly revenueEndDate = signal<string>((() => new Date().toISOString().split('T')[0])());

  // Operational data
  readonly recentReservations = signal<any[]>([]);
  readonly roomsOverview = signal<any[]>([]);

  @ViewChild('statusCellTpl') statusCellTpl!: TemplateRef<any>;
  @ViewChild('actionCellTpl') actionCellTpl!: TemplateRef<any>;

  // Chart canvas refs
  @ViewChild('occupancyChart') occupancyChartRef!: any;
  @ViewChild('adrChart') adrChartRef!: any;
  @ViewChild('revenueChart') revenueChartRef!: any;
  @ViewChild('roomStatusChart') roomStatusChartRef!: any;
  @ViewChild('revenueDeptChart') revenueDeptChartRef!: any;
  @ViewChild('pickupChart') pickupChartRef!: any;

  // Chart instances
  private charts: Map<string, Chart> = new Map();

  columns: any[] = [];

  get tableRows() {
    return this.recentReservations().map(r => ({
      confirmationNumber: r.confirmationNumber,
      guestName: `${r.guest?.firstName} ${r.guest?.lastName}`,
      roomType: r.roomTypeCode || 'ROOM',
      dateRange: `${r.arrivalDate} → ${r.departureDate}`,
      status: r.status,
      action: r.id,
    }));
  }

  hasPermission(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  get primaryRoleCode(): string {
    return this.auth.primaryRoleCode;
  }

  isExecutive(): boolean {
    return this.auth.isExecutive();
  }

  isFrontDeskAgent(): boolean {
    return this.auth.isFrontDeskAgent();
  }

  isHousekeepingSupervisor(): boolean {
    return this.auth.isHousekeepingSupervisor();
  }

  isMaintenanceTech(): boolean {
    return this.auth.isMaintenanceTech();
  }

  canAccessOperationsHub(): boolean {
    return (
      this.hasPermission('front_office.reservation.read') ||
      this.hasPermission('room_operations.status.read') ||
      this.hasPermission('folio:view') ||
      this.hasPermission('front_office.reservation.create')
    );
  }

  // Financial data visibility - only for executives and GMs
  canViewFinancials(): boolean {
    return this.hasPermission('revenue.kpi.view') || this.isExecutive();
  }

  // ===== Executive KPIs =====
  executiveKpiCards = computed(() => {
    if (!this.canViewFinancials()) return [];
    const kpi = this.revenueKpiRange();
    const latest = this.latestKpi();
    const summary = kpi?.summary;
    if (!summary || !latest) return [];

    return [
      {
        label: 'OCCUPANCY %',
        value: `${summary.avgOccupancy?.toFixed(2)}%`,
        desc: `Current: ${latest.occupancyPercent.toFixed(2)}%`,
        footer: 'Revenue → KPIs',
        path: '/pms/revenue',
        icon: 'occupancy',
        trend: this.occupancyTrend()?.data?.length ? this.calculateTrend(this.occupancyTrend()!.data.map(d => d.occupancyPercent)) : 'neutral',
      },
      {
        label: 'ADR',
        value: summary.avgAdr || '0.00',
        desc: `Current: ${this.formatPrice(latest.adr)}`,
        footer: 'Revenue → Trends',
        path: '/pms/revenue',
        icon: 'adr',
        trend: this.adrTrend()?.data?.length ? this.calculateTrend(this.adrTrend()!.data.map(d => parseFloat(d.adr))) : 'neutral',
      },
      {
        label: 'RevPAR',
        value: summary.avgRevpar || '0.00',
        desc: `Current: ${this.formatPrice(latest.revpar)}`,
        footer: 'Revenue → Trends',
        path: '/pms/revenue',
        icon: 'revpar',
        trend: this.revenueTrend()?.data?.length ? this.calculateTrend(this.revenueTrend()!.data.map(d => parseFloat(d.roomRevenue))) : 'neutral',
      },
      {
        label: 'ROOM REVENUE',
        value: summary.totalRoomRevenue || '0.00',
        desc: `Current: ${this.formatPrice(latest.roomRevenue)}`,
        footer: 'Revenue → KPIs',
        path: '/pms/revenue',
        icon: 'revenue',
        trend: this.revenueTrend()?.data?.length ? this.calculateTrend(this.revenueTrend()!.data.map(d => parseFloat(d.roomRevenue))) : 'neutral',
      },
      {
        label: 'PICKUP',
        value: summary.totalPickup || '0',
        desc: `Today: ${latest.pickup}`,
        footer: 'Revenue → Pickup',
        path: '/pms/revenue',
        icon: 'pickup',
        trend: this.pickupAnalysis()?.data?.length ? this.calculateTrend(this.pickupAnalysis()!.data.map(d => d.netPickup)) : 'neutral',
      },
    ];
  });

  // Operational KPI cards (existing)
  get kpiCards() {
    const s = this.stats();
    const cards: Array<{ label: string; value: string | number; desc: string; footer: string; path: string }> = [];

    if (this.hasPermission('front_office.reservation.read')) {
      cards.push(
        { label: 'ARRIVALS TODAY', value: s.arrivalsToday, desc: 'Expected guest arrivals', footer: 'Process in Front Office →', path: '/pms/front-office' },
        { label: 'DEPARTURES TODAY', value: s.departuresToday, desc: 'Scheduled departures', footer: 'Settlement & Checkout →', path: '/pms/reservations' },
      );
    }

    if (this.hasPermission('room_operations.status.read')) {
      cards.push(
        { label: 'OCCUPIED ROOMS', value: `${s.occupiedRooms} / ${s.totalRooms}`, desc: 'Active in-house guests', footer: 'View Tape Chart →', path: '/pms/room-operations' },
        { label: 'READY FOR CHECK-IN', value: s.availableCleanRooms, desc: 'Inspected & sellable rooms', footer: 'Housekeeping Board →', path: '/pms/room-operations' },
        { label: 'MAINTENANCE (OOO/OOS)', value: s.maintenanceRooms, desc: 'Under repair / blocked', footer: 'Manage Blocks →', path: '/pms/room-operations' },
      );
    }

    return cards;
  }

  // ===== Chart Data Computed =====
  occupancyChartData = computed(() => {
    const data = this.occupancyTrend()?.data;
    if (!data?.length) return null;
    return {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Occupancy %',
        data: data.map(d => d.occupancyPercent),
        borderColor: '#cba135',
        backgroundColor: 'rgba(203, 161, 53, 0.1)',
        tension: 0.3,
        fill: true,
      }],
    };
  });

  adrChartData = computed(() => {
    const data = this.adrTrend()?.data;
    if (!data?.length) return null;
    return {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'ADR',
        data: data.map(d => parseFloat(d.adr)),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      }],
    };
  });

  revenueChartData = computed(() => {
    const data = this.revenueTrend()?.data;
    if (!data?.length) return null;
    return {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Room Revenue',
        data: data.map(d => parseFloat(d.roomRevenue)),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
      }],
    };
  });

  roomStatusDistribution = computed(() => {
    const rooms = this.roomsOverview();
    if (!rooms.length) return null;

    const occupied = rooms.filter(r => r.effective?.occupancyStatus === 'OCCUPIED' || r.occupancyStatus === 'OCCUPIED').length;
    const vacantClean = rooms.filter(r =>
      (r.effective?.occupancyStatus === 'VACANT' || r.occupancyStatus === 'VACANT') &&
      (r.effective?.housekeepingStatus === 'CLEAN' || r.effective?.housekeepingStatus === 'INSPECTED' ||
        r.housekeepingStatus === 'CLEAN' || r.housekeepingStatus === 'INSPECTED') &&
      (r.effective?.serviceStatus === 'IN_SERVICE' || r.serviceStatus === 'IN_SERVICE')
    ).length;
    const vacantDirty = rooms.filter(r =>
      (r.effective?.occupancyStatus === 'VACANT' || r.occupancyStatus === 'VACANT') &&
      !(r.effective?.housekeepingStatus === 'CLEAN' || r.effective?.housekeepingStatus === 'INSPECTED' ||
        r.housekeepingStatus === 'CLEAN' || r.housekeepingStatus === 'INSPECTED')
    ).length;
    const maintenance = rooms.filter(r =>
      r.effective?.serviceStatus === 'OUT_OF_ORDER' ||
      r.effective?.serviceStatus === 'OUT_OF_SERVICE' ||
      r.serviceStatus === 'OUT_OF_ORDER' ||
      r.serviceStatus === 'OUT_OF_SERVICE'
    ).length;
    const other = rooms.length - occupied - vacantClean - vacantDirty - maintenance;

    return {
      labels: ['Occupied', 'Vacant Clean', 'Vacant Dirty', 'Maintenance', 'Other'],
      datasets: [{
        data: [occupied, vacantClean, vacantDirty, maintenance, other],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'],
        borderWidth: 0,
      }],
    };
  });

  revenueByDepartmentChart = computed(() => {
    const data = this.revenueByDepartment()?.data;
    if (!data?.length) return null;
    return {
      labels: data.map(d => d.department),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => parseFloat(d.revenue)),
        backgroundColor: ['#cba135', '#3b82f6', '#10b981', '#8b5cf6', '#94a3b8'],
        borderWidth: 0,
      }],
    };
  });

  pickupChartData = computed(() => {
    const data = this.pickupAnalysis()?.data;
    if (!data?.length) return null;
    return {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'New Bookings',
          data: data.map(d => d.newBookings),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Cancellations',
          data: data.map(d => d.cancellations),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Net Pickup',
          data: data.map(d => d.netPickup),
          borderColor: '#cba135',
          backgroundColor: 'rgba(203, 161, 53, 0.1)',
          tension: 0.3,
          fill: false,
        },
      ],
    };
  });

  // Operational widgets
  arrivalsToday = computed(() => this.stats().arrivalsToday);
  departuresToday = computed(() => this.stats().departuresToday);
  inHouseGuests = computed(() => this.stats().occupiedRooms);

  roomsRequiringAttention = computed(() => {
    const rooms = this.roomsOverview();
    return rooms.filter(r =>
      r.effective?.housekeepingStatus === 'DIRTY' ||
      r.effective?.housekeepingStatus === 'INSPECTED_FAILED' ||
      r.effective?.serviceStatus === 'OUT_OF_ORDER' ||
      r.effective?.serviceStatus === 'OUT_OF_SERVICE'
    ).length;
  });

  housekeepingReadiness = computed(() => {
    const rooms = this.roomsOverview();
    const total = rooms.length;
    if (total === 0) return 0;
    const ready = rooms.filter(r =>
      (r.effective?.occupancyStatus === 'VACANT' || r.occupancyStatus === 'VACANT') &&
      (r.effective?.housekeepingStatus === 'CLEAN' || r.effective?.housekeepingStatus === 'INSPECTED') &&
      (r.effective?.serviceStatus === 'IN_SERVICE' || r.serviceStatus === 'IN_SERVICE')
    ).length;
    return Math.round((ready / total) * 100);
  });

  maintenanceOOSCount = computed(() => this.stats().maintenanceRooms);

  // VIP guests (only for authorized roles)
  vipGuests = computed(() => {
    if (!this.hasPermission('crm.guest.view')) return [];
    return this.recentReservations().filter(r =>
      r.guest?.vip === true || r.guest?.loyaltyTier === 'PLATINUM' || r.guest?.loyaltyTier === 'GOLD'
    ).slice(0, 5);
  });

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadDashboardData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadDashboardData(prop.id);
    }
  }

  ngAfterViewInit(): void {
    this.columns = [
      { field: 'confirmationNumber', label: 'Conf #' },
      { field: 'guestName', label: 'Guest Name' },
      { field: 'roomType', label: 'Room Type' },
      { field: 'dateRange', label: 'Arrival · Departure' },
      { field: 'status', label: 'Status', cellTemplate: this.statusCellTpl },
      { field: 'action', label: 'Action', cellTemplate: this.actionCellTpl },
    ];

    // Initialize charts after view init
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
  }

  loadDashboardData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const canReadReservations = this.hasPermission('front_office.reservation.read');
    const canReadRooms = this.hasPermission('room_operations.status.read');
    const canReadRevenue = this.canViewFinancials();

    // Build all observables
    const observables: any = {};

    if (canReadReservations) {
      observables.reservations$ = this.pmsApi.getReservations(propertyId, { limit: 100 }).pipe(
        catchError((err) => {
          this.errorMessage.set(err?.error?.message || 'Failed to load reservations.');
          return of({ data: { items: [] } });
        }),
      );
    } else {
      observables.reservations$ = of({ data: { items: [] } });
    }

    if (canReadRooms) {
      observables.rooms$ = this.pmsApi.getRoomOperationsRooms(propertyId).pipe(
        catchError((err) => {
          this.errorMessage.set(err?.error?.message || 'Failed to load rooms operational state.');
          return of({ data: [] });
        }),
      );
    } else {
      observables.rooms$ = of({ data: [] });
    }

    // Revenue V2 APIs (only for authorized roles)
    if (canReadRevenue) {
      const start = this.revenueStartDate();
      const end = this.revenueEndDate();

      observables.kpiRange$ = this.pmsApi.getRevenueKpiRange(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load KPI range:', err);
          return of({ data: null });
        }),
      );

      observables.occupancyTrend$ = this.pmsApi.getOccupancyTrend(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load occupancy trend:', err);
          return of({ data: null });
        }),
      );

      observables.adrTrend$ = this.pmsApi.getAdrTrend(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load ADR trend:', err);
          return of({ data: null });
        }),
      );

      observables.revenueTrend$ = this.pmsApi.getRevenueTrend(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load revenue trend:', err);
          return of({ data: null });
        }),
      );

      observables.pickupAnalysis$ = this.pmsApi.getPickupAnalysis(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load pickup analysis:', err);
          return of({ data: null });
        }),
      );

      observables.roomTypePerformance$ = this.pmsApi.getRoomTypePerformance(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load room type performance:', err);
          return of({ data: null });
        }),
      );

      observables.revenueByDepartment$ = this.pmsApi.getRevenueByDepartment(propertyId, new Date().toISOString().split('T')[0]).pipe(
        catchError((err) => {
          console.error('Failed to load revenue by department:', err);
          return of({ data: null });
        }),
      );

      observables.forecast$ = this.pmsApi.getForecast(propertyId, start, end).pipe(
        catchError((err) => {
          console.error('Failed to load forecast:', err);
          return of({ data: null });
        }),
      );
    } else {
      observables.kpiRange$ = of({ data: null });
      observables.occupancyTrend$ = of({ data: null });
      observables.adrTrend$ = of({ data: null });
      observables.revenueTrend$ = of({ data: null });
      observables.pickupAnalysis$ = of({ data: null });
      observables.roomTypePerformance$ = of({ data: null });
      observables.revenueByDepartment$ = of({ data: null });
      observables.forecast$ = of({ data: null });
    }

    forkJoin(observables).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results: any) => {
        // Process reservations
        const reservations = (results.reservations$ as any)?.data?.items || [];
        this.recentReservations.set(reservations.slice(0, 6));

        // Process rooms
        const rooms = (results.rooms$ as any)?.data || [];
        this.roomsOverview.set(rooms);

        const todayStr = new Date().toISOString().split('T')[0];

        const arrivalsToday = reservations.filter(
          (r: any) => r.arrivalDate === todayStr && r.status === 'CONFIRMED',
        ).length;

        const departuresToday = reservations.filter(
          (r: any) => r.departureDate === todayStr && r.status === 'CHECKED_IN',
        ).length;

        const occupiedRooms = this.roomsOverview().filter(
          (rm: any) => rm.effective?.occupancyStatus === 'OCCUPIED' || rm.occupancyStatus === 'OCCUPIED',
        ).length;

        const availableCleanRooms = this.roomsOverview().filter(
          (rm: any) =>
            (rm.effective?.occupancyStatus === 'VACANT' || rm.occupancyStatus === 'VACANT') &&
            (rm.effective?.housekeepingStatus === 'CLEAN' ||
              rm.effective?.housekeepingStatus === 'INSPECTED' ||
              rm.housekeepingStatus === 'CLEAN' ||
              rm.housekeepingStatus === 'INSPECTED') &&
            (rm.effective?.serviceStatus === 'IN_SERVICE' || rm.serviceStatus === 'IN_SERVICE'),
        ).length;

        const maintenanceRooms = this.roomsOverview().filter(
          (rm: any) =>
            rm.effective?.serviceStatus === 'OUT_OF_ORDER' ||
            rm.effective?.serviceStatus === 'OUT_OF_SERVICE' ||
            rm.serviceStatus === 'OUT_OF_ORDER' ||
            rm.serviceStatus === 'OUT_OF_SERVICE',
        ).length;

        const totalRooms = this.roomsOverview().length;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        this.stats.set({
          arrivalsToday,
          departuresToday,
          occupiedRooms,
          availableCleanRooms,
          maintenanceRooms,
          totalRooms,
          occupancyRate,
        });

        // Process revenue data
        if (results.kpiRange$) {
          this.revenueKpiRange.set((results.kpiRange$ as any)?.data || null);
        }
        if (results.occupancyTrend$) {
          this.occupancyTrend.set((results.occupancyTrend$ as any)?.data || null);
        }
        if (results.adrTrend$) {
          this.adrTrend.set((results.adrTrend$ as any)?.data || null);
        }
        if (results.revenueTrend$) {
          this.revenueTrend.set((results.revenueTrend$ as any)?.data || null);
        }
        if (results.pickupAnalysis$) {
          this.pickupAnalysis.set((results.pickupAnalysis$ as any)?.data || null);
        }
        if (results.roomTypePerformance$) {
          this.roomTypePerformance.set((results.roomTypePerformance$ as any)?.data || null);
        }
        if (results.revenueByDepartment$) {
          this.revenueByDepartment.set((results.revenueByDepartment$ as any)?.data || null);
        }
        if (results.forecast$) {
          this.forecast.set((results.forecast$ as any)?.data || null);
        }

        this.isLoading.set(false);

        // Re-render charts after data loads
        setTimeout(() => this.renderCharts(), 0);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // ===== Helper Methods =====
  latestKpi(): RevenueKpiDto | null {
    const data = this.revenueKpiRange()?.dataPoints;
    return data && data.length > 0 ? data[data.length - 1] : null;
  }

  calculateTrend(values: number[]): 'up' | 'down' | 'neutral' {
    if (values.length < 2) return 'neutral';
    const first = values[0];
    const last = values[values.length - 1];
    if (last > first * 1.02) return 'up';
    if (last < first * 0.98) return 'down';
    return 'neutral';
  }

  formatPrice(price: string | number, currency = 'JPY'): string {
    const num = Number(price) || 0;
    if (currency === 'JPY') {
      return `¥${num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    }
    return `$${num.toFixed(2)}`;
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  getTrendIcon(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  }

  getTrendClass(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up': return 'trend-up';
      case 'down': return 'trend-down';
      default: return 'trend-neutral';
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  onCardClick(card: any): void {
    if (card.path) {
      this.navigateTo(card.path);
    }
  }

  // ===== Chart Rendering =====
  private renderCharts(): void {
    if (!this.canViewFinancials()) return;

    this.renderLineChart('occupancyChart', this.occupancyChartRef, this.occupancyChartData(), 'Occupancy %', '#cba135');
    this.renderLineChart('adrChart', this.adrChartRef, this.adrChartData(), 'ADR', '#3b82f6');
    this.renderLineChart('revenueChart', this.revenueChartRef, this.revenueChartData(), 'Room Revenue', '#10b981');
    this.renderDoughnutChart('roomStatusChart', this.roomStatusChartRef, this.roomStatusDistribution());
    this.renderBarChart('revenueDeptChart', this.revenueDeptChartRef, this.revenueByDepartmentChart());
    this.renderMultiLineChart('pickupChart', this.pickupChartRef, this.pickupChartData());
  }

  private renderLineChart(key: string, canvasRef: any, data: any, label: string, color: string): void {
    if (!canvasRef || !data) return;
    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyChart(key);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
            beginAtZero: false,
          },
        },
        interaction: { intersect: false, mode: 'index' },
        elements: {
          line: { borderWidth: 2, borderColor: color },
          point: { radius: 0, hoverRadius: 6, backgroundColor: color },
        },
      },
    };

    this.charts.set(key, new Chart(ctx, config));
  }

  private renderMultiLineChart(key: string, canvasRef: any, data: any): void {
    if (!canvasRef || !data) return;
    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyChart(key);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
        },
        interaction: { intersect: false, mode: 'index' },
        elements: {
          line: { borderWidth: 2 },
          point: { radius: 0, hoverRadius: 6 },
        },
      },
    };

    this.charts.set(key, new Chart(ctx, config));
  }

  private renderDoughnutChart(key: string, canvasRef: any, data: any): void {
    if (!canvasRef || !data) return;
    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyChart(key);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            padding: 12,
            cornerRadius: 8,
          },
        },
        // @ts-expect-error - cutout is valid for doughnut charts in Chart.js v4
        cutout: '70%',
      },
    };

    this.charts.set(key, new Chart(ctx, config));
  }

  private renderBarChart(key: string, canvasRef: any, data: any): void {
    if (!canvasRef || !data) return;
    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyChart(key);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
            beginAtZero: true,
          },
        },
      },
    };

    this.charts.set(key, new Chart(ctx, config));
  }

  private destroyChart(key: string): void {
    const chart = this.charts.get(key);
    if (chart) {
      chart.destroy();
      this.charts.delete(key);
    }
  }

  private destroyCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();
  }
}