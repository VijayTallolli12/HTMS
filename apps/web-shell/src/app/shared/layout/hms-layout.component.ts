import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ApplicationBrandingService } from '../../core/services/application-branding.service';
import { HmsBrandLogoComponent } from '../components/hms-brand-logo.component';
import { PropertyDto } from '@hms/api-contracts';

@Component({
  selector: 'hms-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet, HmsBrandLogoComponent],
  template: `
    <div class="hms-shell">
      <header class="hms-topbar" *ngIf="isAuthenticated()">
        <div class="hms-topbar__brand" routerLink="/dashboard" [title]="branding.applicationName() + ' Dashboard'">
          <hms-brand-logo variant="full" size="sm"></hms-brand-logo>
        </div>

        <div class="hms-topbar__center">
          <div class="hms-topbar__property">
            <span class="hms-topbar__property-label">Property Context</span>
            <select
              *ngIf="properties().length > 0"
              [ngModel]="activeProperty()?.id"
              (ngModelChange)="onPropertyChange($event)"
              class="hms-property-select"
              aria-label="Active property"
            >
              <option *ngFor="let p of properties()" [value]="p.id">
                {{ p.name }} ({{ p.code }})
              </option>
            </select>
            <span class="hms-topbar__property-value" *ngIf="properties().length === 0">
              {{ activeProperty()?.name || 'Portfolio' }}
            </span>
          </div>

          <nav class="hms-topbar__nav" aria-label="Global workspace navigation">
            <a routerLink="/dashboard" routerLinkActive="active-nav" class="nav-link">Dashboard</a>
            <a routerLink="/pms/front-office" *ngIf="hasPermission('front_office.reservation.read')" routerLinkActive="active-nav" class="nav-link">Front Desk</a>
            <a routerLink="/pms/housekeeping" *ngIf="hasPermission('housekeeping.task.view')" routerLinkActive="active-nav" class="nav-link">Housekeeping</a>
            <a routerLink="/pms/room-operations" *ngIf="hasPermission('room_operations.status.read')" routerLinkActive="active-nav" class="nav-link">Room Ops</a>
            <a routerLink="/pms/folios" *ngIf="hasPermission('folio:view')" routerLinkActive="active-nav" class="nav-link">Cashiering</a>
            <a routerLink="/pms/availability" *ngIf="hasPermission('inventory:read')" routerLinkActive="active-nav" class="nav-link">Inventory ATS</a>
            <a routerLink="/organization" routerLinkActive="active-nav" class="nav-link">Organization</a>
          </nav>
        </div>

        <div class="hms-topbar__right">
          <div class="user-profile">
            <div class="user-avatar">
              {{ (currentUser()?.firstName || 'A')[0] }}{{ (currentUser()?.lastName || 'A')[0] }}
            </div>
            <div class="user-details">
              <span class="user-name">{{ currentUser()?.firstName || 'User' }}</span>
              <span class="user-role">{{ currentUser()?.role || 'Staff' }}</span>
            </div>
          </div>
          <button class="logout-btn" (click)="onLogout()" title="Sign Out" aria-label="Sign out">×</button>
        </div>
      </header>

      <div class="hms-shell__body">
        <aside class="hms-sidebar" *ngIf="isAuthenticated()">
          <ng-content></ng-content>
        </aside>

        <div class="hms-workspace">
          <div class="hms-workspace__command-center" *ngIf="isAuthenticated()">
            <div class="hms-workspace__crumb">
              Global HMS Shell / {{ activeProperty()?.name || 'Portfolio' }} / Workspace
            </div>
            <div class="hms-workspace__title">Operations Command Center</div>
          </div>

          <main class="hms-workspace__data-board">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .hms-property-select {
        max-width: 220px;
        padding: 4px 8px;
        font-size: 12px;
        font-family: inherit;
        color: var(--text-primary, #e2e8f0);
        background: var(--surface-raised, #1a2b3c);
        border: 1px solid var(--border-subtle, #2d3e50);
        border-radius: 6px;
        cursor: pointer;
      }
    `,
  ],
})
export class HmsLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  readonly branding = inject(ApplicationBrandingService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly currentUser = this.authService.currentUser;
  readonly activeProperty = this.orgService.activePropertyContext;
  readonly properties = signal<PropertyDto[]>([]);

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
    if (this.isAuthenticated() && !this.propertiesLoaded) {
      this.loadProperties();
    }
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
    this.authService.logout();
    this.orgService.setActiveProperty(null);
    this.router.navigate(['/login']);
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }
}
