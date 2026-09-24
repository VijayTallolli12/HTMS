import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme.service';

interface SettingsNavItem {
  path: string;
  label: string;
  badge?: number | string;
  iconSvg: string;
}

@Component({
  selector: 'app-settings-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="settings-workspace-container">
      <!-- Left Vertical Sub-Navigation (200-220px on desktop) -->
      <aside class="settings-subnav" aria-label="Appearance Workspace Navigation">
        <div class="subnav-header">
          <span class="subnav-eyebrow">WORKSPACE</span>
          <h2 class="subnav-title">Appearance</h2>
        </div>

        <!-- Mobile Section Dropdown (< 768px) -->
        <div class="mobile-section-picker">
          <label for="mobileSectionSelect" class="sr-only">Select Appearance Section</label>
          <select
            id="mobileSectionSelect"
            class="mobile-select"
            [value]="currentActivePath()"
            (change)="onSectionChange($event)"
          >
            <option *ngFor="let item of navItems" [value]="item.path">
              {{ item.label }}
            </option>
          </select>
        </div>

        <!-- Desktop / Tablet Vertical Navigation Links -->
        <nav class="subnav-links" aria-label="Appearance Subsections">
          <a
            *ngFor="let item of navItems"
            [routerLink]="item.path"
            [routerLinkActiveOptions]="{ exact: item.path === '/settings' }"
            routerLinkActive="is-active"
            class="subnav-link"
          >
            <span class="subnav-link-icon" [innerHTML]="item.iconSvg"></span>
            <span class="subnav-link-label">{{ item.label }}</span>
            <span class="subnav-count-badge" *ngIf="item.badge">{{ item.badge }}</span>
          </a>
        </nav>
      </aside>

      <!-- Main Settings Content Area -->
      <main class="settings-content-area" id="settings-main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .settings-workspace-container {
      display: grid;
      grid-template-columns: 210px minmax(0, 1fr);
      gap: 2rem;
      max-width: 1440px;
      margin: 0 auto;
      padding: 1.5rem 2rem;
      min-height: 100%;
      box-sizing: border-box;
      width: 100%;
    }

    @media (max-width: 1080px) {
      .settings-workspace-container {
        grid-template-columns: 190px minmax(0, 1fr);
        gap: 1.5rem;
        padding: 1.25rem 1.5rem;
      }
    }

    @media (max-width: 768px) {
      .settings-workspace-container {
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 1rem;
      }
    }

    /* Left Vertical Sub-Navigation */
    .settings-subnav {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .subnav-header {
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .subnav-eyebrow {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--gold-accent);
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.2rem;
    }

    .subnav-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    /* Mobile Dropdown */
    .mobile-section-picker {
      display: none;
    }

    .mobile-select {
      width: 100%;
      padding: 0.65rem 0.85rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 6px);
      outline: none;
      cursor: pointer;
    }

    .mobile-select:focus {
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 2px var(--gold-ring);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 768px) {
      .mobile-section-picker {
        display: block;
      }

      .subnav-links {
        display: none !important;
      }
    }

    /* Vertical Navigation Links */
    .subnav-links {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .subnav-link {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm, 6px);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.15s ease;
      position: relative;
    }

    .subnav-link:hover {
      color: var(--text-primary);
      background: var(--surface-raised);
    }

    .subnav-link.is-active {
      color: var(--gold-accent);
      background: var(--gold-light);
      font-weight: 700;
    }

    .subnav-link.is-active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 15%;
      height: 70%;
      width: 3px;
      background: var(--gold-accent);
      border-radius: 0 2px 2px 0;
    }

    .subnav-link-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .subnav-link-icon svg {
      width: 16px;
      height: 16px;
    }

    .subnav-link-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subnav-count-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
      background: var(--surface-raised);
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
    }

    .subnav-link.is-active .subnav-count-badge {
      background: var(--gold-accent);
      color: var(--text-inverse, #ffffff);
      border-color: var(--gold-accent);
    }

    /* Content Area */
    .settings-content-area {
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }
  `],
})
export class SettingsWorkspaceComponent {
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly navItems: SettingsNavItem[] = [
    {
      path: '/settings',
      label: 'Overview',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    },
    {
      path: '/settings/themes',
      label: 'Themes',
      badge: 16,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path></svg>',
    },
    {
      path: '/settings/colors',
      label: 'Colors',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>',
    },
    {
      path: '/settings/typography',
      label: 'Typography',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    },
    {
      path: '/settings/motion',
      label: 'Motion',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    },
    {
      path: '/settings/layout',
      label: 'Layout',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
    },
    {
      path: '/settings/branding',
      label: 'Application Branding',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>',
    },
  ];

  private readonly navEndUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly currentActivePath = computed(() => {
    const url = this.navEndUrl();
    const cleanUrl = url.split('?')[0].split('#')[0];
    const match = this.navItems.find((item) => {
      if (item.path === '/settings') return cleanUrl === '/settings' || cleanUrl === '/settings/';
      return cleanUrl.startsWith(item.path);
    });
    return match ? match.path : '/settings';
  });

  navigateToSection(path: string): void {
    this.router.navigateByUrl(path);
  }

  onSectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select && select.value) {
      this.navigateToSection(select.value);
    }
  }
}
