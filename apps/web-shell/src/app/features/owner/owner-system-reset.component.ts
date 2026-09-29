import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SetupStatusDto } from '@hms/api-contracts';
import { SetupService } from '../../core/services/setup.service';

interface InstallationSummary {
  hotelGroupName: string | null;
  propertyName: string | null;
  propertyCode: string | null;
  propertyCount: number;
  userCount: number;
  roomCount: number;
  reservationCount: number;
}

@Component({
  selector: 'app-owner-system-reset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-system-reset.component.html',
  styleUrls: ['./owner-system-reset.component.css'],
})
export class OwnerSystemResetComponent implements OnInit {
  private readonly setupService = inject(SetupService);
  private readonly router = inject(Router);

  readonly status = signal<SetupStatusDto | null>(null);
  readonly isLoading = signal(true);
  readonly isResetting = signal(false);
  readonly resetSuccess = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly confirmationInput = signal('');
  readonly showConfirmation = signal(false);

  readonly REQUIRED_CONFIRMATION = 'RESET INSTALLATION';

  readonly installationSummary = computed<InstallationSummary>(() => {
    const s = this.status();
    const counts = s?.counts;
    return {
      hotelGroupName: null,
      propertyName: null,
      propertyCode: null,
      propertyCount: counts?.properties ?? 0,
      userCount: counts?.users ?? 0,
      roomCount: counts?.rooms ?? 0,
      reservationCount: 0,
    };
  });

  readonly canReset = computed(() => {
    const input = this.confirmationInput().trim();
    return input === this.REQUIRED_CONFIRMATION && !this.isResetting() && !this.resetSuccess();
  });

  ngOnInit(): void {
    this.setupService.refreshStatus().subscribe((status) => {
      this.status.set(status);
      this.isLoading.set(false);
    });
  }

  async onReset(): Promise<void> {
    if (!this.canReset()) return;

    this.isResetting.set(true);
    this.resetError.set(null);

    try {
      const result = await this.setupService
        .systemReset(this.REQUIRED_CONFIRMATION)
        .toPromise();

      this.resetSuccess.set(true);
      this.isResetting.set(false);

      // Clear any cached wizard state
      this.setupService.clearWizard();

      // Navigate to setup wizard after a brief delay
      setTimeout(() => {
        this.router.navigate(['/setup']);
      }, 2000);
    } catch (err: any) {
      this.isResetting.set(false);
      const message = err?.error?.message || err?.message || 'Reset failed. Please try again.';
      this.resetError.set(message);
    }
  }

  onConfirmationChange(value: string): void {
    this.confirmationInput.set(value);
    this.resetError.set(null);
  }

  navigateToSetup(): void {
    this.router.navigate(['/setup']);
  }
}