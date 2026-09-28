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
import { HmsPropertySelectorComponent } from './shared/components/hms-property-selector.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    FormsModule,
    HmsSidebarComponent,
    HmsBrandLogoComponent,
    HmsPropertySelectorComponent,
  ],
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
    // /setup is exempt: setupWizardGuard admits unauthenticated visitors only
    // while the database is virgin (first-run). Forcing /login here would make
    // the wizard unreachable on a fresh database. location.pathname (not
    // router.url) is used because router.url is still '/' during bootstrap.
    if (!this.isAuthenticated() && !location.pathname.startsWith('/setup')) {
      this.router.navigate(['/login']);
      return;
    }

    // Validate session via /auth/me. Properties load only when actually
    // authenticated: firing an unauthenticated /organization/properties call
    // 401s and the auth interceptor then redirects to /login — which aborted
    // the in-flight /setup navigation on virgin databases (first-run bug).
    this.authService.validateSession().subscribe((me) => {
      if (me && !this.propertiesLoaded) {
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
