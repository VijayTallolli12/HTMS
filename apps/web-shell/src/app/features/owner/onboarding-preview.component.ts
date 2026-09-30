import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OnboardingPreviewService, PreviewOrgType, PreviewRoomTypeRow } from './onboarding-preview.service';

const COMMON_TIMEZONES = [
  'Asia/Tokyo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Europe/Istanbul',
  'America/New_York',
  'Australia/Sydney',
];

@Component({
  selector: 'app-onboarding-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './onboarding-preview.component.html',
  styleUrls: ['./onboarding-preview.component.css'],
})
export class OnboardingPreviewComponent {
  readonly preview = inject(OnboardingPreviewService);
  private readonly router = inject(Router);

  readonly timezones = COMMON_TIMEZONES;

  readonly countries = [
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'QA', name: 'Qatar' },
    { code: 'JP', name: 'Japan' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'SG', name: 'Singapore' },
  ];

  readonly currencies = ['AED', 'SAR', 'QAR', 'JPY', 'USD', 'EUR', 'GBP'];

  readonly step = computed(() => this.preview.step());
  readonly progressPercent = computed(() =>
    Math.round(((this.step() + 1) / this.preview.totalSteps) * 100),
  );
  readonly stepTitle = computed(() => this.preview.stepTitles[this.step()] ?? '');
  readonly stepDisplay = computed(() => Math.min(this.step() + 1, 7));

  /** Aggregated room count for the review screen. */
  readonly totalRooms = computed(() =>
    this.preview.state().roomTypes.reduce((acc, rt) => acc + (Number(rt.roomsCount) || 0), 0),
  );

  readonly roomTypeRows = computed(() => this.preview.state().roomTypes);

  constructor() {
    this.preview.reset();
  }

  chooseScenario(scenario: PreviewOrgType): void {
    this.preview.applyScenarioDefaults(scenario);
    this.preview.next();
  }

  addRoomType(): void {
    const s = this.preview.state();
    this.preview.state.set({
      ...s,
      roomTypes: [
        ...s.roomTypes,
        { code: '', name: '', beds: 'KING', bedCount: 1, roomsCount: 0 },
      ],
    });
  }

  updateRoomType(index: number, patch: Partial<PreviewRoomTypeRow>): void {
    const s = this.preview.state();
    const rows = s.roomTypes.map((rt, i) => (i === index ? { ...rt, ...patch } : rt));
    this.preview.state.set({ ...s, roomTypes: rows });
  }

  removeRoomType(index: number): void {
    const s = this.preview.state();
    this.preview.state.set({ ...s, roomTypes: s.roomTypes.filter((_, i) => i !== index) });
  }

  loadSampleConfiguration(): void {
    this.preview.applySampleConfiguration();
  }

  canContinue(): boolean {
    const step = this.step();
    const s = this.preview.state();
    if (step === 2) {
      return !!(s.orgCode.trim() && s.orgName.trim() && s.regionName.trim() && s.countryName.trim());
    }
    if (step === 3) {
      return !!(s.propertyCode.trim() && s.propertyName.trim());
    }
    if (step === 4) {
      return !!(s.currency.trim() && s.timeZone.trim() && s.buildingName.trim() && s.floorCount > 0);
    }
    if (step === 5) {
      return !!(s.adminFirstName.trim() && s.adminLastName.trim() && s.adminEmail.trim());
    }
    return true;
  }

  continueWizard(): void {
    if (!this.canContinue()) return;
    this.preview.next();
  }

  backWizard(): void {
    this.preview.back();
  }

  completePreview(): void {
    // Memory-only. The ONLY thing this does is set completed() and go to step 7.
    this.preview.markComplete();
  }

  restartPreview(): void {
    this.preview.reset();
  }

  returnToHms(): void {
    this.router.navigate(['/dashboard']);
  }
}
