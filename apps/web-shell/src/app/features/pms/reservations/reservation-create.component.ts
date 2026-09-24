import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  RoomTypeDto,
  RatePlanDto,
  CreateReservationDto,
} from '@hms/api-contracts';

@Component({
  selector: 'app-reservation-create',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reservation-create.component.html',
  styleUrls: ['./reservation-create.component.css'],
})
export class ReservationCreateComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly roomTypesLoading = signal<boolean>(false);
  readonly ratePlansLoading = signal<boolean>(false);
  readonly roomTypesError = signal<string | null>(null);
  readonly ratePlansError = signal<string | null>(null);

  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly ratePlans = signal<RatePlanDto[]>([]);

  // Form Model
  firstName = '';
  lastName = '';
  email = '';
  phone = '';

  selectedRoomTypeId = '';
  selectedRatePlanId = '';

  arrivalDate = '';
  departureDate = '';
  adultsCount = 1;
  childrenCount = 0;
  specialRequests = '';

  ngOnInit(): void {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    this.arrivalDate = today.toISOString().split('T')[0];
    this.departureDate = tomorrow.toISOString().split('T')[0];

    const prop = this.activeProperty();
    if (prop) {
      this.loadPrerequisites(prop.id);
    }
  }

  loadPrerequisites(propertyId: string): void {
    this.loadRoomTypes(propertyId);
    this.loadRatePlans(propertyId);
  }

  loadRoomTypes(propertyId: string): void {
    this.roomTypesLoading.set(true);
    this.roomTypesError.set(null);

    this.pmsApi.getRoomTypes(propertyId).subscribe({
      next: (rtRes) => {
        const types = rtRes.data || [];
        this.roomTypes.set(types);
        if (types.length > 0 && !this.selectedRoomTypeId) {
          this.selectedRoomTypeId = types[0].id;
        }
        this.roomTypesLoading.set(false);
      },
      error: (err) => {
        this.roomTypesError.set(err?.error?.message || 'Unable to load room types.');
        this.roomTypesLoading.set(false);
      },
    });
  }

  loadRatePlans(propertyId: string): void {
    this.ratePlansLoading.set(true);
    this.ratePlansError.set(null);

    this.pmsApi.getRatePlans(propertyId).subscribe({
      next: (rpRes) => {
        const plans = rpRes.data || [];
        this.ratePlans.set(plans);
        if (plans.length > 0 && !this.selectedRatePlanId) {
          this.selectedRatePlanId = plans[0].id;
        }
        this.ratePlansLoading.set(false);
      },
      error: (err) => {
        this.ratePlansError.set(err?.error?.message || 'Unable to load rate plans.');
        this.ratePlansLoading.set(false);
      },
    });
  }

  retryLoadRoomTypes(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadRoomTypes(prop.id);
    }
  }

  retryLoadRatePlans(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadRatePlans(prop.id);
    }
  }

  onSubmit(): void {
    const prop = this.activeProperty();
    if (!prop) {
      this.errorMessage.set('No active property selected.');
      return;
    }

    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.errorMessage.set('Guest first and last name are required.');
      return;
    }

    if (!this.selectedRoomTypeId || !this.selectedRatePlanId) {
      this.errorMessage.set('Please select a valid Room Type and Rate Plan.');
      return;
    }

    if (this.arrivalDate >= this.departureDate) {
      this.errorMessage.set('Departure date must be strictly after arrival date.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CreateReservationDto = {
      roomTypeId: this.selectedRoomTypeId,
      ratePlanId: this.selectedRatePlanId,
      arrivalDate: this.arrivalDate,
      departureDate: this.departureDate,
      adultsCount: Number(this.adultsCount),
      childrenCount: Number(this.childrenCount),
      guest: {
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim() || undefined,
        phone: this.phone.trim() || undefined,
      },
      specialRequests: this.specialRequests.trim() || undefined,
    };

    this.pmsApi.createReservation(prop.id, dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.data?.id) {
          this.router.navigate(['/pms/reservations', res.data.id]);
        } else {
          this.router.navigate(['/pms/reservations']);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message || err?.error?.detail || 'Failed to create reservation.',
        );
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/pms/reservations']);
  }
}
