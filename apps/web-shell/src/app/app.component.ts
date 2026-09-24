import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from './core/services/organization.service';
import { AuthService } from './core/services/auth.service';
import { PropertyDto } from '@hms/api-contracts';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly properties = signal<PropertyDto[]>([]);
  readonly currentUser = this.authService.currentUser;
  readonly isAuthenticated = this.authService.isAuthenticated;

  title = 'Enterprise HMS';

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  get primaryRole(): string {
    const roles = this.authService.roles();
    return roles.length > 0 ? (roles[0].name || roles[0].code) : (this.currentUser()?.role || 'Staff');
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
    this.authService.logout();
    this.orgService.setActiveProperty(null);
    this.router.navigate(['/login']);
  }
}
