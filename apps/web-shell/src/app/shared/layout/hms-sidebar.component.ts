import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'hms-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="hms-sidebar" [class.is-collapsed]="isCollapsed" aria-label="Main Navigation">
      <!-- Scrollable Navigation Area -->
      <div class="hms-sidebar__nav">
        <!-- 1. OVERVIEW -->
        <div class="hms-sidebar__section">
          <div class="hms-sidebar__section-title" *ngIf="!isCollapsed">Overview</div>
          <a
            routerLink="/dashboard"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Dashboard'"
            [attr.aria-label]="'Dashboard'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Dashboard</span>
          </a>
        </div>

        <!-- 2. FRONT OFFICE -->
        <div class="hms-sidebar__section" *ngIf="canAccessFrontOffice()">
          <div class="hms-sidebar__section-title" *ngIf="!isCollapsed">Front Office</div>

          <a
            *ngIf="hasPermission('front_office.reservation.read')"
            routerLink="/pms/reservations"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Reservations'"
            [attr.aria-label]="'Reservations'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Reservations</span>
          </a>

          <a
            *ngIf="hasPermission('front_office.reservation.read')"
            routerLink="/pms/front-office"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Front Desk'"
            [attr.aria-label]="'Front Desk'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Front Desk</span>
          </a>

          <a
            *ngIf="hasPermission('folio:view')"
            routerLink="/pms/folios"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Cashiering'"
            [attr.aria-label]="'Cashiering'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Cashiering</span>
          </a>
        </div>

        <!-- 3. ROOMS -->
        <div class="hms-sidebar__section" *ngIf="canAccessRooms()">
          <div class="hms-sidebar__section-title" *ngIf="!isCollapsed">Rooms</div>

          <a
            *ngIf="hasPermission('room_operations.status.read')"
            routerLink="/pms/room-operations"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Room Operations'"
            [attr.aria-label]="'Room Operations'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 4v16"></path>
                <path d="M2 8h18a2 2 0 0 1 2 2v10"></path>
                <path d="M2 17h20"></path>
                <path d="M6 8v9"></path>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Room Operations</span>
          </a>

          <a
            *ngIf="hasPermission('inventory:read')"
            routerLink="/pms/availability"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Availability'"
            [attr.aria-label]="'Availability'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Availability</span>
          </a>
        </div>

        <!-- 4. OPERATIONS -->
        <div class="hms-sidebar__section" *ngIf="canAccessOperations()">
          <div class="hms-sidebar__section-title" *ngIf="!isCollapsed">Operations</div>

          <a
            *ngIf="hasPermission('housekeeping.task.view')"
            routerLink="/pms/housekeeping"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Housekeeping'"
            [attr.aria-label]="'Housekeeping'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Housekeeping</span>
          </a>

          <a
            *ngIf="hasPermission('engineering.asset.view')"
            routerLink="/pms/engineering"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Engineering'"
            [attr.aria-label]="'Engineering'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Engineering</span>
          </a>
        </div>

        <!-- 5. ADMINISTRATION -->
        <div class="hms-sidebar__section" *ngIf="canAccessAdmin()">
          <div class="hms-sidebar__section-title" *ngIf="!isCollapsed">Administration</div>

          <a
            *ngIf="canAccessAdmin()"
            routerLink="/organization"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'Organization'"
            [attr.aria-label]="'Organization'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"></path>
                <path d="M5 21V7l8-4v18"></path>
                <path d="M19 21V11l-6-4"></path>
                <path d="M9 9v.01"></path>
                <path d="M9 12v.01"></path>
                <path d="M9 15v.01"></path>
                <path d="M9 18v.01"></path>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">Organization</span>
          </a>

          <a
            *ngIf="canAccessAdmin()"
            routerLink="/health"
            routerLinkActive="hms-sidebar__item--active"
            class="hms-sidebar__item"
            (click)="onItemClick()"
            [title]="'System Health'"
            [attr.aria-label]="'System Health'"
          >
            <span class="hms-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </span>
            <span class="hms-sidebar__item-label" *ngIf="!isCollapsed">System Health</span>
          </a>
        </div>
      </div>

      <!-- Collapse / Expand Footer Toggle Button -->
      <div class="hms-sidebar__footer">
        <button
          type="button"
          class="sidebar-collapse-trigger"
          (click)="onCollapseToggle()"
          [title]="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          [attr.aria-label]="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <span class="trigger-icon" aria-hidden="true">
            <svg *ngIf="!isCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-svg">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <svg *ngIf="isCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-svg">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span class="trigger-label" *ngIf="!isCollapsed">Collapse Sidebar</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .hms-sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 240px;
      background: var(--surface-card);
      border-right: 1px solid var(--surface-border);
      transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      box-sizing: border-box;
      user-select: none;
    }

    .hms-sidebar.is-collapsed {
      width: 68px;
    }

    .hms-sidebar__nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .hms-sidebar__section {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .hms-sidebar__section-title {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      padding: 0.25rem 0.75rem 0.4rem;
      white-space: nowrap;
    }

    .hms-sidebar__item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 40px;
      padding: 0 0.75rem;
      border-radius: 6px;
      font-size: 0.86rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
      white-space: nowrap;
      position: relative;
    }

    .hms-sidebar.is-collapsed .hms-sidebar__item {
      padding: 0;
      justify-content: center;
    }

    .hms-sidebar__item:hover {
      background: var(--surface-raised);
      color: var(--text-primary);
    }

    .hms-sidebar__item-icon {
      width: 19px;
      height: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-muted);
      transition: color 0.15s ease;
    }

    .hms-sidebar__item-icon svg {
      width: 18px;
      height: 18px;
    }

    .hms-sidebar__item:hover .hms-sidebar__item-icon {
      color: var(--text-primary);
    }

    .hms-sidebar__item-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Active Navigation State */
    .hms-sidebar__item.hms-sidebar__item--active {
      background: var(--gold-light);
      color: var(--gold-dark);
      font-weight: 600;
    }

    .hms-sidebar__item.hms-sidebar__item--active .hms-sidebar__item-icon {
      color: var(--gold-accent);
    }

    .hms-sidebar__item.hms-sidebar__item--active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--gold-accent);
    }

    /* Footer Collapse Trigger */
    .hms-sidebar__footer {
      padding: 0.65rem;
      border-top: 1px solid var(--surface-border);
      background: var(--surface-card);
    }

    .sidebar-collapse-trigger {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      height: 38px;
      padding: 0 0.75rem;
      background: transparent;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .hms-sidebar.is-collapsed .sidebar-collapse-trigger {
      padding: 0;
      justify-content: center;
    }

    .sidebar-collapse-trigger:hover {
      background: var(--surface-raised);
      color: var(--text-primary);
      border-color: var(--gold-accent);
    }

    .trigger-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .arrow-svg {
      width: 16px;
      height: 16px;
    }

    @media (prefers-reduced-motion: reduce) {
      .hms-sidebar {
        transition: none !important;
      }
    }
  `],
})
export class HmsSidebarComponent {
  private readonly authService = inject(AuthService);

  @Input() isCollapsed = false;
  @Output() collapseToggle = new EventEmitter<void>();
  @Output() navItemClick = new EventEmitter<void>();

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  canAccessFrontOffice(): boolean {
    return (
      this.hasPermission('front_office.reservation.read') ||
      this.hasPermission('folio:view')
    );
  }

  canAccessRooms(): boolean {
    return (
      this.hasPermission('room_operations.status.read') ||
      this.hasPermission('inventory:read')
    );
  }

  canAccessOperations(): boolean {
    return (
      this.hasPermission('housekeeping.task.view') ||
      this.hasPermission('engineering.asset.view')
    );
  }

  canAccessAdmin(): boolean {
    const roles = this.authService.roles();
    return roles.some((r) => r.code === 'CORP_ADMIN' || r.code === 'PROPERTY_GM');
  }

  onItemClick(): void {
    this.navItemClick.emit();
  }

  onCollapseToggle(): void {
    this.collapseToggle.emit();
  }
}
