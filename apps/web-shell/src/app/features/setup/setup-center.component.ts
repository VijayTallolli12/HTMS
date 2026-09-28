import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SetupStatusDto, SetupDemoOperationResponse } from '@hms/api-contracts';
import { SetupService } from '../../core/services/setup.service';

interface SetupArea {
  key: string;
  title: string;
  description: string;
  done: boolean;
  countLabel: string;
  ctaLabel: string;
  route: string;
}

@Component({
  selector: 'app-setup-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './setup-center.component.html',
  styleUrls: ['./setup-center.component.css'],
})
export class SetupCenterComponent implements OnInit {
  private readonly setupService = inject(SetupService);
  private readonly router = inject(Router);

  readonly status = signal<SetupStatusDto | null>(null);
  readonly isLoading = signal(true);
  readonly demoBusy = signal<string | null>(null);
  readonly demoMessage = signal<string | null>(null);

  readonly progressPercent = computed(() => this.status()?.progress ?? 0);

  readonly areas = computed<SetupArea[]>(() => {
    const s = this.status();
    const counts = s?.counts;
    return [
      {
        key: 'property',
        title: 'Property',
        description: 'Core profile, time zone, and currency of your hotel.',
        done: (counts?.properties ?? 0) > 0,
        countLabel: counts?.properties ? '1 property configured' : 'Not configured',
        ctaLabel: counts?.properties ? 'View' : 'Configure',
        route: '/organization',
      },
      {
        key: 'roomTypes',
        title: 'Room Types',
        description: 'Categories of accommodation (Standard, Deluxe, Suite…).',
        done: (counts?.roomTypes ?? 0) > 0,
        countLabel: `${counts?.roomTypes ?? 0} configured`,
        ctaLabel: (counts?.roomTypes ?? 0) > 0 ? 'Manage' : 'Create room type',
        route: '/pms/room-types',
      },
      {
        key: 'rooms',
        title: 'Rooms',
        description: 'Physical rooms mapped to buildings, floors, and room types.',
        done: (counts?.rooms ?? 0) > 0,
        countLabel: `${counts?.rooms ?? 0} configured`,
        ctaLabel: (counts?.rooms ?? 0) > 0 ? 'Manage' : 'Configure rooms',
        route: '/pms/room-operations',
      },
      {
        key: 'ratePlans',
        title: 'Rate Plans',
        description: 'Pricing plans per room type with daily rate calendar.',
        done: (counts?.ratePlans ?? 0) > 0,
        countLabel: `${counts?.ratePlans ?? 0} configured`,
        ctaLabel: (counts?.ratePlans ?? 0) > 0 ? 'Manage' : 'Create rate plan',
        route: '/pms/revenue',
      },
      {
        key: 'users',
        title: 'Users & Roles',
        description: 'Staff accounts and their scoped role assignments.',
        done: (counts?.users ?? 0) > 1,
        countLabel: `${counts?.users ?? 1} user${(counts?.users ?? 1) === 1 ? '' : 's'}`,
        ctaLabel: 'Coming in W3',
        route: '/setup-center',
      },
    ];
  });

  // Phase 12: Distribution / OTA readiness surface. Readiness only — no
  // claim of external connectivity; live integrations are post-W2.
  readonly distributionChannels = [
    { name: 'Booking.com', status: 'Not Connected', note: 'Ready to connect via channel manager' },
    { name: 'Airbnb', status: 'Not Connected', note: 'Ready to connect via channel manager' },
    { name: 'Expedia', status: 'Not Connected', note: 'Ready to connect via channel manager' },
    { name: 'Channel Manager', status: 'Not Configured', note: 'Configure provider credentials' },
  ];

  readonly milestonesList = computed(() => {
    const milestones = this.status()?.milestones ?? [];
    const all = [
      { key: 'ADMIN_CREATED', label: 'First administrator created' },
      { key: 'PROPERTY_CREATED', label: 'Property created' },
      { key: 'ROOM_TYPES_CONFIGURED', label: 'Room types configured' },
      { key: 'ROOMS_CONFIGURED', label: 'Rooms configured' },
      { key: 'RATES_CONFIGURED', label: 'Rates configured' },
      { key: 'USERS_CONFIGURED', label: 'Users configured' },
      { key: 'COMPLETED', label: 'Setup completed' },
    ];
    return all.map((m) => ({ ...m, done: milestones.includes(m.key) }));
  });

  ngOnInit(): void {
    this.setupService.refreshStatus().subscribe((status) => {
      this.status.set(status);
      this.isLoading.set(false);
    });
  }

  openRoute(route: string): void {
    if (route.startsWith('http')) {
      return;
    }
    this.router.navigate([route]);
  }

  runDemo(operation: 'load' | 'reset' | 'remove'): void {
    if (this.demoBusy()) return;
    this.demoBusy.set(operation);
    this.demoMessage.set(null);

    const request$ =
      operation === 'load'
        ? this.setupService.demoLoad()
        : operation === 'reset'
          ? this.setupService.demoReset()
          : this.setupService.demoRemove();

    request$.subscribe({
      next: (res: SetupDemoOperationResponse) => {
        this.demoMessage.set(
          `Demo ${res.operation.toLowerCase()} completed in ${(res.durationMs / 1000).toFixed(1)}s.`,
        );
        this.demoBusy.set(null);
        this.setupService.refreshStatus().subscribe((s) => this.status.set(s));
      },
      error: (err) => {
        this.demoMessage.set(err?.error?.message || `Demo ${operation} failed.`);
        this.demoBusy.set(null);
      },
    });
  }
}
