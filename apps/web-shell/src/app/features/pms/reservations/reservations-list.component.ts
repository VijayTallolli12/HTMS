import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import { ReservationDto } from '@hms/api-contracts';

@Component({
  selector: 'app-reservations-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reservations-list.component.html',
  styleUrls: ['./reservations-list.component.css'],
})
export class ReservationsListComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly reservations = signal<ReservationDto[]>([]);
  readonly filteredReservations = signal<ReservationDto[]>([]);

  selectedStatus = signal<string>('ALL');
  searchQuery = signal<string>('');

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadReservations(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadReservations(prop.id);
    }
  }

  loadReservations(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getReservations(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        this.reservations.set(items);
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load reservations.');
        this.isLoading.set(false);
      },
    });
  }

  setStatusFilter(status: string): void {
    this.selectedStatus.set(status);
    this.applyFilters();
  }

  onSearchChange(text: string): void {
    this.searchQuery.set(text);
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.reservations()];
    const status = this.selectedStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (status !== 'ALL') {
      result = result.filter((r) => r.status === status);
    }

    if (query) {
      result = result.filter(
        (r) =>
          r.confirmationNumber.toLowerCase().includes(query) ||
          (r.guest?.firstName && r.guest.firstName.toLowerCase().includes(query)) ||
          (r.guest?.lastName && r.guest.lastName.toLowerCase().includes(query)) ||
          (r.roomTypeCode && r.roomTypeCode.toLowerCase().includes(query)),
      );
    }

    this.filteredReservations.set(result);
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
