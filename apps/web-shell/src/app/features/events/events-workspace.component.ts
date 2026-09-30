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
  EventsApiService,
  InHouseGuestOption,
} from './services/events-api.service';
import {
  EventVenueDto,
  EventPackageDto,
  EventResourceDto,
  EventBookingDto,
  EventBookingStatus,
  EventBookingType,
  EventSettlementType,
  EventPaymentMethod,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../shared/index';
import { formatMoney } from '../../shared/utils/currency';

type ActiveEventsTab = 'bookings' | 'venues' | 'packages' | 'resources';

@Component({
  selector: 'app-events-workspace',
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
  templateUrl: './events-workspace.component.html',
  styleUrls: ['./events-workspace.component.css'],
})
export class EventsWorkspaceComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly eventsApi = inject(EventsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // View state
  activeTab = signal<ActiveEventsTab>('bookings');
  statusFilter = signal<string>('ALL');
  venueFilter = signal<string>('ALL');
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Events Domain Data
  venues = signal<EventVenueDto[]>([]);
  packages = signal<EventPackageDto[]>([]);
  resources = signal<EventResourceDto[]>([]);
  bookings = signal<EventBookingDto[]>([]);
  inHouseGuests = signal<InHouseGuestOption[]>([]);

  // Selected Booking for Detail / Modals
  selectedBooking = signal<EventBookingDto | null>(null);

  // Filtered Bookings
  filteredBookings = computed(() => {
    let list = this.bookings();
    const sFilter = this.statusFilter();
    const vFilter = this.venueFilter();

    if (sFilter !== 'ALL') {
      list = list.filter((b) => b.status === sFilter);
    }
    if (vFilter !== 'ALL') {
      list = list.filter((b) => b.venueId === vFilter);
    }
    return list;
  });

  confirmedCount = computed(() => this.bookings().filter((b) => b.status === 'CONFIRMED').length);
  tentativeCount = computed(() => this.bookings().filter((b) => b.status === 'TENTATIVE').length);
  inProgressCount = computed(() => this.bookings().filter((b) => b.status === 'IN_PROGRESS').length);

  // Modal Visibility
  showCreateBookingModal = signal<boolean>(false);
  showDetailModal = signal<boolean>(false);
  showAllocateModal = signal<boolean>(false);
  showCompleteModal = signal<boolean>(false);
  showVenueModal = signal<boolean>(false);
  showPackageModal = signal<boolean>(false);
  showResourceModal = signal<boolean>(false);

  // Create Booking Form
  bookVenueId = '';
  bookPackageId = '';
  bookEventName = '';
  bookEventType: EventBookingType = 'CONFERENCE';
  bookStartDate = new Date().toISOString().slice(0, 10);
  bookStartTime = '09:00';
  bookEndDate = new Date().toISOString().slice(0, 10);
  bookEndTime = '17:00';
  bookExpectedGuests = 50;
  bookHostType: 'in-house' | 'walk-in' = 'in-house';
  bookSelectedGuestResId = '';
  bookHostName = '';
  bookHostEmail = '';
  bookHostPhone = '';
  bookNotes = '';

  // Resource Allocation Form
  allocationRows: Array<{ resourceId: string; quantity: number; notes: string }> = [];

  // Complete Settlement Form
  completeSettlementType: EventSettlementType = 'ROOM_CHARGE';
  completePaymentMethod: EventPaymentMethod = 'ROOM_CHARGE';
  completeRoomNumber = '';

  // Create Venue Form
  newVenueCode = '';
  newVenueName = '';
  newVenueType: any = 'BALLROOM';
  newVenueCapacity = 100;
  newVenueLocation = '';

  // Create Package Form
  newPkgCode = '';
  newPkgName = '';
  newPkgDescription = '';
  newPkgPrice = 8000;
  newPkgMinGuests = 20;

  // Create Resource Form
  newResName = '';
  newResType: any = 'EQUIPMENT';
  newResQuantity = 20;

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadAllData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadAllData(prop.id);
    }
  }

  // -----------------------------------------------------------------
  // DATA LOADING
  // -----------------------------------------------------------------
  loadAllData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.eventsApi.getVenues(propertyId).subscribe({
      next: (res) => this.venues.set(res.data),
      error: (err) => console.error('Failed to load venues', err),
    });

    this.eventsApi.getPackages(propertyId).subscribe({
      next: (res) => this.packages.set(res.data),
      error: (err) => console.error('Failed to load packages', err),
    });

    this.eventsApi.getResources(propertyId).subscribe({
      next: (res) => this.resources.set(res.data),
      error: (err) => console.error('Failed to load resources', err),
    });

    this.eventsApi.getBookings(propertyId).subscribe({
      next: (res) => {
        this.bookings.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to load event bookings.');
        this.isLoading.set(false);
      },
    });

    this.eventsApi.getInHouseGuests(propertyId).subscribe({
      next: (res) => this.inHouseGuests.set(res.data),
      error: (err) => console.error('Failed to load in-house guests', err),
    });
  }

  refreshBookings(): void {
    const prop = this.activeProperty();
    if (!prop) return;
    this.eventsApi.getBookings(prop.id).subscribe({
      next: (res) => this.bookings.set(res.data),
      error: (err) => console.error('Failed to refresh bookings', err),
    });
  }

  // -----------------------------------------------------------------
  // PERMISSIONS
  // -----------------------------------------------------------------
  canCreateBooking(): boolean {
    return this.authService.hasPermission('events.booking.create');
  }

  canManageBooking(): boolean {
    return this.authService.hasPermission('events.booking.manage');
  }

  canConfirmBooking(): boolean {
    return this.authService.hasPermission('events.booking.confirm');
  }

  canCompleteBooking(): boolean {
    return this.authService.hasPermission('events.booking.complete');
  }

  canManageVenues(): boolean {
    return this.authService.hasPermission('events.venue.manage');
  }

  canManagePackages(): boolean {
    return this.authService.hasPermission('events.package.manage');
  }

  // -----------------------------------------------------------------
  // CREATE BOOKING
  // -----------------------------------------------------------------
  openCreateBookingModal(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const v = this.venues();
    this.bookVenueId = v.length > 0 ? v[0].id : '';

    const p = this.packages();
    this.bookPackageId = p.length > 0 ? p[0].id : '';

    this.bookEventName = '';
    this.bookEventType = 'CONFERENCE';
    this.bookExpectedGuests = 50;
    this.bookStartDate = new Date().toISOString().slice(0, 10);
    this.bookStartTime = '09:00';
    this.bookEndDate = new Date().toISOString().slice(0, 10);
    this.bookEndTime = '17:00';
    this.bookNotes = '';

    const guests = this.inHouseGuests();
    if (guests.length > 0) {
      this.bookHostType = 'in-house';
      this.bookSelectedGuestResId = guests[0].reservationId;
      this.bookHostName = guests[0].guestName;
    } else {
      this.bookHostType = 'walk-in';
      this.bookHostName = '';
    }
    this.bookHostEmail = '';
    this.bookHostPhone = '';

    this.showCreateBookingModal.set(true);
  }

  onHostTypeChange(): void {
    if (this.bookHostType === 'in-house') {
      const g = this.inHouseGuests().find(
        (x) => x.reservationId === this.bookSelectedGuestResId,
      );
      if (g) {
        this.bookHostName = g.guestName;
      }
    } else {
      this.bookSelectedGuestResId = '';
    }
  }

  onInHouseGuestSelect(): void {
    const g = this.inHouseGuests().find(
      (x) => x.reservationId === this.bookSelectedGuestResId,
    );
    if (g) {
      this.bookHostName = g.guestName;
    }
  }

  submitCreateBooking(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    if (!this.bookVenueId) {
      this.errorMessage.set('Please select a banquet venue.');
      return;
    }
    if (!this.bookEventName.trim()) {
      this.errorMessage.set('Please enter the event name.');
      return;
    }
    if (!this.bookHostName.trim()) {
      this.errorMessage.set('Please enter host / client name.');
      return;
    }

    const startIso = `${this.bookStartDate}T${this.bookStartTime}:00.000Z`;
    const endIso = `${this.bookEndDate}T${this.bookEndTime}:00.000Z`;

    let roomNumber: string | undefined;
    let reservationId: string | undefined;

    if (this.bookHostType === 'in-house' && this.bookSelectedGuestResId) {
      const g = this.inHouseGuests().find(
        (x) => x.reservationId === this.bookSelectedGuestResId,
      );
      if (g) {
        roomNumber = g.roomNumber;
        reservationId = g.reservationId;
      }
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.eventsApi
      .createBooking(prop.id, {
        venueId: this.bookVenueId,
        packageId: this.bookPackageId || undefined,
        hostName: this.bookHostName.trim(),
        hostEmail: this.bookHostEmail.trim() || undefined,
        hostPhone: this.bookHostPhone.trim() || undefined,
        eventName: this.bookEventName.trim(),
        eventType: this.bookEventType,
        startTime: startIso,
        endTime: endIso,
        expectedGuests: Number(this.bookExpectedGuests),
        notes: this.bookNotes.trim() || undefined,
        roomNumber,
        reservationId,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCreateBookingModal.set(false);
          this.successMessage.set(
            `Event booking #${res.data.bookingNumber} created successfully!`,
          );
          this.refreshBookings();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message || err.message || 'Failed to create event booking.',
          );
        },
      });
  }

  // -----------------------------------------------------------------
  // VIEW BOOKING DETAIL
  // -----------------------------------------------------------------
  openBookingDetail(booking: EventBookingDto): void {
    const prop = this.activeProperty();
    if (!prop) return;

    this.eventsApi.getBooking(prop.id, booking.id).subscribe({
      next: (res) => {
        this.selectedBooking.set(res.data);
        this.showDetailModal.set(true);
      },
      error: (err) => {
        this.selectedBooking.set(booking);
        this.showDetailModal.set(true);
      },
    });
  }

  // -----------------------------------------------------------------
  // STATUS TRANSITIONS (CONFIRM / START / CANCEL)
  // -----------------------------------------------------------------
  advanceStatus(targetStatus: EventBookingStatus): void {
    const prop = this.activeProperty();
    const booking = this.selectedBooking();
    if (!prop || !booking) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.eventsApi
      .updateBookingStatus(prop.id, booking.id, { status: targetStatus })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.selectedBooking.set(res.data);
          this.successMessage.set(
            `Booking #${res.data.bookingNumber} transitioned to ${targetStatus}!`,
          );
          this.refreshBookings();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message ||
              err.message ||
              `Failed to transition status to ${targetStatus}.`,
          );
        },
      });
  }

  // -----------------------------------------------------------------
  // RESOURCE ALLOCATION
  // -----------------------------------------------------------------
  openAllocateModal(booking: EventBookingDto): void {
    this.selectedBooking.set(booking);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Populate existing allocations or empty
    const current = booking.resourceAllocations || [];
    if (current.length > 0) {
      this.allocationRows = current.map((r) => ({
        resourceId: r.resourceId,
        quantity: r.quantity,
        notes: r.notes || '',
      }));
    } else {
      const res = this.resources();
      this.allocationRows = res.slice(0, 2).map((r) => ({
        resourceId: r.id,
        quantity: Math.min(10, r.totalQuantity),
        notes: '',
      }));
    }

    this.showAllocateModal.set(true);
  }

  addAllocationRow(): void {
    const res = this.resources();
    if (res.length === 0) return;
    this.allocationRows.push({
      resourceId: res[0].id,
      quantity: 1,
      notes: '',
    });
  }

  removeAllocationRow(index: number): void {
    this.allocationRows.splice(index, 1);
  }

  submitAllocations(): void {
    const prop = this.activeProperty();
    const booking = this.selectedBooking();
    if (!prop || !booking) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.eventsApi
      .allocateResources(prop.id, booking.id, {
        allocations: this.allocationRows.map((a) => ({
          resourceId: a.resourceId,
          quantity: Number(a.quantity),
          notes: a.notes?.trim() || undefined,
        })),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.selectedBooking.set(res.data);
          this.showAllocateModal.set(false);
          this.successMessage.set(
            `Resources allocated to booking #${res.data.bookingNumber}!`,
          );
          this.refreshBookings();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message ||
              err.message ||
              'Failed to allocate resources to booking.',
          );
        },
      });
  }

  // -----------------------------------------------------------------
  // COMPLETE & BILL TO FOLIO
  // -----------------------------------------------------------------
  openCompleteModal(booking: EventBookingDto): void {
    this.selectedBooking.set(booking);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (booking.roomNumber) {
      this.completeSettlementType = 'ROOM_CHARGE';
      this.completePaymentMethod = 'ROOM_CHARGE';
      this.completeRoomNumber = booking.roomNumber;
    } else {
      this.completeSettlementType = 'DIRECT_PAY';
      this.completePaymentMethod = 'CREDIT_CARD';
      this.completeRoomNumber = '';
    }

    this.showCompleteModal.set(true);
  }

  submitCompleteBooking(): void {
    const prop = this.activeProperty();
    const booking = this.selectedBooking();
    if (!prop || !booking) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.eventsApi
      .completeBooking(prop.id, booking.id, {
        settlementType: this.completeSettlementType,
        paymentMethod:
          this.completeSettlementType === 'ROOM_CHARGE'
            ? 'ROOM_CHARGE'
            : this.completePaymentMethod,
        roomNumber:
          this.completeSettlementType === 'ROOM_CHARGE'
            ? this.completeRoomNumber.trim() || booking.roomNumber || undefined
            : undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.selectedBooking.set(res.data);
          this.showCompleteModal.set(false);
          this.successMessage.set(
            `Event #${res.data.bookingNumber} completed and billed successfully!`,
          );
          this.refreshBookings();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message ||
              err.message ||
              'Failed to complete and bill event booking.',
          );
        },
      });
  }

  // -----------------------------------------------------------------
  // VENUES, PACKAGES, RESOURCES MODALS
  // -----------------------------------------------------------------
  openVenueModal(): void {
    this.newVenueCode = '';
    this.newVenueName = '';
    this.newVenueType = 'BALLROOM';
    this.newVenueCapacity = 150;
    this.newVenueLocation = '';
    this.showVenueModal.set(true);
  }

  submitCreateVenue(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    if (!this.newVenueCode || !this.newVenueName) {
      this.errorMessage.set('Venue code and name are required.');
      return;
    }

    this.isSubmitting.set(true);
    this.eventsApi
      .createVenue(prop.id, {
        code: this.newVenueCode.trim().toUpperCase(),
        name: this.newVenueName.trim(),
        venueType: this.newVenueType,
        capacity: Number(this.newVenueCapacity),
        location: this.newVenueLocation.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showVenueModal.set(false);
          this.venues.update((v) => [...v, res.data]);
          this.successMessage.set(`Venue ${res.data.name} added!`);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message || err.message || 'Failed to create venue.',
          );
        },
      });
  }

  openPackageModal(): void {
    this.newPkgCode = '';
    this.newPkgName = '';
    this.newPkgDescription = '';
    this.newPkgPrice = 8000;
    this.newPkgMinGuests = 20;
    this.showPackageModal.set(true);
  }

  submitCreatePackage(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    if (!this.newPkgCode || !this.newPkgName) {
      this.errorMessage.set('Package code and name are required.');
      return;
    }

    this.isSubmitting.set(true);
    this.eventsApi
      .createPackage(prop.id, {
        code: this.newPkgCode.trim().toUpperCase(),
        name: this.newPkgName.trim(),
        description: this.newPkgDescription.trim() || undefined,
        pricePerGuest: Number(this.newPkgPrice),
        minGuests: Number(this.newPkgMinGuests),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showPackageModal.set(false);
          this.packages.update((p) => [...p, res.data]);
          this.successMessage.set(`Package ${res.data.name} created!`);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message || err.message || 'Failed to create package.',
          );
        },
      });
  }

  openResourceModal(): void {
    this.newResName = '';
    this.newResType = 'EQUIPMENT';
    this.newResQuantity = 20;
    this.showResourceModal.set(true);
  }

  submitCreateResource(): void {
    const prop = this.activeProperty();
    if (!prop) return;

    if (!this.newResName) {
      this.errorMessage.set('Resource name is required.');
      return;
    }

    this.isSubmitting.set(true);
    this.eventsApi
      .createResource(prop.id, {
        name: this.newResName.trim(),
        resourceType: this.newResType,
        totalQuantity: Number(this.newResQuantity),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showResourceModal.set(false);
          this.resources.update((r) => [...r, res.data]);
          this.successMessage.set(`Resource ${res.data.name} added!`);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err.error?.message || err.message || 'Failed to create resource.',
          );
        },
      });
  }

  // -----------------------------------------------------------------
  // FORMATTING HELPERS
  // -----------------------------------------------------------------
  formatPrice(price: string | number, currency?: string): string {
    // Currency always follows the active property context — never a hardcoded default.
    return formatMoney(Number(price) || 0, currency || this.activeProperty()?.currency || '');
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
