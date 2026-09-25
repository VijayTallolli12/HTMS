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
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import {
  SpaApiService,
  InHouseGuestOption,
} from './services/spa-api.service';
import {
  SpaServiceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaAppointmentDto,
  SpaAppointmentStatus,
  SpaSettlementType,
  SpaPaymentMethod,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../shared/index';

type ActiveSpaTab = 'appointments' | 'services' | 'team';

@Component({
  selector: 'app-spa-workspace',
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
  templateUrl: './spa-workspace.component.html',
  styleUrls: ['./spa-workspace.component.css'],
})
export class SpaWorkspaceComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly spaApi = inject(SpaApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // View state
  activeTab = signal<ActiveSpaTab>('appointments');
  statusFilter = signal<string>('ALL');
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Spa Data
  services = signal<SpaServiceDto[]>([]);
  therapists = signal<SpaTherapistDto[]>([]);
  rooms = signal<SpaRoomDto[]>([]);
  appointments = signal<SpaAppointmentDto[]>([]);
  inHouseGuests = signal<InHouseGuestOption[]>([]);

  // Filtered Appointments
  filteredAppointments = computed(() => {
    const list = this.appointments();
    const filter = this.statusFilter();
    if (filter === 'ALL') return list;
    return list.filter((a) => a.status === filter);
  });

  // Selected Date Filter (Default Today YYYY-MM-DD)
  selectedDate = signal<string>(new Date().toISOString().slice(0, 10));

  // Modals state
  showBookModal = signal<boolean>(false);
  showCompleteModal = signal<boolean>(false);

  // Booking Form State
  bookServiceId = '';
  bookTherapistId = '';
  bookRoomId = '';
  bookDate = new Date().toISOString().slice(0, 10);
  bookTime = '14:00';
  bookGuestType: 'in-house' | 'walk-in' = 'in-house';
  bookSelectedGuestResId = '';
  bookGuestName = '';
  bookGuestPhone = '';
  bookRoomNumber = '';
  bookNotes = '';

  // Selected Service for duration/price info
  selectedServiceInfo = computed(() => {
    return this.services().find((s) => s.id === this.bookServiceId) || null;
  });

  // Complete & Settle Form State
  targetAppointment = signal<SpaAppointmentDto | null>(null);
  completeSettlementType: SpaSettlementType = 'ROOM_CHARGE';
  completePaymentMethod: SpaPaymentMethod = 'ROOM_CHARGE';
  completeSelectedGuestResId = '';
  completeManualRoomNumber = '';

  // Permission helpers
  hasPermission(perm: string): boolean {
    return this.authService.hasPermission(perm);
  }

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop?.id) {
          this.loadAllSpaData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAllSpaData(prop.id);
    }
  }

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  loadAllSpaData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.spaApi.getServices(propertyId).subscribe({
      next: (res) => this.services.set(res.data || []),
    });

    this.spaApi.getTherapists(propertyId).subscribe({
      next: (res) => this.therapists.set(res.data || []),
    });

    this.spaApi.getRooms(propertyId).subscribe({
      next: (res) => this.rooms.set(res.data || []),
    });

    this.spaApi.getInHouseGuests(propertyId).subscribe({
      next: (res) => this.inHouseGuests.set(res.data || []),
    });

    this.loadAppointments(propertyId);
  }

  loadAppointments(propertyId: string): void {
    this.spaApi
      .getAppointments(propertyId, { date: this.selectedDate() })
      .subscribe({
        next: (res) => {
          this.appointments.set(res.data || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.message || 'Failed to load spa appointments',
          );
          this.isLoading.set(false);
        },
      });
  }

  onDateChange(newDate: string): void {
    this.selectedDate.set(newDate);
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAppointments(prop.id);
    }
  }

  // -------------------------------------------------------------
  // Booking Appointment
  // -------------------------------------------------------------
  openBookModal(): void {
    const sList = this.services();
    const tList = this.therapists();
    const rList = this.rooms();

    this.bookServiceId = sList.length > 0 ? sList[0].id : '';
    this.bookTherapistId = tList.length > 0 ? tList[0].id : '';
    this.bookRoomId = rList.length > 0 ? rList[0].id : '';
    this.bookDate = this.selectedDate();
    this.bookTime = '14:00';
    this.bookGuestType = 'in-house';
    this.bookSelectedGuestResId = '';
    this.bookGuestName = '';
    this.bookGuestPhone = '';
    this.bookRoomNumber = '';
    this.bookNotes = '';

    this.showBookModal.set(true);
  }

  onBookGuestSelect(): void {
    if (this.bookSelectedGuestResId) {
      const g = this.inHouseGuests().find(
        (x) => x.reservationId === this.bookSelectedGuestResId,
      );
      if (g) {
        this.bookGuestName = g.guestName;
        this.bookRoomNumber = g.roomNumber;
      }
    }
  }

  confirmBooking(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.bookServiceId || !this.bookTherapistId || !this.bookRoomId) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const startIso = `${this.bookDate}T${this.bookTime}:00.000Z`;

    let guestName = this.bookGuestName;
    let roomNumber = this.bookRoomNumber;
    let reservationId = this.bookSelectedGuestResId || undefined;

    if (this.bookGuestType === 'in-house' && this.bookSelectedGuestResId) {
      const g = this.inHouseGuests().find(
        (x) => x.reservationId === this.bookSelectedGuestResId,
      );
      if (g) {
        guestName = g.guestName;
        roomNumber = g.roomNumber;
      }
    }

    this.spaApi
      .createAppointment(prop.id, {
        serviceId: this.bookServiceId,
        therapistId: this.bookTherapistId,
        roomId: this.bookRoomId,
        startTime: startIso,
        guestName: guestName || undefined,
        guestPhone: this.bookGuestPhone || undefined,
        roomNumber: roomNumber || undefined,
        reservationId,
        notes: this.bookNotes || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showBookModal.set(false);
          this.successMessage.set(
            `Appointment #${res.data.appointmentNumber} booked successfully for ${res.data.serviceName} with ${res.data.therapistName}.`,
          );
          this.loadAppointments(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to book appointment',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Lifecycle Transitions
  // -------------------------------------------------------------
  updateStatus(appt: SpaAppointmentDto, nextStatus: SpaAppointmentStatus): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.spaApi
      .updateAppointmentStatus(prop.id, appt.id, { status: nextStatus })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.successMessage.set(
            `Appointment #${res.data.appointmentNumber} updated to ${nextStatus}.`,
          );
          this.loadAppointments(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to update appointment status',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Complete Treatment & Folio Settle
  // -------------------------------------------------------------
  openCompleteModal(appt: SpaAppointmentDto): void {
    this.targetAppointment.set(appt);
    this.completeSettlementType = appt.roomNumber ? 'ROOM_CHARGE' : 'DIRECT_PAY';
    this.completePaymentMethod = appt.roomNumber ? 'ROOM_CHARGE' : 'CREDIT_CARD';
    this.completeManualRoomNumber = appt.roomNumber || '';
    this.completeSelectedGuestResId = appt.reservationId || '';

    // If reservation not already set but room number exists, find in inHouseGuests
    if (!this.completeSelectedGuestResId && appt.roomNumber) {
      const match = this.inHouseGuests().find(
        (g) => g.roomNumber.toLowerCase() === appt.roomNumber?.toLowerCase(),
      );
      if (match) {
        this.completeSelectedGuestResId = match.reservationId;
      }
    }

    this.showCompleteModal.set(true);
  }

  confirmComplete(): void {
    const prop = this.activeProperty();
    const appt = this.targetAppointment();
    if (!prop?.id || !appt) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    let roomNumber: string | undefined = undefined;
    let reservationId: string | undefined = undefined;
    let folioId: string | undefined = undefined;

    if (this.completeSettlementType === 'ROOM_CHARGE') {
      if (this.completeSelectedGuestResId) {
        const guest = this.inHouseGuests().find(
          (g) => g.reservationId === this.completeSelectedGuestResId,
        );
        if (guest) {
          reservationId = guest.reservationId;
          roomNumber = guest.roomNumber;
          folioId = guest.folioId || undefined;
        }
      } else if (this.completeManualRoomNumber) {
        roomNumber = this.completeManualRoomNumber.trim();
      } else {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          'Please select a checked-in guest or enter a room number to post to folio.',
        );
        return;
      }
    }

    this.spaApi
      .completeAppointment(prop.id, appt.id, {
        settlementType: this.completeSettlementType,
        paymentMethod:
          this.completeSettlementType === 'ROOM_CHARGE'
            ? 'ROOM_CHARGE'
            : this.completePaymentMethod,
        roomNumber,
        reservationId,
        folioId,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCompleteModal.set(false);

          if (res.data.settlementType === 'ROOM_CHARGE') {
            this.successMessage.set(
              `Appointment #${res.data.appointmentNumber} completed and posted to Room ${res.data.roomNumber} folio. Cashier Tx #${res.data.folioTransactionId}.`,
            );
          } else {
            this.successMessage.set(
              `Appointment #${res.data.appointmentNumber} completed and settled via ${res.data.paymentMethod}.`,
            );
          }

          this.loadAppointments(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to complete appointment and post charge',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  getStatusPillVariant(
    status: SpaAppointmentStatus,
  ): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return 'warning';
      case 'SCHEDULED':
        return 'info';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'default';
    }
  }

  formatPrice(price: string | number, currency = 'JPY'): string {
    const num = Number(price) || 0;
    if (currency === 'JPY') {
      return `¥${num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    }
    return `$${num.toFixed(2)}`;
  }

  formatTimeRange(start: string, end: string): string {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const sHours = String(s.getUTCHours()).padStart(2, '0');
      const sMins = String(s.getUTCMinutes()).padStart(2, '0');
      const eHours = String(e.getUTCHours()).padStart(2, '0');
      const eMins = String(e.getUTCMinutes()).padStart(2, '0');
      return `${sHours}:${sMins} - ${eHours}:${eMins}`;
    } catch {
      return `${start} - ${end}`;
    }
  }
}

