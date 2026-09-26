import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrganizationService } from '../../../core/services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  RevenueKpiDto,
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
  RevenueKpiRangeQuery,
  MarketRateQuery,
  PricingRecommendationQuery,
  CreateMarketRateProviderRequest,
  UpdateMarketRateProviderRequest,
  CreateCompetitorSetRequest,
  UpdateCompetitorSetRequest,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../../shared/index';

type ActiveRevenueTab = 'kpi' | 'trends' | 'pickup' | 'forecast' | 'market-rate' | 'pricing' | 'competitors';

@Component({
  selector: 'app-revenue-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HmsButtonComponent,
    HmsStatusPillComponent,
    HmsModalComponent,
    HmsAlertComponent,
    HmsLoadingComponent,
    HmsEmptyComponent,
  ],
  templateUrl: './revenue-dashboard.component.html',
  styleUrls: ['./revenue-dashboard.component.css'],
})
export class RevenueDashboardComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // View state
  activeTab = signal<ActiveRevenueTab>('kpi');
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Date range for queries
  startDate = signal<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  endDate = signal<string>(new Date().toISOString().slice(0, 10));

  // Revenue Data
  kpiRange = signal<RevenueKpiRangeResponse | null>(null);
  occupancyTrend = signal<OccupancyTrendResponse | null>(null);
  adrTrend = signal<AdrTrendResponse | null>(null);
  revenueTrend = signal<RevenueTrendResponse | null>(null);
  pickupAnalysis = signal<PickupAnalysisResponse | null>(null);
  roomTypePerformance = signal<RoomTypePerformanceResponse | null>(null);
  revenueByDepartment = signal<RevenueByDepartmentResponse | null>(null);
  forecast = signal<ForecastResponse | null>(null);
  marketRateProviders = signal<MarketRateProviderConfigDto[]>([]);
  marketRates = signal<MarketRateResponse | null>(null);
  pricingRecommendations = signal<PricingRecommendationResponse | null>(null);
  competitorSet = signal<CompetitorSetResponse | null>(null);

  // Modal state
  showProviderModal = signal<boolean>(false);
  editingProvider: MarketRateProviderConfigDto | null = null;
  providerForm: Partial<CreateMarketRateProviderRequest> = {};

  showCompetitorModal = signal<boolean>(false);
  editingCompetitor: any = null;
  competitorForm: Partial<CreateCompetitorSetRequest> = {};

  // Forecast date range
  forecastStartDate = signal<string>(new Date().toISOString().slice(0, 10));
  forecastEndDate = signal<string>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  // Market rate query params
  marketRateRoomTypeId = signal<string>('');
  marketRateCompetitorCode = signal<string>('');

  // Pricing recommendation query params
  pricingRoomTypeId = signal<string>('');

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop?.id) {
          this.loadAllRevenueData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAllRevenueData(prop.id);
    }
  }

  hasPermission(perm: string): boolean {
    return this.authService.hasPermission(perm);
  }

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  loadAllRevenueData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const start = this.startDate();
    const end = this.endDate();

    // Load KPI range
    this.pmsApi.getRevenueKpiRange(propertyId, start, end).subscribe({
      next: (res) => this.kpiRange.set(res.data || null),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to load KPIs'),
    });

    // Load trends
    this.pmsApi.getOccupancyTrend(propertyId, start, end).subscribe({
      next: (res) => this.occupancyTrend.set(res.data || null),
    });
    this.pmsApi.getAdrTrend(propertyId, start, end).subscribe({
      next: (res) => this.adrTrend.set(res.data || null),
    });
    this.pmsApi.getRevenueTrend(propertyId, start, end).subscribe({
      next: (res) => this.revenueTrend.set(res.data || null),
    });

    // Load pickup
    this.pmsApi.getPickupAnalysis(propertyId, start, end).subscribe({
      next: (res) => this.pickupAnalysis.set(res.data || null),
    });

    // Load room type performance
    this.pmsApi.getRoomTypePerformance(propertyId, start, end).subscribe({
      next: (res) => this.roomTypePerformance.set(res.data || null),
    });

    // Load forecast
    const forecastStart = this.forecastStartDate();
    const forecastEnd = this.forecastEndDate();
    this.pmsApi.getForecast(propertyId, forecastStart, forecastEnd).subscribe({
      next: (res) => this.forecast.set(res.data || null),
    });

    // Load market rate providers
    this.pmsApi.getMarketRateProviders(propertyId).subscribe({
      next: (res) => this.marketRateProviders.set(res.data || []),
    });

    // Load competitor set
    this.pmsApi.getCompetitorSet(propertyId).subscribe({
      next: (res) => this.competitorSet.set(res.data || null),
      complete: () => this.isLoading.set(false),
    });
  }

  onDateRangeChange(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAllRevenueData(prop.id);
    }
  }

  onForecastDateChange(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.pmsApi.getForecast(prop.id, this.forecastStartDate(), this.forecastEndDate()).subscribe({
        next: (res) => this.forecast.set(res.data || null),
      });
    }
  }

  // -------------------------------------------------------------
  // Market Rate Providers
  // -------------------------------------------------------------
  openProviderModal(provider?: MarketRateProviderConfigDto): void {
    if (provider) {
      this.editingProvider = provider;
      this.providerForm = {
        providerName: provider.providerName,
        providerType: provider.providerType,
        configuration: provider.configuration,
      };
    } else {
      this.editingProvider = null;
      this.providerForm = {
        providerName: '',
        providerType: 'DEMO_COMPSET',
        configuration: {},
      };
    }
    this.showProviderModal.set(true);
  }

  closeProviderModal(): void {
    this.showProviderModal.set(false);
    this.editingProvider = null;
    this.providerForm = {};
  }

  confirmProvider(): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CreateMarketRateProviderRequest = {
      providerName: this.providerForm.providerName!,
      providerType: this.providerForm.providerType!,
      configuration: this.providerForm.configuration,
    };

    const request = this.editingProvider
      ? this.pmsApi.updateMarketRateProvider(prop.id, this.editingProvider.id, dto)
      : this.pmsApi.createMarketRateProvider(prop.id, dto);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showProviderModal.set(false);
        this.successMessage.set(
          this.editingProvider
            ? `Provider "${this.editingProvider.providerName}" updated successfully.`
            : `Provider "${dto.providerName}" created successfully.`,
        );
        this.loadAllRevenueData(prop.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to save provider');
      },
    });
  }

  // -------------------------------------------------------------
  // Competitor Set
  // -------------------------------------------------------------
  openCompetitorModal(competitor?: any): void {
    if (competitor) {
      this.editingCompetitor = competitor;
      this.competitorForm = {
        competitorCode: competitor.competitorCode,
        competitorName: competitor.competitorName,
        segment: competitor.segment,
        distanceKm: competitor.distanceKm,
      };
    } else {
      this.editingCompetitor = null;
      this.competitorForm = {
        competitorCode: '',
        competitorName: '',
        segment: 'UPSCALE',
        distanceKm: 0,
      };
    }
    this.showCompetitorModal.set(true);
  }

  closeCompetitorModal(): void {
    this.showCompetitorModal.set(false);
    this.editingCompetitor = null;
    this.competitorForm = {};
  }

  confirmCompetitor(): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CreateCompetitorSetRequest = {
      competitorCode: this.competitorForm.competitorCode!,
      competitorName: this.competitorForm.competitorName!,
      segment: this.competitorForm.segment,
      distanceKm: this.competitorForm.distanceKm,
    };

    const request = this.editingCompetitor
      ? this.pmsApi.updateCompetitorSet(prop.id, this.editingCompetitor.id, dto)
      : this.pmsApi.createCompetitorSet(prop.id, dto);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showCompetitorModal.set(false);
        this.successMessage.set(
          this.editingCompetitor
            ? `Competitor "${this.editingCompetitor.competitorName}" updated successfully.`
            : `Competitor "${dto.competitorName}" added successfully.`,
        );
        this.pmsApi.getCompetitorSet(prop.id).subscribe({
          next: (res) => this.competitorSet.set(res.data || null),
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to save competitor');
      },
    });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  formatPrice(price: string | number, currency = 'JPY'): string {
    const num = Number(price) || 0;
    if (currency === 'JPY') {
      return `¥${num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    }
    return `$${num.toFixed(2)}`;
  }

  formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  getDemandLevelPill(demand: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    switch (demand) {
      case 'HIGH_DEMAND': return 'danger';
      case 'LOW_DEMAND': return 'info';
      default: return 'warning';
    }
  }

  getConfidencePill(conf: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    switch (conf) {
      case 'HIGH': return 'success';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'info';
      default: return 'default';
    }
  }

  getLatestKpi(): RevenueKpiDto | null {
    const data = this.kpiRange()?.dataPoints;
    return data && data.length > 0 ? data[data.length - 1] : null;
  }

  getKpiSummary() {
    return this.kpiRange()?.summary;
  }

  getOccupancyBadgeClass(occupancy: number): string {
    if (occupancy >= 90) return 'badge high';
    if (occupancy >= 70) return 'badge medium';
    return 'badge low';
  }

  getKpiCards() {
    const summary = this.getKpiSummary();
    const latest = this.getLatestKpi();
    if (!summary || !latest) return [];

    return [
      { label: 'Occupancy', value: `${summary.avgOccupancy?.toFixed(2)}%`, desc: 'Average occupancy rate', icon: 'occupancy', iconClass: 'occupancy' },
      { label: 'ADR', value: summary.avgAdr, desc: 'Average daily rate', icon: 'adr', iconClass: 'adr' },
      { label: 'RevPAR', value: summary.avgRevpar, desc: 'Revenue per available room', icon: 'revpar', iconClass: 'revpar' },
      { label: 'Room Revenue', value: summary.totalRoomRevenue, desc: 'Total room revenue for period', icon: 'revenue', iconClass: 'revenue' },
      { label: 'Pickup', value: summary.totalPickup, desc: 'Net new bookings minus cancellations', icon: 'pickup', iconClass: 'pickup' },
    ];
  }
}