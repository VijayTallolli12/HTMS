import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  ReservationDto,
  EligibleRoomDto,
  CheckInResponseDto,
} from '@hms/api-contracts';

@Component({
  selector: 'app-front-office',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './front-office.component.html',
  styleUrls: ['./front-office.component.css'],
})
export class FrontOfficeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly arrivals = signal<ReservationDto[]>([]);
  readonly filteredArrivals = signal<ReservationDto[]>([]);

  searchQuery = signal<string>('');

  // Assign Room Modal State
  selectedReservation = signal<ReservationDto | null>(null);
  showAssignModal = signal<boolean>(false);
  isLoadingEligibleRooms = signal<boolean>(false);
  eligibleRooms = signal<EligibleRoomDto[]>([]);
  selectedRoomId = signal<string | null>(null);
  allowUpgrade = false;
  assignmentReason = '';
  isAssigning = signal<boolean>(false);

  // Check-In Modal State
  showCheckInModal = signal<boolean>(false);
  identityVerified = true;
  registrationCardSigned = true;
  allowCleanOverride = false;
  cleanOverrideReason = '';
  isCheckingIn = signal<boolean>(false);
  checkInSuccessData = signal<CheckInResponseDto | null>(null);

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadArrivals(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadArrivals(prop.id);
    }
  }

  loadArrivals(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getReservations(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        // Focus on CONFIRMED or CHECKED_IN
        this.arrivals.set(items);
        this.applyFilter();

        // Check if queryParam reservationId is passed
        const targetResId = this.route.snapshot.queryParamMap.get('reservationId');
        if (targetResId) {
          const target = items.find((r) => r.id === targetResId);
          if (target) {
            if (target.status === 'CONFIRMED' && !target.assignedRoomId) {
              this.openAssignModal(target);
            } else if (target.status === 'CONFIRMED' && target.assignedRoomId) {
              this.openCheckInModal(target);
            }
          }
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load front desk arrivals.');
        this.isLoading.set(false);
      },
    });
  }

  onSearchChange(text: string): void {
    this.searchQuery.set(text);
    this.applyFilter();
  }

  applyFilter(): void {
    let list = [...this.arrivals()];
    const q = this.searchQuery().toLowerCase().trim();

    if (q) {
      list = list.filter(
        (r) =>
          r.confirmationNumber.toLowerCase().includes(q) ||
          (r.guest?.firstName && r.guest.firstName.toLowerCase().includes(q)) ||
          (r.guest?.lastName && r.guest.lastName.toLowerCase().includes(q)) ||
          (r.roomTypeCode && r.roomTypeCode.toLowerCase().includes(q)),
      );
    }

    this.filteredArrivals.set(list);
  }

  // --- Assign Room Methods ---
  openAssignModal(res: ReservationDto): void {
    this.selectedReservation.set(res);
    this.selectedRoomId.set(null);
    this.allowUpgrade = false;
    this.assignmentReason = '';
    this.showAssignModal.set(true);
    this.errorMessage.set(null);

    const prop = this.activeProperty();
    if (!prop) return;

    this.isLoadingEligibleRooms.set(true);
    this.pmsApi
      .getEligibleRooms(prop.id, {
        reservationId: res.id,
        includeDirty: true,
      })
      .subscribe({
        next: (response) => {
          this.eligibleRooms.set(response.data || []);
          this.isLoadingEligibleRooms.set(false);
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.message || 'Failed to query eligible rooms for this reservation.',
          );
          this.isLoadingEligibleRooms.set(false);
        },
      });
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
  }

  selectEligibleRoom(room: EligibleRoomDto): void {
    this.selectedRoomId.set(room.id);
  }

  confirmRoomAssignment(): void {
    const prop = this.activeProperty();
    const res = this.selectedReservation();
    const roomId = this.selectedRoomId();

    if (!prop || !res || !roomId) {
      this.errorMessage.set('Please select an eligible physical room.');
      return;
    }

    this.isAssigning.set(true);
    this.errorMessage.set(null);

    this.pmsApi
      .assignRoom(prop.id, res.id, {
        roomId,
        reason: this.assignmentReason.trim() || undefined,
        allowUpgrade: this.allowUpgrade,
      })
      .subscribe({
        next: (updatedRes) => {
          this.isAssigning.set(false);
          this.showAssignModal.set(false);

          // Update in arrivals array
          const list = this.arrivals().map((r) => (r.id === res.id ? updatedRes.data : r));
          this.arrivals.set(list);
          this.applyFilter();

          this.successMessage.set(
            `Room ${updatedRes.data.assignedRoom?.roomNumber || 'assigned'} allocated to ${res.guest?.firstName} ${res.guest?.lastName}.`,
          );
        },
        error: (err) => {
          this.isAssigning.set(false);
          this.errorMessage.set(
            err?.error?.message || err?.error?.detail || 'Failed to assign room.',
          );
        },
      });
  }

  // --- Check-In Methods ---
  openCheckInModal(res: ReservationDto): void {
    this.selectedReservation.set(res);
    this.identityVerified = true;
    this.registrationCardSigned = true;
    this.allowCleanOverride = false;
    this.cleanOverrideReason = '';
    this.checkInSuccessData.set(null);
    this.showCheckInModal.set(true);
    this.errorMessage.set(null);
  }

  closeCheckInModal(): void {
    this.showCheckInModal.set(false);
    this.checkInSuccessData.set(null);
  }

  confirmCheckIn(): void {
    const prop = this.activeProperty();
    const res = this.selectedReservation();
    if (!prop || !res) return;

    this.isCheckingIn.set(true);
    this.errorMessage.set(null);

    this.pmsApi
      .checkIn(prop.id, res.id, {
        identityVerified: this.identityVerified,
        registrationCardSigned: this.registrationCardSigned,
        allowCleanOverride: this.allowCleanOverride,
        overrideReason: this.allowCleanOverride ? this.cleanOverrideReason : undefined,
      })
      .subscribe({
        next: (checkInRes) => {
          this.isCheckingIn.set(false);
          this.checkInSuccessData.set(checkInRes.data);

          // Update in arrivals list
          const list = this.arrivals().map((r) =>
            r.id === res.id ? checkInRes.data.reservation : r,
          );
          this.arrivals.set(list);
          this.applyFilter();

          this.successMessage.set(
            `Check-in complete! Room ${checkInRes.data.room.roomNumber} is now OCCUPIED.`,
          );
        },
        error: (err) => {
          this.isCheckingIn.set(false);
          this.errorMessage.set(
            err?.error?.message || err?.error?.detail || 'Failed to complete check-in.',
          );
        },
      });
  }

  navigateToFolio(reservationId: string): void {
    this.closeCheckInModal();
    this.router.navigate(['/pms/folios'], { queryParams: { reservationId } });
  }
}
