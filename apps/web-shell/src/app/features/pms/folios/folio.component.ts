import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  HmsModalComponent,
  HmsAlertComponent,
  HmsButtonComponent,
  HmsEmptyComponent,
  HmsLoadingComponent,
  HmsDataTableComponent,
  HmsStatusPillComponent,
  HmsSearchComponent,
} from '../../../shared/index';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  FolioDetailDto,
  PaymentMethod,
  ReservationDto,
  CheckoutResponseDto,
} from '@hms/api-contracts';

@Component({
  selector: 'app-folio',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HmsModalComponent, HmsAlertComponent, HmsButtonComponent, HmsEmptyComponent, HmsLoadingComponent, HmsDataTableComponent, HmsStatusPillComponent, HmsSearchComponent],
  templateUrl: './folio.component.html',
  styleUrls: ['./folio.component.css'],
})
export class FolioComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly activeFolio = signal<FolioDetailDto | null>(null);
  readonly activeReservation = signal<ReservationDto | null>(null);
  readonly reservationsList = signal<ReservationDto[]>([]);

  showChargeModal = signal<boolean>(false);
  chargeTxCode = 'ROOM_SERVICE';
  chargeDescription = 'In-Room Dining Dining Experience';
  chargeAmount = '85.00';
  chargeTaxAmount = '8.50';
  chargeReason = '';
  isPostingCharge = signal<boolean>(false);

  showPaymentModal = signal<boolean>(false);
  paymentMethod: PaymentMethod = PaymentMethod.CREDIT_CARD;
  paymentAmount = '';
  paymentReference = 'AUTH-MC-8821';
  isRecordingPayment = signal<boolean>(false);

  isCheckingOut = signal<boolean>(false);
  checkoutReceipt = signal<CheckoutResponseDto | null>(null);

  chargeColumns = [
    { field: 'postedAt', label: 'Date / Time' },
    { field: 'transactionCode', label: 'Tx Code' },
    { field: 'description', label: 'Description' },
    { field: 'taxAmount', label: 'Tax' },
    { field: 'amount', label: 'Total' },
  ];
  paymentColumns = [
    { field: 'processedAt', label: 'Date / Time' },
    { field: 'paymentMethod', label: 'Method' },
    { field: 'referenceNumber', label: 'Reference #' },
    { field: 'status', label: 'Status' },
    { field: 'amount', label: 'Amount' },
  ];

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.initFolioContext(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.initFolioContext(prop.id);
    }
  }

  initFolioContext(propertyId: string): void {
    const folioId = this.route.snapshot.paramMap.get('folioId');
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');

    if (folioId) {
      this.loadFolioById(propertyId, folioId);
    } else if (reservationId) {
      this.loadFolioByReservation(propertyId, reservationId);
    } else {
      this.loadReservationsForSelection(propertyId);
    }
  }

  loadReservationsForSelection(propertyId: string): void {
    this.isLoading.set(true);
    this.pmsApi.getReservations(propertyId, { limit: 50 }).subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        this.reservationsList.set(items);
        const activeRes = items.find((r) => r.status === 'CHECKED_IN') || items[0];
        if (activeRes) {
          this.loadFolioByReservation(propertyId, activeRes.id);
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  loadFolioById(propertyId: string, folioId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getFolioById(propertyId, folioId).subscribe({
      next: (res) => {
        this.activeFolio.set(res.data);
        if (res.data?.reservationId) {
          this.pmsApi.getReservation(propertyId, res.data.reservationId).subscribe({
            next: (resDto) => {
              this.activeReservation.set(resDto.data);
              this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load folio.');
        this.isLoading.set(false);
      },
    });
  }

  loadFolioByReservation(propertyId: string, reservationId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getReservation(propertyId, reservationId).subscribe({
      next: (resDto) => {
        this.activeReservation.set(resDto.data);

        this.pmsApi.getFolios(propertyId, reservationId).subscribe({
          next: (folioListRes) => {
            const folios = folioListRes.data || [];
            if (folios.length > 0) {
              this.loadFolioById(propertyId, folios[0].id);
            } else {
              this.activeFolio.set(null);
              this.isLoading.set(false);
            }
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to load reservation folios.');
            this.isLoading.set(false);
          },
        });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load reservation.');
        this.isLoading.set(false);
      },
    });
  }

  createFolioForReservation(): void {
    const prop = this.activeProperty();
    const res = this.activeReservation();
    if (!prop || !res) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.createFolio(prop.id, { reservationId: res.id }).subscribe({
      next: (folioRes) => {
        this.loadFolioById(prop.id, folioRes.data.id);
        this.successMessage.set(`Master Folio #${folioRes.data.folioNumber} opened successfully.`);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to create folio.');
      },
    });
  }

  onSelectReservation(reservationId: string): void {
    const prop = this.activeProperty();
    if (prop && reservationId) {
      this.loadFolioByReservation(prop.id, reservationId);
    }
  }

  openPostChargeModal(): void {
    this.showChargeModal.set(true);
    this.chargeAmount = '120.00';
    this.chargeTaxAmount = '12.00';
    this.errorMessage.set(null);
  }

  closePostChargeModal(): void {
    this.showChargeModal.set(false);
  }

  submitPostCharge(): void {
    const prop = this.activeProperty();
    const folio = this.activeFolio();
    if (!prop || !folio) return;

    const amountNum = parseFloat(this.chargeAmount);
    if (isNaN(amountNum) || amountNum === 0) {
      this.errorMessage.set('Please enter a valid charge amount.');
      return;
    }

    this.isPostingCharge.set(true);
    this.errorMessage.set(null);

    this.pmsApi
      .postCharge(prop.id, folio.id, {
        transactionCode: this.chargeTxCode,
        description: this.chargeDescription,
        amount: this.chargeAmount,
        taxAmount: this.chargeTaxAmount || undefined,
        reasonCode: amountNum < 0 ? (this.chargeReason || 'ADJUSTMENT') : undefined,
      })
      .subscribe({
        next: (tx) => {
          this.isPostingCharge.set(false);
          this.showChargeModal.set(false);
          this.loadFolioById(prop.id, folio.id);
          this.successMessage.set(`Charge of ${folio.currency} ${tx.data.amount} posted to ledger.`);
        },
        error: (err) => {
          this.isPostingCharge.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to post charge.');
        },
      });
  }

  openRecordPaymentModal(): void {
    const folio = this.activeFolio();
    if (folio) {
      const bal = parseFloat(folio.balance);
      this.paymentAmount = bal > 0 ? bal.toFixed(2) : '0.00';
    }
    this.showPaymentModal.set(true);
    this.errorMessage.set(null);
  }

  closeRecordPaymentModal(): void {
    this.showPaymentModal.set(false);
  }

  submitRecordPayment(): void {
    const prop = this.activeProperty();
    const folio = this.activeFolio();
    if (!prop || !folio) return;

    const amountNum = parseFloat(this.paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      this.errorMessage.set('Payment amount must be greater than 0.');
      return;
    }

    this.isRecordingPayment.set(true);
    this.errorMessage.set(null);

    this.pmsApi
      .recordPayment(prop.id, folio.id, {
        amount: this.paymentAmount,
        paymentMethod: this.paymentMethod,
        referenceNumber: this.paymentReference || undefined,
      })
      .subscribe({
        next: (payRes) => {
          this.isRecordingPayment.set(false);
          this.showPaymentModal.set(false);
          this.loadFolioById(prop.id, folio.id);
          this.successMessage.set(
            `Payment of ${payRes.data.currency} ${payRes.data.amount} recorded successfully.`,
          );
        },
        error: (err) => {
          this.isRecordingPayment.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to record payment.');
        },
      });
  }

  executeCheckout(): void {
    const prop = this.activeProperty();
    const res = this.activeReservation();
    const folio = this.activeFolio();
    if (!prop || !res || !folio) return;

    const balanceNum = parseFloat(folio.balance);
    if (balanceNum !== 0) {
      this.errorMessage.set(
        `Checkout blocked: Strict zero-balance policy requires balance to be 0.00 (current: ${folio.currency} ${folio.balance}).`,
      );
      return;
    }

    this.isCheckingOut.set(true);
    this.errorMessage.set(null);

    this.pmsApi.checkout(prop.id, res.id).subscribe({
      next: (checkoutRes) => {
        this.isCheckingOut.set(false);
        this.checkoutReceipt.set(checkoutRes.data);
        this.loadFolioById(prop.id, folio.id);
        this.successMessage.set(
          `Departure complete! Room ${checkoutRes.data.room.roomNumber} returned to VACANT / DIRTY.`,
        );
      },
      error: (err) => {
        this.isCheckingOut.set(false);
        this.errorMessage.set(
          err?.error?.message || err?.error?.detail || 'Departure checkout failed.',
        );
      },
    });
  }

  closeReceiptModal(): void {
    this.checkoutReceipt.set(null);
  }

  isZeroBalance(): boolean {
    const folio = this.activeFolio();
    if (!folio) return false;
    return parseFloat(folio.balance) === 0;
  }
}
