import { Component, inject, signal, OnInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { OrganizationService } from './core/services/organization.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { ApplicationBrandingService } from './core/services/application-branding.service';
import { PropertyDto } from '@hms/api-contracts';
import { HmsSidebarComponent } from './shared/layout/hms-sidebar.component';
import { HmsBrandLogoComponent } from './shared/components/hms-brand-logo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule, HmsSidebarComponent, HmsBrandLogoComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  readonly branding = inject(ApplicationBrandingService);
  private readonly router = inject(Router);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly properties = signal<PropertyDto[]>([]);
  readonly currentUser = this.authService.currentUser;
  readonly isAuthenticated = this.authService.isAuthenticated;

  readonly isSidebarCollapsed = signal(false);
  readonly isMobileNavOpen = signal(false);
  readonly isUserMenuOpen = signal(false);

  get title(): string {
    return this.branding.applicationName();
  }

  get currentWorkspaceLabel(): string {
    const url = this.router.url || '';
    if (url.includes('/settings')) return 'Appearance & Theme Preferences';
    if (url.includes('/organization')) return 'Organization Architecture';
    if (url.includes('/health')) return 'System Status';

    // Front Office
    if (url.includes('/pms/reservations/new')) return 'New Reservation';
    if (url.match(/\/pms\/reservations\/[a-zA-Z0-9_-]+/)) return 'Reservation Details';
    if (url.includes('/pms/reservations')) return 'Reservations Registry';
    if (url.includes('/pms/front-office')) return 'Front Desk Operations';
    if (url.includes('/pms/folios')) return 'Cashiering & Folios';

    // Room Operations
    if (url.includes('/pms/room-operations')) return 'Room Operations & Tape Chart';
    if (url.includes('/pms/availability')) return 'Availability & Quoting';
    if (url.includes('/pms/room-types')) return 'Room Types & Capacity';

    // Housekeeping routes & subviews
    if (url.includes('/pms/housekeeping')) {
      if (url.includes('tab=tasks')) return 'Tasks Queue';
      if (url.includes('tab=inspections')) return 'Inspections';
      if (url.includes('tab=readiness')) return 'Room Readiness';
      return 'Housekeeping Operations';
    }

    // Engineering routes & subviews
    if (url.includes('/pms/engineering')) {
      if (url.includes('tab=work-orders')) return 'Work Orders';
      if (url.includes('tab=assets')) return 'Asset Register';
      if (url.includes('tab=schedules')) return 'PM Schedules';
      return 'Engineering Operations';
    }

    // Role-aware contextual fallback for /dashboard and general landing
    if (this.authService.isHousekeepingSupervisor()) return 'Housekeeping Operations';
    if (this.authService.isMaintenanceTech()) return 'Engineering Operations';
    if (this.authService.isFrontDeskAgent()) return 'Front Desk Operations';
    return 'Executive Dashboard';
  }

  get currentWorkspaceCategory(): string {
    const url = this.router.url || '';
    if (url.includes('/settings')) return 'SYSTEM PREFERENCES';
    if (url.includes('/organization')) return 'ADMINISTRATION';
    if (url.includes('/health')) return 'SYSTEM STATUS';

    // Front Office
    if (url.includes('/pms/reservations') || url.includes('/pms/front-office')) return 'FRONT OFFICE';
    if (url.includes('/pms/folios')) return 'FINANCE & CASHIERING';

    // Room Operations
    if (url.includes('/pms/room-operations') || url.includes('/pms/availability') || url.includes('/pms/room-types')) {
      return 'ROOM OPERATIONS';
    }

    // Housekeeping
    if (url.includes('/pms/housekeeping')) return 'HOUSEKEEPING';

    // Engineering
    if (url.includes('/pms/engineering')) return 'MAINTENANCE';

    // Role-aware contextual fallback for /dashboard and general landing
    if (this.authService.isHousekeepingSupervisor()) return 'HOUSEKEEPING';
    if (this.authService.isMaintenanceTech()) return 'MAINTENANCE';
    if (this.authService.isFrontDeskAgent()) return 'FRONT OFFICE';
    return 'OVERVIEW';
  }

  private propertiesLoaded = false;

  constructor() {
    effect(
      () => {
        if (this.isAuthenticated() && !this.propertiesLoaded) {
          this.loadProperties();
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // Validate session via /auth/me
    this.authService.validateSession().subscribe(() => {
      if (!this.propertiesLoaded) {
        this.loadProperties();
      }
    });

    // Close overlays on route changes
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isMobileNavOpen.set(false);
        this.isUserMenuOpen.set(false);
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.isUserMenuOpen.set(false);
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.isMobileNavOpen.set(false);
    this.isUserMenuOpen.set(false);
  }

  toggleSidebar(): void {
    // On desktop, toggle collapse; on mobile (<1024px), toggle drawer
    if (window.innerWidth <= 1024) {
      this.isMobileNavOpen.update((v) => !v);
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileNav(): void {
    this.isMobileNavOpen.set(false);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  get userDisplayName(): string {
    const u = this.currentUser();
    if (!u) return 'Staff User';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
  }

  get userInitials(): string {
    const u = this.currentUser();
    if (!u) return 'HU';
    const first = (u.firstName || u.email || 'A')[0].toUpperCase();
    const last = (u.lastName || 'A')[0].toUpperCase();
    return `${first}${last}`;
  }

  get primaryRole(): string {
    const roles = this.authService.roles();
    return roles.length > 0 ? (roles[0].name || roles[0].code) : (this.currentUser()?.role || 'Staff');
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  private loadProperties(): void {
    this.propertiesLoaded = true;
    this.orgService.loadInitialProperty();

    this.orgService.getProperties().subscribe({
      next: (res) => {
        const list = res.data || [];
        this.properties.set(list);
        if (!this.activeProperty() && list.length > 0) {
          this.orgService.setActiveProperty(list[0]);
        }
      },
      error: () => {},
    });
  }

  onPropertyChange(propertyId: string): void {
    const selected = this.properties().find((p) => p.id === propertyId);
    if (selected) {
      this.orgService.setActiveProperty(selected);
    }
  }

  onLogout(): void {
    this.propertiesLoaded = false;
    this.isMobileNavOpen.set(false);
    this.isUserMenuOpen.set(false);
    this.authService.logout();
    this.orgService.setActiveProperty(null);
    this.router.navigate(['/login']);
  }
}
