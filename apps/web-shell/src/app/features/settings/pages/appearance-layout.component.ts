import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, DensityOption, RadiusOption } from '../../../core/services/theme.service';
import { HmsAlertComponent, HmsStatusPillComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-layout',
  standalone: true,
  imports: [CommonModule, HmsAlertComponent, HmsStatusPillComponent],
  template: `
    <div class="layout-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="eyebrow-badge">LAYOUT</div>
        <h1 class="section-title">Density &amp; Geometry</h1>
        <p class="section-desc">
          Calibrate interface whitespace padding, table data density, and corner curvature geometry.
        </p>
      </header>

      <!-- Success Notification -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>

      <!-- Section 1: Density -->
      <section class="layout-card">
        <h2 class="layout-card-title">Layout Density</h2>
        <p class="layout-card-desc">Adjust table row spacing and operational component padding.</p>

        <div class="choice-group">
          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="density() === 'comfortable'"
            (click)="onDensityChange('comfortable')"
          >
            <span class="choice-title">Comfortable (Standard)</span>
            <span class="choice-desc">Spacious hospitality standard for high readability and touch ergonomics (Default)</span>
          </button>

          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="density() === 'compact'"
            (click)="onDensityChange('compact')"
          >
            <span class="choice-title">Compact (High-Density)</span>
            <span class="choice-desc">Tight row spacing optimized for high-volume room dispatch and night auditors</span>
          </button>

          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="density() === 'spacious'"
            (click)="onDensityChange('spacious')"
          >
            <span class="choice-title">Spacious (Executive)</span>
            <span class="choice-desc">Generous breathing room tailored for executive dashboard displays and presentations</span>
          </button>
        </div>
      </section>

      <!-- Section 2: Corner Geometry -->
      <section class="layout-card">
        <h2 class="layout-card-title">Corner Geometry</h2>
        <p class="layout-card-desc">Set border-radius curvature across cards, buttons, dialogs, and status pills.</p>

        <div class="segmented-control">
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="radius() === 'none'"
            (click)="onRadiusChange('none')"
          >
            Sharp (0px)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="radius() === 'sm'"
            (click)="onRadiusChange('sm')"
          >
            Subtle (4px)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="radius() === 'md'"
            (click)="onRadiusChange('md')"
          >
            Medium (8px)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="radius() === 'lg'"
            (click)="onRadiusChange('lg')"
          >
            Soft (14px)
          </button>
        </div>
      </section>

      <!-- Section 3: Contextual Layout Preview -->
      <section class="layout-card preview-card">
        <h2 class="layout-card-title">Contextual Layout Preview</h2>
        <p class="layout-card-desc">Live representation of table row padding and card corner curvature.</p>

        <div class="sample-table-wrapper">
          <div class="sample-table">
            <div class="sample-tr sample-th">
              <span>Room Number</span>
              <span>Category</span>
              <span>Status</span>
              <span>Nightly Rate</span>
            </div>
            <div class="sample-tr">
              <span class="font-mono">Suite 401</span>
              <span>Presidential Suite</span>
              <span><hms-status-pill statusKey="clean" statusLabel="Clean & Ready"></hms-status-pill></span>
              <span class="font-mono">$485.00</span>
            </div>
            <div class="sample-tr">
              <span class="font-mono">Deluxe 205</span>
              <span>Ocean Deluxe</span>
              <span><hms-status-pill statusKey="occupied" statusLabel="Occupied"></hms-status-pill></span>
              <span class="font-mono">$280.00</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .layout-page-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
      box-sizing: border-box;
    }

    .section-header {
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 1rem;
    }

    .eyebrow-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gold-accent);
      background: var(--gold-light);
      border: 1px solid rgba(154, 123, 56, 0.3);
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm, 4px);
      margin-bottom: 0.35rem;
    }

    .section-title {
      font-size: 1.55rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
      line-height: 1.25;
    }

    .section-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .layout-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-sm);
    }

    .layout-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .layout-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: -0.45rem;
    }

    /* Choice Buttons */
    .choice-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .choice-btn {
      display: flex;
      flex-direction: column;
      text-align: left;
      gap: 0.2rem;
      padding: 0.75rem 1rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none !important;
    }

    .choice-btn:hover {
      background: var(--surface-raised);
      border-color: var(--gold-accent);
    }

    .choice-btn.is-selected {
      background: var(--surface-card);
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 1px var(--gold-accent);
    }

    .choice-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .choice-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    /* Segmented Control */
    .segmented-control {
      display: flex;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 0.25rem;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .segment-btn {
      flex: 1;
      min-width: 80px;
      padding: 0.45rem 0.65rem;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
      text-decoration: none !important;
    }

    .segment-btn:hover {
      color: var(--text-primary);
    }

    .segment-btn.is-active {
      background: var(--surface-card);
      color: var(--gold-accent);
      border-color: var(--surface-border);
      box-shadow: var(--shadow-sm);
    }

    /* Preview Table */
    .preview-card {
      background: var(--surface-root);
    }

    .sample-table-wrapper {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      overflow: hidden;
    }

    .sample-table {
      width: 100%;
      display: flex;
      flex-direction: column;
      font-size: 0.78rem;
    }

    .sample-tr {
      display: grid;
      grid-template-columns: 120px 1fr 150px 100px;
      padding: var(--space-row-y, 0.6rem) var(--space-row-x, 1rem);
      border-bottom: 1px solid var(--surface-border);
      align-items: center;
    }

    .sample-tr:last-child {
      border-bottom: none;
    }

    .sample-th {
      background: var(--surface-raised);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 0.68rem;
      letter-spacing: 0.05em;
    }

    .font-mono {
      font-family: var(--font-mono);
    }
  `],
})
export class AppearanceLayoutComponent {
  readonly themeService = inject(ThemeService);
  readonly density = this.themeService.currentDensity;
  readonly radius = this.themeService.currentRadius;

  readonly successMessage = signal<string | null>(null);

  onDensityChange(density: DensityOption): void {
    this.themeService.setDensity(density);
    this.showSuccess(`Layout density set to ${density}.`);
  }

  onRadiusChange(radius: RadiusOption): void {
    this.themeService.setRadius(radius);
    this.showSuccess(`Corner radius set to ${radius}.`);
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      if (this.successMessage() === msg) {
        this.successMessage.set(null);
      }
    }, 4000);
  }
}

