import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrganizationService } from '../../core/services/organization.service';
import { PmsApiService } from '../pms/services/pms-api.service';
import { ReservationDto, RoomStatusDto } from '@hms/api-contracts';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
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

  loadDashboardData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const todayStr = new Date().toISOString().split('T')[0];

    // Parallel fetch reservations and rooms
    this.pmsApi.getReservations(propertyId, { limit: 100 }).subscribe({
      next: (resRes) => {
        const reservations = resRes.data?.items || [];
        this.recentReservations.set(reservations.slice(0, 6));

        this.pmsApi.getRoomOperationsRooms(propertyId).subscribe({
          next: (roomsRes) => {
            const rooms = roomsRes.data || [];
            this.roomsOverview.set(rooms);

            const arrivalsToday = reservations.filter(
              (r) => r.arrivalDate === todayStr && r.status === 'CONFIRMED',
            ).length;

            const departuresToday = reservations.filter(
              (r) => r.departureDate === todayStr && r.status === 'CHECKED_IN',
            ).length;

            const occupiedRooms = rooms.filter(
              (rm) => rm.effective?.occupancyStatus === 'OCCUPIED' || rm.occupancyStatus === 'OCCUPIED',
            ).length;

            const availableCleanRooms = rooms.filter(
              (rm) =>
                (rm.effective?.occupancyStatus === 'VACANT' || rm.occupancyStatus === 'VACANT') &&
                (rm.effective?.housekeepingStatus === 'CLEAN' ||
                  rm.effective?.housekeepingStatus === 'INSPECTED' ||
                  rm.housekeepingStatus === 'CLEAN' ||
                  rm.housekeepingStatus === 'INSPECTED') &&
                (rm.effective?.serviceStatus === 'IN_SERVICE' || rm.serviceStatus === 'IN_SERVICE'),
            ).length;

            const maintenanceRooms = rooms.filter(
              (rm) =>
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
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to load rooms operational state.');
            this.isLoading.set(false);
          },
        });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load reservations.');
        this.isLoading.set(false);
      },
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
