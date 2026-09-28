import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  SetupStatusDto,
  SetupOrganizationRequest,
  SetupPropertyRequest,
  BootstrapAdminRequest,
} from '@hms/api-contracts';
import { SetupService } from '../../core/services/setup.service';
import { OrganizationService } from '../../core/services/organization.service';

interface OrganizationForm {
  type: 'INDEPENDENT' | 'CHAIN';
  code: string;
  name: string;
  description: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
}

interface PropertyForm {
  code: string;
  name: string;
  timeZone: string;
  currency: string;
  legalName: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  phone: string;
  email: string;
}

interface AdminForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const COMMON_TIMEZONES = [
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
];

@Component({
  selector: 'app-setup-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './setup-wizard.component.html',
  styleUrls: ['./setup-wizard.component.css'],
})
export class SetupWizardComponent implements OnInit {
  private readonly setupService = inject(SetupService);
  private readonly orgService = inject(OrganizationService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly step = signal(0); // 0=Welcome .. 7=Review, 8=Complete
  readonly status = signal<SetupStatusDto | null>(null);

  readonly organization: OrganizationForm = {
    type: 'INDEPENDENT',
    code: '',
    name: '',
    description: '',
    regionCode: '',
    regionName: '',
    countryCode: 'JP',
    countryName: '',
  };

  readonly property: PropertyForm = {
    code: '',
    name: '',
    timeZone: 'Asia/Tokyo',
    currency: 'JPY',
    legalName: '',
    addressLine1: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    phone: '',
    email: '',
  };

  readonly admin: AdminForm = {
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  };

  readonly timezones = COMMON_TIMEZONES;
  readonly minPasswordLength = 12;

  readonly stepTitles = [
    'Welcome to Enterprise HMS',
    'Organization Type',
    'Organization Details',
    'Property Details',
    'Property Configuration',
    'Create First Administrator',
    'Review & Confirm',
  ];

  readonly totalSteps = 8; // incl. Complete screen

  readonly stepTitle = computed(() => this.stepTitles[this.step()] ?? '');
  readonly progressPercent = computed(() => Math.round(((this.step() + 1) / this.totalSteps) * 100));
  readonly stepDisplay = computed(() => Math.min(this.step() + 1, 7));

  readonly countries = [
    { code: 'JP', name: 'Japan' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SG', name: 'Singapore' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'AU', name: 'Australia' },
  ];

  ngOnInit(): void {
    this.setupService.refreshStatus().subscribe((status) => {
      this.status.set(status);
      if (status && status.state === 'ACTIVE') {
        this.router.navigate(['/setup-center']);
      }
    });
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  next(): void {
    const s = this.step();
    if (s === 2 && !this.validateOrganization()) return;
    if (s === 3 && !this.validatePropertyIdentity()) return;
    if (s === 4 && !this.validatePropertyConfig()) return;
    if (s === 5 && !this.validateAdmin()) return;
    this.step.set(Math.min(s + 1, 7));
  }

  back(): void {
    this.step.set(Math.max(this.step() - 1, 0));
  }

  goTo(step: number): void {
    this.step.set(step);
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  validateOrganization(): boolean {
    const o = this.organization;
    if (!o.code.trim() || !o.name.trim()) {
      this.error.set('Organization code and name are required.');
      return false;
    }
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(o.code.trim())) {
      this.error.set('Code may contain only letters, numbers, hyphens, underscores (2-32 chars).');
      return false;
    }
    if (!/^[A-Za-z]{2}$/.test(o.countryCode.trim())) {
      this.error.set('Country code must be a 2-letter ISO 3166-1 code.');
      return false;
    }
    this.error.set(null);
    return true;
  }

  validatePropertyIdentity(): boolean {
    const p = this.property;
    if (!p.code.trim() || !p.name.trim()) {
      this.error.set('Property code and name are required.');
      return false;
    }
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(p.code.trim())) {
      this.error.set('Property code may contain only letters, numbers, hyphens, underscores.');
      return false;
    }
    this.error.set(null);
    return true;
  }

  validatePropertyConfig(): boolean {
    const p = this.property;
    if (!p.timeZone.trim()) {
      this.error.set('Time zone is required.');
      return false;
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: p.timeZone.trim() });
    } catch {
      this.error.set('Time zone must be a valid IANA identifier (e.g. Asia/Tokyo).');
      return false;
    }
    if (!/^[A-Za-z]{3}$/.test(p.currency.trim())) {
      this.error.set('Currency must be a 3-letter ISO 4217 code.');
      return false;
    }
    this.error.set(null);
    return true;
  }

  validateAdmin(): boolean {
    const a = this.admin;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
      this.error.set('A valid email address is required.');
      return false;
    }
    if (a.password.length < this.minPasswordLength) {
      this.error.set(`Password must be at least ${this.minPasswordLength} characters.`);
      return false;
    }
    if (a.password !== a.confirmPassword) {
      this.error.set('Passwords do not match.');
      return false;
    }
    if (!a.firstName.trim() || !a.lastName.trim()) {
      this.error.set('First and last name are required.');
      return false;
    }
    this.error.set(null);
    return true;
  }

  // ===========================================================================
  // Submission
  // ===========================================================================

  async onConfirm(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // 1. Organization (idempotent by code). Response supplies countryId for
      //    the property step.
      const orgResult = await firstValueFrom(
        this.setupService.setupOrganization(this.toOrgRequest()),
      );
      this.wizardCountryId = orgResult.countryId;

      // 2. Property (idempotent by code; MAIN building + ground floor auto-created).
      await firstValueFrom(this.setupService.setupProperty(this.toPropertyRequest()));

      // 3. First administrator (virgin-window guarded; may be an idempotent replay).
      await firstValueFrom(this.setupService.bootstrapAdmin(this.toAdminRequest()));

      // 4. Auto sign-in so POST /setup/complete can authenticate.
      const signedIn = await firstValueFrom(
        this.setupService.autoSignIn(this.admin.email.trim(), this.admin.password),
      );

      if (!signedIn) {
        throw new Error(
          'Setup data was created but automatic sign-in failed. Sign in manually to finish.',
        );
      }

      // 5. Complete setup (authenticated).
      const completion = await firstValueFrom(this.setupService.completeSetup());
      const refreshed = await firstValueFrom(this.setupService.refreshStatus());
      this.status.set(
        refreshed ?? {
          ...completion,
          bootstrapEligible: false,
          hotelGroupId: null,
          propertyId: null,
          derived: false,
          counts: { properties: 1, roomTypes: 0, rooms: 0, ratePlans: 0, users: 1 },
        },
      );

      // Hydrate active property context so the shell renders correctly.
      this.orgService.loadInitialProperty();
      this.step.set(7);
    } catch (err: any) {
      this.error.set(
        err?.error?.message || err?.message || 'Setup failed. The wizard is retry-safe — try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onFinish(): void {
    this.setupService.clearWizard();
    this.router.navigate(['/setup-center']);
  }

  onGoToDashboard(): void {
    this.setupService.clearWizard();
    this.router.navigate(['/dashboard']);
  }

  // ===========================================================================
  // Mappers
  // ===========================================================================

  private toOrgRequest(): SetupOrganizationRequest {
    const o = this.organization;
    return {
      type: o.type,
      code: o.code.trim(),
      name: o.name.trim(),
      description: o.description.trim() || undefined,
      regionCode: (o.regionCode.trim() || 'DEFAULT').toUpperCase(),
      regionName: o.regionName.trim() || undefined,
      countryCode: o.countryCode.trim().toUpperCase(),
      countryName: o.countryName.trim() || undefined,
    };
  }

  private toPropertyRequest(): SetupPropertyRequest {
    const p = this.property;
    return {
      countryId: this.wizardCountryId,
      code: p.code.trim(),
      name: p.name.trim(),
      timeZone: p.timeZone.trim(),
      currency: p.currency.trim().toUpperCase(),
      legalName: p.legalName.trim() || undefined,
      addressLine1: p.addressLine1.trim() || undefined,
      city: p.city.trim() || undefined,
      stateProvince: p.stateProvince.trim() || undefined,
      postalCode: p.postalCode.trim() || undefined,
      phone: p.phone.trim() || undefined,
      email: p.email.trim() || undefined,
    };
  }

  private toAdminRequest(): BootstrapAdminRequest {
    const a = this.admin;
    return {
      email: a.email.trim(),
      password: a.password,
      firstName: a.firstName.trim(),
      lastName: a.lastName.trim(),
      phone: a.phone.trim() || undefined,
      organizationType: this.organization.type,
    };
  }

  /** The organization step response supplies countryId; carried in-memory. */
  private wizardCountryId = '';
}
