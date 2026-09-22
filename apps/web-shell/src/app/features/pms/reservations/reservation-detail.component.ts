import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import { ReservationDto } from '@hms/api-contracts';

@Component({
  selector: 'app-reservation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reservation-detail.component.html',
  styleUrls: ['./reservation-detail.component.css'],
})
export class ReservationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly reservation = signal<ReservationDto | null>(null);

  // Cancellation modal state
  showCancelModal = signal<boolean>(false);
  cancellationReason = '';
  isCancelling = signal<boolean>(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const prop = this.activeProperty();
    if (id && prop) {
      this.loadReservation(prop.id, id);
    }
  }

  loadReservation(propertyId: string, reservationId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getReservation(propertyId, reservationId).subscribe({
      next: (res) => {
        this.reservation.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load reservation details.');
        this.isLoading.set(false);
      },
    });
  }

  openCancelModal(): void {
    this.cancellationReason = '';
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
  }

  confirmCancellation(): void {
    const prop = this.activeProperty();
    const res = this.reservation();
    if (!prop || !res) return;

    if (!this.cancellationReason.trim()) {
      this.errorMessage.set('Please provide a cancellation reason.');
      return;
    }

    this.isCancelling.set(true);
    this.pmsApi
      .cancelReservation(prop.id, res.id, { reason: this.cancellationReason.trim() })
      .subscribe({
        next: (response) => {
          this.reservation.set(response.data);
          this.isCancelling.set(false);
          this.showCancelModal.set(false);
          this.successMessage.set('Reservation successfully cancelled and inventory released.');
        },
        error: (err) => {
          this.isCancelling.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to cancel reservation.');
        },
      });
  }

  navigateTo(path: string, queryParams?: any): void {
    this.router.navigate([path], { queryParams });
  }
}
