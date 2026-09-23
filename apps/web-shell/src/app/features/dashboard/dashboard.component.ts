import { Component, inject, signal, OnInit, effect, TemplateRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { PmsApiService } from '../pms/services/pms-api.service';
import { ReservationDto, RoomStatusDto } from '@hms/api-contracts';
import { HmsKpiStripComponent, HmsDataTableComponent, HmsAlertComponent, HmsEmptyComponent, HmsLoadingComponent, HmsButtonComponent, HmsStatusPillComponent } from '../../shared/index';

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
  imports: [CommonModule, RouterLink, HmsKpiStripComponent, HmsDataTableComponent, HmsAlertComponent, HmsEmptyComponent, HmsLoadingComponent, HmsButtonComponent, HmsStatusPillComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  readonly auth = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);

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

  readonly recentReservations = signal<ReservationDto[]>([]);
  readonly roomsOverview = signal<RoomStatusDto[]>([]);

  @ViewChild('statusCellTpl') statusCellTpl!: TemplateRef<any>;
  @ViewChild('actionCellTpl') actionCellTpl!: TemplateRef<any>;

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

  canAccessOperationsHub(): boolean {
    return (
      this.hasPermission('front_office.reservation.read') ||
      this.hasPermission('room_operations.status.read') ||
      this.hasPermission('folio:view') ||
      this.hasPermission('front_office.reservation.create')
    );
  }

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
  }

  loadDashboardData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const canReadReservations = this.hasPermission('front_office.reservation.read');
    const canReadRooms = this.hasPermission('room_operations.status.read');

    if (!canReadReservations && !canReadRooms) {
      this.recentReservations.set([]);
      this.roomsOverview.set([]);
      this.isLoading.set(false);
      return;
    }

    const reservations$ = canReadReservations
      ? this.pmsApi.getReservations(propertyId, { limit: 100 }).pipe(
          catchError((err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to load reservations.');
            return of({ data: { items: [] } });
          }),
        )
      : of({ data: { items: [] } });

    const rooms$ = canReadRooms
      ? this.pmsApi.getRoomOperationsRooms(propertyId).pipe(
          catchError((err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to load rooms operational state.');
            return of({ data: [] });
          }),
        )
      : of({ data: [] });

    forkJoin([reservations$, rooms$]).subscribe({
      next: ([resRes, roomsRes]) => {
        const reservations = (resRes as any).data?.items || [];
        this.recentReservations.set(reservations.slice(0, 6));

        const rooms = (roomsRes as any).data || [];
        this.roomsOverview.set(rooms);

        const arrivalsToday = reservations.filter(
          (r: any) => r.arrivalDate === todayStr && r.status === 'CONFIRMED',
        ).length;

        const departuresToday = reservations.filter(
          (r: any) => r.departureDate === todayStr && r.status === 'CHECKED_IN',
        ).length;

        const occupiedRooms = rooms.filter(
          (rm: any) => rm.effective?.occupancyStatus === 'OCCUPIED' || rm.occupancyStatus === 'OCCUPIED',
        ).length;

        const availableCleanRooms = rooms.filter(
          (rm: any) =>
            (rm.effective?.occupancyStatus === 'VACANT' || rm.occupancyStatus === 'VACANT') &&
            (rm.effective?.housekeepingStatus === 'CLEAN' ||
              rm.effective?.housekeepingStatus === 'INSPECTED' ||
              rm.housekeepingStatus === 'CLEAN' ||
              rm.housekeepingStatus === 'INSPECTED') &&
            (rm.effective?.serviceStatus === 'IN_SERVICE' || rm.serviceStatus === 'IN_SERVICE'),
        ).length;

        const maintenanceRooms = rooms.filter(
          (rm: any) =>
            rm.effective?.serviceStatus === 'OUT_OF_ORDER' ||
            rm.effective?.serviceStatus === 'OUT_OF_SERVICE' ||
            rm.serviceStatus === 'OUT_OF_ORDER' ||
            rm.serviceStatus === 'OUT_OF_SERVICE',
        ).length;

        const totalRooms = rooms.length;
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

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  onCardClick(card: any): void {
    if (card.path) {
      this.navigateTo(card.path);
    }
  }
}
