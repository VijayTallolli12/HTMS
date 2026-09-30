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
  SpaServiceDetailDto,
  SpaServicePriceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaAppointmentDto,
  SpaAppointmentStatus,
  SpaSettlementType,
  SpaPaymentMethod,
  SpaServiceCategoryDto,
  SpaServiceAddonDto,
  SpaServiceAvailability,
  CreateSpaServiceDto,
  UpdateSpaServiceDto,
  CreateSpaTherapistDto,
  UpdateSpaTherapistDto,
  CreateSpaRoomDto,
  UpdateSpaRoomDto,
  CreateSpaAppointmentDto,
  UpdateSpaAppointmentStatusDto,
  CompleteSpaAppointmentDto,
  QuerySpaAppointmentsDto,
  CreateSpaServiceCategoryDto,
  UpdateSpaServiceCategoryDto,
  CreateSpaServiceAddonDto,
  UpdateSpaServiceAddonDto,
  UpdateSpaServicePriceDto,
  UpdateSpaServiceAvailabilityDto,
  QuerySpaServicesDto,
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

type ActiveSpaTab = 'appointments' | 'services' | 'pricing' | 'team';

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
  categories = signal<SpaServiceCategoryDto[]>([]);
  therapists = signal<SpaTherapistDto[]>([]);
  rooms = signal<SpaRoomDto[]>([]);
  appointments = signal<SpaAppointmentDto[]>([]);
  inHouseGuests = signal<InHouseGuestOption[]>([]);

  // Service Filters
  serviceCategoryFilter = signal<string>('');
  serviceAvailabilityFilter = signal<string>('');
  serviceActiveFilter = signal<string>('');
  serviceSearch = signal<string>('');

  // Filtered Services
  filteredServices = computed(() => {
    let list = this.services();
    const cat = this.serviceCategoryFilter();
    const avail = this.serviceAvailabilityFilter();
    const active = this.serviceActiveFilter();
    const search = this.serviceSearch().toLowerCase();

    if (cat) list = list.filter((s) => s.categoryId === cat);
    if (avail) list = list.filter((s) => s.availability === avail);
    if (active) list = list.filter((s) => s.isActive === (active === 'true'));
    if (search) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search),
      );
    }
    return list;
  });

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
  showServiceModal = signal<boolean>(false);
  showCategoryModal = signal<boolean>(false);

  // W4: Team & Rooms CRUD
  showTherapistModal = signal<boolean>(false);
  therapistForm: { name?: string; specialty?: string; phone?: string; email?: string } = {};
  showSpaRoomModal = signal<boolean>(false);
  spaRoomForm: { name?: string; roomType?: string } = {};

  // W4: Addon management (per service, inside the service editor)
  serviceAddons = signal<SpaServiceAddonDto[]>([]);
  addonDraft: { code?: string; name?: string; priceAdjustment?: number } = {};

  // Service Modal State
  editingService: SpaServiceDto | null = null;
  serviceForm: Partial<CreateSpaServiceDto> = {};
  serviceFormErrors: Record<string, string> = {};

  // Category Modal State
  editingCategory: SpaServiceCategoryDto | null = null;
  categoryForm: Partial<CreateSpaServiceCategoryDto> = {};
  categoryFormErrors: Record<string, string> = {};

  // Price Edit Modal State
  editingPriceService: SpaServiceDto | null = null;
  priceEditValue: string | number = '';
  priceEditError: string = '';

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
  completeSettlementType = SpaSettlementType.ROOM_CHARGE;
  completePaymentMethod = SpaPaymentMethod.ROOM_CHARGE;
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
  /** Narrow reloaders assigned in loadAllSpaData (W4 CRUD callbacks). */
  loadTeam: (propertyId: string) => void = () => {};
  loadRooms: (propertyId: string) => void = () => {};

  loadAllSpaData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.spaApi.getCategories(propertyId).subscribe({
      next: (res) => this.categories.set(res.data || []),
    });

    this.spaApi.getServices(propertyId).subscribe({
      next: (res) => this.services.set(res.data || []),
    });

    this.spaApi.getTherapists(propertyId).subscribe({
      next: (res) => this.therapists.set(res.data || []),
    });

    this.spaApi.getRooms(propertyId).subscribe({
      next: (res) => this.rooms.set(res.data || []),
    });

    // Expose narrow reload helpers used by the W4 CRUD modals.
    this.loadTeam = (pid: string) => this.spaApi.getTherapists(pid).subscribe({ next: (res) => this.therapists.set(res.data || []) });
    this.loadRooms = (pid: string) => this.spaApi.getRooms(pid).subscribe({ next: (res) => this.rooms.set(res.data || []) });

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
  // Service Filters
  // -------------------------------------------------------------
  onServiceFilterChange(): void {
    // Filters are reactive via computed
  }

  clearServiceFilters(): void {
    this.serviceCategoryFilter.set('');
    this.serviceAvailabilityFilter.set('');
    this.serviceActiveFilter.set('');
    this.serviceSearch.set('');
  }

  // -------------------------------------------------------------
  // Category Management
  // -------------------------------------------------------------
  openCategoryModal(category?: SpaServiceCategoryDto): void {
    if (category) {
      this.editingCategory = category;
      this.categoryForm = {
        code: category.code,
        name: category.name,
        description: category.description || '',
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      };
    } else {
      this.editingCategory = null;
      this.categoryForm = {
        code: '',
        name: '',
        description: '',
        displayOrder: 0,
        isActive: true,
      };
    }
    this.categoryFormErrors = {};
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
    this.editingCategory = null;
    this.categoryForm = {};
  }

  validateCategoryForm(): boolean {
    const errors: Record<string, string> = {};
    if (!this.categoryForm.code?.trim()) errors.code = 'Code is required';
    if (!this.categoryForm.name?.trim()) errors.name = 'Name is required';
    this.categoryFormErrors = errors;
    return Object.keys(errors).length === 0;
  }

  confirmCategory(): void {
    if (!this.validateCategoryForm()) return;

    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CreateSpaServiceCategoryDto = {
      code: this.categoryForm.code!.trim().toUpperCase(),
      name: this.categoryForm.name!.trim(),
      description: this.categoryForm.description?.trim(),
      displayOrder: this.categoryForm.displayOrder || 0,
      isActive: this.categoryForm.isActive !== undefined ? this.categoryForm.isActive : true,
    };

    const request = this.editingCategory
      ? this.spaApi.updateCategory(prop.id, this.editingCategory.id, dto)
      : this.spaApi.createCategory(prop.id, dto);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showCategoryModal.set(false);
        this.successMessage.set(
          this.editingCategory
            ? `Category "${this.editingCategory.name}" updated successfully.`
            : `Category "${dto.name}" created successfully.`,
        );
        this.loadAllSpaData(prop.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to save category');
      },
    });
  }

  // -------------------------------------------------------------
  // Service Management
  // -------------------------------------------------------------
  openServiceModal(service?: SpaServiceDto): void {
    this.serviceAddons.set([]);
    this.addonDraft = {};
    if (service) {
      this.editingService = service;
      this.loadServiceAddons(service.id);
      this.serviceForm = {
        categoryId: service.categoryId ?? undefined,
        code: service.code,
        name: service.name,
        description: service.description ?? undefined,
        durationMinutes: service.durationMinutes,
        price: service.price,
        currency: service.currency,
        isActive: service.isActive,
        availability: service.availability,
        eligibleTherapistIds: service.eligibleTherapistIds ?? undefined,
        eligibleRoomTypes: service.eligibleRoomTypes ?? undefined,
      };
    } else {
      this.editingService = null;
      this.serviceForm = {
        categoryId: undefined,
        code: '',
        name: '',
        description: undefined,
        durationMinutes: 60,
        price: '0',
        currency: 'JPY',
        isActive: true,
        availability: SpaServiceAvailability.AVAILABLE,
        eligibleTherapistIds: undefined,
        eligibleRoomTypes: undefined,
      };
    }
    this.serviceFormErrors = {};
    this.showServiceModal.set(true);
  }

  closeServiceModal(): void {
    this.showServiceModal.set(false);
    this.editingService = null;
    this.serviceForm = {};
    this.serviceAddons.set([]);
    this.addonDraft = {};
  }

  // ================================================================
  // W4: Therapist & Treatment Room CRUD
  // ================================================================
  openTherapistModal(): void {
    this.therapistForm = {};
    this.showTherapistModal.set(true);
  }

  saveTherapist(): void {
    const prop = this.activeProperty();
    if (!prop || !this.therapistForm.name?.trim()) return;
    this.isSubmitting.set(true);
    this.spaApi.createTherapist(prop.id, { name: this.therapistForm.name, specialty: this.therapistForm.specialty, phone: this.therapistForm.phone, email: this.therapistForm.email } as CreateSpaTherapistDto).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showTherapistModal.set(false);
        this.therapistForm = {};
        this.successMessage.set('Therapist added');
        this.loadTeam(prop.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to add therapist');
      },
    });
  }

  openSpaRoomModal(): void {
    this.spaRoomForm = {};
    this.showSpaRoomModal.set(true);
  }

  saveSpaRoom(): void {
    const prop = this.activeProperty();
    if (!prop || !this.spaRoomForm.name?.trim()) return;
    this.isSubmitting.set(true);
    this.spaApi.createRoom(prop.id, { name: this.spaRoomForm.name, roomType: this.spaRoomForm.roomType as never } as CreateSpaRoomDto).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showSpaRoomModal.set(false);
        this.spaRoomForm = {};
        this.successMessage.set('Treatment room added');
        this.loadRooms(prop.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to add treatment room');
      },
    });
  }

  // ================================================================
  // W4: Service addons management (loaded when editing a service)
  // ================================================================
  loadServiceAddons(serviceId: string): void {
    const prop = this.activeProperty();
    if (!prop) return;
    this.spaApi.getAddons(prop.id, serviceId).subscribe({
      next: (res) => this.serviceAddons.set(res.data || []),
      error: () => this.serviceAddons.set([]),
    });
  }

  addServiceAddon(): void {
    const prop = this.activeProperty();
    const service = this.editingService;
    if (!prop || !service || !this.addonDraft.name?.trim()) return;
    this.spaApi.createAddon(prop.id, service.id, {
      serviceId: service.id,
      code: this.addonDraft.code || `ADD-${Date.now()}`,
      name: this.addonDraft.name,
      priceAdjustment: this.addonDraft.priceAdjustment ?? 0,
      currency: prop.currency,
    } as CreateSpaServiceAddonDto).subscribe({
      next: () => {
        this.addonDraft = {};
        this.successMessage.set('Add-on added');
        this.loadServiceAddons(service.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to add add-on'),
    });
  }

  removeServiceAddon(addonId: string): void {
    const prop = this.activeProperty();
    const service = this.editingService;
    if (!prop || !service) return;
    this.spaApi.deleteAddon(prop.id, service.id, addonId).subscribe({
      next: () => {
        this.successMessage.set('Add-on removed');
        this.loadServiceAddons(service.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to remove add-on'),
    });
  }

  validateServiceForm(): boolean {
    const errors: Record<string, string> = {};
    if (!this.serviceForm.code?.trim()) errors.code = 'Code is required';
    if (!this.serviceForm.name?.trim()) errors.name = 'Name is required';
    if (!this.serviceForm.durationMinutes || this.serviceForm.durationMinutes < 15) {
      errors.durationMinutes = 'Duration must be at least 15 minutes';
    }
    if (!this.serviceForm.price || Number(this.serviceForm.price) <= 0) {
      errors.price = 'Price must be positive';
    }
    this.serviceFormErrors = errors;
    return Object.keys(errors).length === 0;
  }

  confirmService(): void {
    if (!this.validateServiceForm()) return;

    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CreateSpaServiceDto = {
      categoryId: this.serviceForm.categoryId || undefined,
      code: this.serviceForm.code!.trim().toUpperCase(),
      name: this.serviceForm.name!.trim(),
      description: this.serviceForm.description?.trim(),
      durationMinutes: this.serviceForm.durationMinutes || 60,
      price: this.serviceForm.price!.toString(),
      currency: this.serviceForm.currency || 'JPY',
      isActive: this.serviceForm.isActive !== undefined ? this.serviceForm.isActive : true,
      availability: this.serviceForm.availability as SpaServiceAvailability || 'AVAILABLE',
      eligibleTherapistIds: this.serviceForm.eligibleTherapistIds,
      eligibleRoomTypes: this.serviceForm.eligibleRoomTypes,
    };

    const request = this.editingService
      ? this.spaApi.updateService(prop.id, this.editingService.id, dto)
      : this.spaApi.createService(prop.id, dto);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showServiceModal.set(false);
        this.successMessage.set(
          this.editingService
            ? `Service "${this.editingService.name}" updated successfully.`
            : `Service "${dto.name}" created successfully.`,
        );
        this.loadAllSpaData(prop.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to save service');
      },
    });
  }

  toggleServiceAvailability(service: SpaServiceDto): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    const newAvailability: SpaServiceAvailability =
      service.availability === SpaServiceAvailability.AVAILABLE
        ? SpaServiceAvailability.UNAVAILABLE
        : SpaServiceAvailability.AVAILABLE;

    this.isSubmitting.set(true);
    this.spaApi
      .updateServiceAvailability(prop.id, service.id, { availability: newAvailability })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.successMessage.set(
            `Service "${service.name}" is now ${newAvailability.toLowerCase()}.`,
          );
          this.loadAllSpaData(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to update availability');
        },
      });
  }

  // -------------------------------------------------------------
  // Price Edit Modal
  // -------------------------------------------------------------
  openPriceModal(service: SpaServiceDto): void {
    this.editingPriceService = service;
    this.priceEditValue = service.price;
    this.priceEditError = '';
  }

  closePriceModal(): void {
    this.editingPriceService = null;
    this.priceEditValue = '';
    this.priceEditError = '';
  }

  validatePriceEdit(): boolean {
    const value = Number(this.priceEditValue);
    if (!this.priceEditValue || value <= 0) {
      this.priceEditError = 'Price must be a positive number';
      return false;
    }
    this.priceEditError = '';
    return true;
  }

  confirmPriceEdit(): void {
    if (!this.validatePriceEdit()) return;

    const prop = this.activeProperty();
    const service = this.editingPriceService;
    if (!prop?.id || !service) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.spaApi
      .updateServicePrice(prop.id, service.id, { price: this.priceEditValue })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closePriceModal();
          this.successMessage.set(
            `Price for "${service.name}" updated to ${this.formatPrice(this.priceEditValue, service.currency)}.`,
          );
          this.loadAllSpaData(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to update price');
        },
      });
  }

  // -------------------------------------------------------------
  // Booking Appointment
  // -------------------------------------------------------------
  openBookModal(): void {
    const sList = this.services().filter((s) => s.isActive && s.availability === SpaServiceAvailability.AVAILABLE);
    const tList = this.therapists().filter((t) => t.isActive);
    const rList = this.rooms().filter((r) => r.status === 'AVAILABLE');

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
    this.completeSettlementType = appt.roomNumber ? SpaSettlementType.ROOM_CHARGE : SpaSettlementType.DIRECT_PAY;
    this.completePaymentMethod = appt.roomNumber ? SpaPaymentMethod.ROOM_CHARGE : SpaPaymentMethod.CREDIT_CARD;
    this.completeManualRoomNumber = appt.roomNumber || '';
    this.completeSelectedGuestResId = appt.reservationId || '';

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

    if (this.completeSettlementType === SpaSettlementType.ROOM_CHARGE) {
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
          this.completeSettlementType === SpaSettlementType.ROOM_CHARGE
            ? SpaPaymentMethod.ROOM_CHARGE
            : this.completePaymentMethod,
        roomNumber,
        reservationId,
        folioId,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCompleteModal.set(false);

          if (res.data.settlementType === SpaSettlementType.ROOM_CHARGE) {
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

  getAvailabilityPillVariant(
    availability: SpaServiceAvailability,
  ): 'success' | 'danger' | 'default' {
    switch (availability) {
      case 'AVAILABLE':
        return 'success';
      case 'UNAVAILABLE':
        return 'danger';
      default:
        return 'default';
    }
  }

  formatPrice(price: string | number, currency?: string): string {
    // Currency always follows the active property context — never a hardcoded default.
    return formatMoney(Number(price) || 0, currency || this.activeProperty()?.currency || '');
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

  getCategoryName(categoryId?: string | null): string {
    if (!categoryId) return 'Uncategorized';
    const cat = this.categories().find((c) => c.id === categoryId);
    return cat?.name || 'Unknown';
  }
}