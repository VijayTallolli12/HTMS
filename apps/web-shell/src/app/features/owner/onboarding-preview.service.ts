import { Injectable, signal } from '@angular/core';

/**
 * OnboardingPreviewService — demo-only state for the safe onboarding preview.
 *
 * SAFETY CONTRACT (must hold):
 *  - This service performs ZERO network calls. It injects no HttpClient and
 *    no backend-backed service. It cannot touch /setup/* APIs, Prisma, or the
 *    database in any way.
 *  - State lives in browser memory ONLY (signals). No localStorage /
 *    sessionStorage writes. A page refresh resets the preview — by design.
 *  - Nothing here creates organizations, properties, users, or setup state.
 */
export type PreviewOrgType = 'INDEPENDENT' | 'CHAIN';

export interface PreviewRoomTypeRow {
  code: string;
  name: string;
  beds: string;
  bedCount: number;
  roomsCount: number;
}

export interface PreviewState {
  scenario: PreviewOrgType;
  orgType: PreviewOrgType;
  orgCode: string;
  orgName: string;
  regionName: string;
  countryName: string;
  propertyName: string;
  propertyCode: string;
  currency: string;
  timeZone: string;
  city: string;
  address: string;
  buildingName: string;
  floorCount: number;
  roomTypes: PreviewRoomTypeRow[];
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminRole: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingPreviewService {
  /** Wizard step: 0..7 (7 = complete screen). */
  readonly step = signal(0);

  /** Preview record state — plain object owned by the component via reset(). */
  readonly state = signal<PreviewState>(this.blankState());

  /** Set once "Complete Preview" is pressed. */
  readonly completed = signal(false);

  readonly totalSteps = 8; // 0 Welcome .. 6 Review .. 7 Complete

  readonly stepTitles = [
    'Welcome to the Onboarding Preview',
    'Organization Type',
    'Organization Details',
    'Property Details',
    'Property Configuration',
    'First Administrator',
    'Review',
    'Setup Preview Complete',
  ];

  readonly stepTitle = signal('');

  private blankState(): PreviewState {
    return {
      scenario: 'INDEPENDENT',
      orgType: 'INDEPENDENT',
      orgCode: '',
      orgName: '',
      regionName: '',
      countryName: '',
      propertyName: '',
      propertyCode: '',
      currency: '',
      timeZone: '',
      city: '',
      address: '',
      buildingName: '',
      floorCount: 1,
      roomTypes: [],
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminRole: '',
    };
  }

  reset(): void {
    this.state.set(this.blankState());
    this.step.set(0);
    this.completed.set(false);
  }

  goTo(step: number): void {
    this.step.set(Math.max(0, Math.min(step, this.totalSteps - 1)));
  }

  next(): void {
    this.goTo(this.step() + 1);
  }

  back(): void {
    this.goTo(this.step() - 1);
  }

  markComplete(): void {
    // Pure in-memory flag. No API call, no storage, no navigation side effects.
    this.completed.set(true);
    this.goTo(this.totalSteps - 1);
  }

  applyScenarioDefaults(scenario: PreviewOrgType): void {
    const s = this.state();
    if (scenario === 'INDEPENDENT') {
      this.state.set({
        ...s,
        scenario,
        orgType: 'INDEPENDENT',
        orgCode: s.orgCode || 'HG-AURORA',
        orgName: s.orgName || 'Aurora Hospitality',
        regionName: s.regionName || 'Emirates Region',
        countryName: s.countryName || 'United Arab Emirates',
        adminRole: 'General Manager (property-wide)',
      });
    } else {
      this.state.set({
        ...s,
        scenario,
        orgType: 'CHAIN',
        orgCode: s.orgCode || 'HG-MIRAGE',
        orgName: s.orgName || 'Mirage Hotels International',
        regionName: s.regionName || 'Middle East Region',
        countryName: s.countryName || 'United Arab Emirates',
        adminRole: 'Corporate Platform Admin (group-wide)',
      });
    }
  }

  /** Seeded sample property configuration used by the config step. */
  applySampleConfiguration(): void {
    const s = this.state();
    this.state.set({
      ...s,
      buildingName: s.buildingName || 'Main Wing',
      floorCount: s.floorCount || 5,
      roomTypes: s.roomTypes.length
        ? s.roomTypes
        : [
            { code: 'STD', name: 'Standard Room', beds: 'KING', bedCount: 1, roomsCount: 8 },
            { code: 'DLX', name: 'Deluxe Room', beds: 'KING + SOFA', bedCount: 2, roomsCount: 4 },
            { code: 'SUI', name: 'Executive Suite', beds: 'KING x2', bedCount: 2, roomsCount: 2 },
            { code: 'FAM', name: 'Family Suite', beds: 'QUEEN x2', bedCount: 2, roomsCount: 1 },
          ],
    });
  }
}
