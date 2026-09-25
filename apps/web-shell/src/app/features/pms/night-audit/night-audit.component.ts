import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrganizationService } from '../../../core/services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  NightAuditRunDto,
  NightAuditStatus,
  NightAuditStatusDto,
  NightAuditStepDto,
  NightAuditValidationReportDto,
  PropertyBusinessDateDto,
} from '@hms/api-contracts';
import {
  HmsDataTableComponent,
  HmsAlertComponent,
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsEmptyComponent,
  HmsLoadingComponent,
  HmsModalComponent,
} from '../../../shared/index';

@Component({
  selector: 'app-night-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HmsDataTableComponent,
    HmsAlertComponent,
    HmsButtonComponent,
    HmsStatusPillComponent,
    HmsEmptyComponent,
    HmsLoadingComponent,
    HmsModalComponent,
  ],
  templateUrl: './night-audit.component.html',
  styleUrls: ['./night-audit.component.css'],
})
export class NightAuditComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  readonly isLoading = signal<boolean>(false);
  readonly isValidating = signal<boolean>(false);
  readonly isRunning = signal<boolean>(false);
  readonly isRecovering = signal<boolean>(false);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly statusData = signal<NightAuditStatusDto | null>(null);
  readonly validationReport = signal<NightAuditValidationReportDto | null>(null);
  readonly auditHistory = signal<NightAuditRunDto[]>([]);
  readonly selectedRun = signal<NightAuditRunDto | null>(null);

  readonly activeTab = signal<'overview' | 'validation' | 'history'>('overview');

  // Confirmation & Recovery Modal State
  readonly showConfirmModal = signal<boolean>(false);
  readonly showRecoveryModal = signal<boolean>(false);
  readonly showRunDetailModal = signal<boolean>(false);

  readonly overrideWarnings = signal<boolean>(false);
  readonly overrideReason = signal<string>('');
  readonly recoveryReason = signal<string>('');

  readonly businessDate = computed<PropertyBusinessDateDto | null>(() => {
    return this.statusData()?.businessDate || null;
  });

  readonly isAuditInProgress = computed<boolean>(() => {
    return this.statusData()?.isAuditInProgress ?? false;
  });

  readonly activeRun = computed<NightAuditRunDto | null>(() => {
    return this.statusData()?.activeRun || null;
  });

  readonly lastCompletedRun = computed<NightAuditRunDto | null>(() => {
    return this.statusData()?.lastCompletedRun || null;
  });

  readonly daysBehind = computed<number>(() => {
    return this.businessDate()?.daysBehindCalendar ?? 0;
  });

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadAll(prop.id);
    }
  }

  loadAll(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getNightAuditStatus(propertyId).subscribe({
      next: (res) => {
        this.statusData.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Failed to load night audit status.');
        this.isLoading.set(false);
      },
    });

    this.loadHistory(propertyId);
  }

  loadHistory(propertyId: string): void {
    this.pmsApi.getNightAuditHistory(propertyId, 20).subscribe({
      next: (res) => {
        this.auditHistory.set(res.data);
      },
      error: (err) => {
        console.error('Failed to load audit history', err);
      },
    });
  }

  runValidation(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    this.isValidating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi.validateNightAudit(prop.id).subscribe({
      next: (res) => {
        this.validationReport.set(res.data);
        this.isValidating.set(false);
        this.activeTab.set('validation');
        if (res.data.canProceed && !res.data.hasWarnings) {
          this.successMessage.set('Pre-audit validation passed with 0 blocking issues or warnings. Ready for rollover.');
        } else if (res.data.hasBlockingIssues) {
          this.errorMessage.set('Pre-audit checks found blocking operational issues. Resolve them before running audit.');
        } else if (res.data.hasWarnings) {
          this.successMessage.set('Pre-audit checks completed with operational warnings. Override authorization is required to proceed.');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Validation request failed.');
        this.isValidating.set(false);
      },
    });
  }

  openRunConfirm(): void {
    this.overrideWarnings.set(false);
    this.overrideReason.set('');
    this.showConfirmModal.set(true);
  }

  closeRunConfirm(): void {
    this.showConfirmModal.set(false);
  }

  executeAudit(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    const report = this.validationReport();
    if (report?.hasWarnings && !this.overrideWarnings()) {
      this.errorMessage.set('You must check the override authorization to proceed with warnings.');
      return;
    }

    if (report?.hasWarnings && this.overrideWarnings() && !this.overrideReason().trim()) {
      this.errorMessage.set('Please provide an operational justification for overriding warnings.');
      return;
    }

    this.isRunning.set(true);
    this.errorMessage.set(null);
    this.showConfirmModal.set(false);

    this.pmsApi
      .runNightAudit(prop.id, {
        overrideWarnings: this.overrideWarnings(),
        overrideReason: this.overrideReason().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isRunning.set(false);
          this.successMessage.set(
            `Night Audit successfully executed! Business date advanced to ${res.data.nextBusinessDate}. Total charges posted: ${res.data.metrics?.roomNightsPosted ?? 0}.`,
          );
          this.loadAll(prop.id);
          this.activeTab.set('overview');
        },
        error: (err) => {
          this.isRunning.set(false);
          this.errorMessage.set(
            err.error?.message || 'Night audit failed to complete. Inspect logs or retry.',
          );
          this.loadAll(prop.id);
        },
      });
  }

  openRecoveryModal(): void {
    this.recoveryReason.set('');
    this.showRecoveryModal.set(true);
  }

  closeRecoveryModal(): void {
    this.showRecoveryModal.set(false);
  }

  executeRecovery(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    if (!this.recoveryReason().trim()) {
      this.errorMessage.set('Please provide a reason for emergency unlocking.');
      return;
    }

    this.isRecovering.set(true);
    this.errorMessage.set(null);

    this.pmsApi
      .recoverNightAudit(prop.id, {
        reason: this.recoveryReason().trim(),
      })
      .subscribe({
        next: (res) => {
          this.isRecovering.set(false);
          this.showRecoveryModal.set(false);
          this.successMessage.set('Audit lock successfully cleared. System state restored to ready.');
          this.loadAll(prop.id);
        },
        error: (err) => {
          this.isRecovering.set(false);
          this.errorMessage.set(err.error?.message || 'Emergency recovery failed.');
        },
      });
  }

  inspectRun(run: NightAuditRunDto): void {
    this.selectedRun.set(run);
    this.showRunDetailModal.set(true);
  }

  closeRunDetail(): void {
    this.showRunDetailModal.set(false);
  }

  getStatusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
      case 'RUNNING':
        return 'warning';
      case 'FAILED':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

