import { Component, inject, signal, computed, OnInit, effect, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { SetupService } from '../../core/services/setup.service';
import { PmsApiService } from '../pms/services/pms-api.service';
import { formatMoney } from '../../shared/utils/currency';
import {
  RevenueKpiDto,
  RevenueKpiRangeResponse,
  OccupancyTrendResponse,
  AdrTrendResponse,
  RevenueTrendResponse,
  PickupAnalysisResponse,
  SetupStatusDto,
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
import { Chart, ChartConfiguration, registerables } from 'chart.js';

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
  private readonly setupService = inject(SetupService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // ===== W2 Setup Mode (never shows fake operational KPIs) =====
  readonly setupStatus = signal<SetupStatusDto | null>(null);
  readonly isSetupMode = computed(() => {
    const s = this.setupStatus();
    return !!s && s.state !== 'ACTIVE';
  });
  readonly setupAreas = computed(() => {
    const c = this.setupStatus()?.counts;
    return [
      { title: 'Property', ready: (c?.properties ?? 0) > 0, count: (c?.properties ?? 0) > 0 ? 'Configured' : 'Not configured' },
      { title: 'Room Types', ready: (c?.roomTypes ?? 0) > 0, count: `${c?.roomTypes ?? 0} configured` },
      { title: 'Rooms', ready: (c?.rooms ?? 0) > 0, count: `${c?.rooms ?? 0} configured` },
      { title: 'Rate Plans', ready: (c?.ratePlans ?? 0) > 0, count: `${c?.ratePlans ?? 0} configured` },
      { title: 'Users', ready: (c?.users ?? 0) > 1, count: `${c?.users ?? 0} users` },
    ];
  });

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly stats = signal<DashboardStats>({
    arrivalsToday: 0,
    departuresToday: 0,
    occupiedRooms: 0,
    availableCleanRooms: 0,
    maintenanceRooms: 0,
    totalRooms: 0,
    occupancyRate: 0,
  });

  readonly revenueKpiRange = signal<RevenueKpiRangeResponse | null>(null);
  readonly occupancyTrend = signal<OccupancyTrendResponse | null>(null);
  readonly adrTrend = signal<AdrTrendResponse | null>(null);
  readonly revenueTrend = signal<RevenueTrendResponse | null>(null);
  readonly pickupAnalysis = signal<PickupAnalysisResponse | null>(null);

  readonly recentReservations = signal<any[]>([]);
  readonly roomsOverview = signal<any[]>([]);

  readonly revenueStartDate = signal<string>((() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })());
  readonly revenueEndDate = signal<string>((() => new Date().toISOString().split('T')[0])());

  readonly activeTrendTab = signal<'occupancy' | 'adr' | 'revenue'>('occupancy');

  @ViewChild('trendChart') trendChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('countryChart') countryChartRef!: ElementRef<HTMLCanvasElement>;

  private trendChart: Chart | null = null;
  private countryChart: Chart | null = null;

  readonly dashboardTableColumns = [
    { field: 'confirmationNumber', label: 'Conf #' },
    { field: 'guestName', label: 'Guest Name' },
    { field: 'roomType', label: 'Room Type' },
    { field: 'dateRange', label: 'Arrival · Departure' },
    { field: 'status', label: 'Status' },
  ];

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

  canViewFinancials(): boolean {
    return this.hasPermission('revenue.kpi.view') || this.auth.isExecutive();
  }

  canViewGuests(): boolean {
    return this.hasPermission('crm.guest.view');
  }

  canViewRoomOps(): boolean {
    return this.hasPermission('room_operations.status.read');
  }

  canViewHousekeeping(): boolean {
    return this.hasPermission('housekeeping.task.view');
  }

  canViewEngineering(): boolean {
    return this.hasPermission('engineering.work_order.view');
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

  // ===== Executive Snapshot KPIs (4 core financial KPIs) =====
  executiveSnapshotKpis = computed(() => {
    if (!this.canViewFinancials()) return [];
    const kpi = this.revenueKpiRange();
    const latest = this.latestKpi();
    const summary = kpi?.summary;
    if (!summary || !latest) return [];

    return [
      {
        label: 'OCCUPANCY',
        value: `${summary.avgOccupancy?.toFixed(1)}%`,
        trend: this.occupancyTrend()?.data?.length ? this.calculateTrend(this.occupancyTrend()!.data.map(d => d.occupancyPercent)) : 'neutral',
        period: `${this.revenueStartDate()} → ${this.revenueEndDate()}`,
      },
      {
        label: 'ADR',
        value: this.formatPrice(summary.avgAdr || '0'),
        trend: this.adrTrend()?.data?.length ? this.calculateTrend(this.adrTrend()!.data.map(d => parseFloat(d.adr))) : 'neutral',
        period: `${this.revenueStartDate()} → ${this.revenueEndDate()}`,
      },
      {
        label: 'REVPAR',
        value: this.formatPrice(summary.avgRevpar || '0'),
        trend: this.revenueTrend()?.data?.length ? this.calculateTrend(this.revenueTrend()!.data.map(d => parseFloat(d.roomRevenue))) : 'neutral',
        period: `${this.revenueStartDate()} → ${this.revenueEndDate()}`,
      },
      {
        label: 'ROOM REVENUE',
        value: this.formatPrice(summary.totalRoomRevenue || '0'),
        trend: this.revenueTrend()?.data?.length ? this.calculateTrend(this.revenueTrend()!.data.map(d => parseFloat(d.roomRevenue))) : 'neutral',
        period: `${this.revenueStartDate()} → ${this.revenueEndDate()}`,
      },
    ];
  });

  // ===== Today's Operations =====
  todayOperations = computed(() => {
    const s = this.stats();
    return [
      { label: 'ARRIVALS TODAY', value: s.arrivalsToday, desc: 'Expected guest arrivals', path: '/pms/front-office', perm: 'front_office.reservation.read' },
      { label: 'DEPARTURES TODAY', value: s.departuresToday, desc: 'Scheduled departures', path: '/pms/reservations', perm: 'front_office.reservation.read' },
      { label: 'IN-HOUSE GUESTS', value: s.occupiedRooms, desc: 'Currently staying', path: '/pms/front-office', perm: 'front_office.reservation.read' },
      { label: 'ROOMS NEEDING ATTENTION', value: this.roomsRequiringAttention(), desc: 'Dirty, failed inspection, OOO', path: '/pms/room-operations', perm: 'room_operations.status.read' },
    ];
  });

  roomsRequiringAttention = computed(() => {
    const rooms = this.roomsOverview();
    return rooms.filter(r =>
      r.effective?.housekeepingStatus === 'DIRTY' ||
      r.effective?.housekeepingStatus === 'INSPECTED_FAILED' ||
      r.effective?.serviceStatus === 'OUT_OF_ORDER' ||
      r.effective?.serviceStatus === 'OUT_OF_SERVICE'
    ).length;
  });

  // ===== Computed Properties =====

  showTodayOperations = computed(() => {
    return this.todayOperations().some((op: any) => this.hasPermission(op.perm));
  });

  showDepartmentStatus = computed(() => {
    return this.canViewHousekeeping() || this.canViewEngineering();
  });

  showGuestsByCountry = computed(() => {
    return this.canViewGuests() && false; // No nationality data available in current API
  });

  showRoomStatus = computed(() => {
    return this.canViewRoomOps() && this.roomStatusSummary() !== null;
  });

  // ===== Department Status =====
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

  // ===== Performance Trends (tabbed) =====
  trendChartData = computed(() => {
    switch (this.activeTrendTab()) {
      case 'occupancy': {
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
      }
      case 'adr': {
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
      }
      case 'revenue': {
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
      }
    }
  });

  trendChartHasData = computed(() => this.trendChartData() !== null);

  // ===== Guests by Country =====
  guestsByCountryChartData = computed(() => {
    // No guest nationality data available in current API/database.
    // Country/nationality is not stored in the core PMS Guest model.
    // Returns null to show empty state.
    return null;
  });

  // ===== Room Status Summary =====
  roomStatusSummary = computed(() => {
    const rooms = this.roomsOverview();
    if (!rooms.length) return null;

    const statuses = {
      available: 0,
      occupied: 0,
      dirty: 0,
      cleaning: 0,
      inspected: 0,
      ooo: 0,
    };

    for (const r of rooms) {
      const occ = r.effective?.occupancyStatus || r.occupancyStatus;
      const hk = r.effective?.housekeepingStatus || r.housekeepingStatus;
      const svc = r.effective?.serviceStatus || r.serviceStatus;

      if (occ === 'OCCUPIED') {
        statuses.occupied++;
      } else if (svc === 'OUT_OF_ORDER' || svc === 'OUT_OF_SERVICE') {
        statuses.ooo++;
      } else if (hk === 'DIRTY') {
        statuses.dirty++;
      } else if (hk === 'CLEANING' || hk === 'IN_PROGRESS') {
        statuses.cleaning++;
      } else if (hk === 'INSPECTED' || hk === 'CLEAN') {
        statuses.inspected++;
      } else if (occ === 'VACANT') {
        statuses.available++;
      }
    }

    return statuses;
  });

  roomStatusEntries = computed(() => {
    const summary = this.roomStatusSummary();
    if (!summary) return [];

    return [
      { key: 'available', label: 'Available', value: summary.available },
      { key: 'occupied', label: 'Occupied', value: summary.occupied },
      { key: 'dirty', label: 'Dirty', value: summary.dirty },
      { key: 'cleaning', label: 'Cleaning', value: summary.cleaning },
      { key: 'inspected', label: 'Inspected', value: summary.inspected },
      { key: 'ooo', label: 'OOO/OOS', value: summary.ooo },
    ].filter(item => item.value > 0);
  });

  // ===== Recent Reservations =====
  recentReservationsDisplay = computed(() => this.recentReservations().slice(0, 6));

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
    // W2: probe setup state first — in setup mode, operational KPI loading is
    // suppressed entirely (no fake 0-value KPIs are rendered).
    this.setupService.refreshStatus().subscribe((status) => {
      this.setupStatus.set(status);
      if (this.isSetupMode()) return;
      const prop = this.activeProperty();
      if (prop) {
        this.loadDashboardData(prop.id);
      }
    });
  }

  ngAfterViewInit(): void {
    this.renderTrendChart();
    this.renderCountryChart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyTrendChart();
    this.destroyCountryChart();
  }

  loadDashboardData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const canReadReservations = this.hasPermission('front_office.reservation.read');
    const canReadRooms = this.hasPermission('room_operations.status.read');
    const canReadRevenue = this.canViewFinancials();
    const canReadGuests = this.canViewGuests();

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

    // Note: Guest nationality data is not available in current API contracts.
    // Using mock data for demonstration. Replace with real API when available.
    if (canReadGuests) {
      observables.guests$ = of({ data: { items: [] } });
    } else {
      observables.guests$ = of({ data: { items: [] } });
    }

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
    } else {
      observables.kpiRange$ = of({ data: null });
      observables.occupancyTrend$ = of({ data: null });
      observables.adrTrend$ = of({ data: null });
      observables.revenueTrend$ = of({ data: null });
      observables.pickupAnalysis$ = of({ data: null });
    }

    forkJoin(observables).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results: any) => {
        const reservations = (results.reservations$ as any)?.data?.items || [];
        this.recentReservations.set(reservations.slice(0, 6));

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

        this.isLoading.set(false);

        setTimeout(() => {
          this.renderTrendChart();
          this.renderCountryChart();
        }, 0);
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

  formatPrice(price: string | number, currency?: string): string {
    const num = Number(price) || 0;
    // Currency always follows the active property context — never a hardcoded default.
    return formatMoney(num, currency || this.activeProperty()?.currency || '');
  }

  getTrendIcon(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  }

  getTrendLabel(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up': return 'Up';
      case 'down': return 'Down';
      default: return 'Flat';
    }
  }

  getTrendClass(trend: 'up' | 'down' | 'neutral'): string {
    switch (trend) {
      case 'up': return 'hms-kpi-card__trend--up';
      case 'down': return 'hms-kpi-card__trend--down';
      default: return 'hms-kpi-card__trend--neutral';
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  onTrendTabChange(tab: 'occupancy' | 'adr' | 'revenue'): void {
    this.activeTrendTab.set(tab);
    setTimeout(() => this.renderTrendChart(), 0);
  }

  private renderTrendChart(): void {
    if (!this.canViewFinancials()) return;

    const canvasRef = this.trendChartRef;
    const data = this.trendChartData();

    if (!canvasRef || !data) {
      this.destroyTrendChart();
      return;
    }

    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyTrendChart();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorMap: Record<string, string> = {
      occupancy: '#cba135',
      adr: '#3b82f6',
      revenue: '#10b981',
    };

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
          line: { borderWidth: 2, borderColor: colorMap[this.activeTrendTab()] },
          point: { radius: 0, hoverRadius: 6, backgroundColor: colorMap[this.activeTrendTab()] },
        },
      },
    };

    this.trendChart = new Chart(ctx, config);
  }

  private renderCountryChart(): void {
    if (!this.canViewGuests()) return;

    const canvasRef = this.countryChartRef;
    const data = this.guestsByCountryChartData();

    if (!canvasRef || !data) {
      this.destroyCountryChart();
      return;
    }

    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    this.destroyCountryChart();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: data,
      options: {
        indexAxis: 'y',
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
            callbacks: {
              label: (context) => ` ${context.raw} guests`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
        },
      },
    };

    this.countryChart = new Chart(ctx, config);
  }

  private destroyTrendChart(): void {
    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }
  }

  private destroyCountryChart(): void {
    if (this.countryChart) {
      this.countryChart.destroy();
      this.countryChart = null;
    }
  }
}