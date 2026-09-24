import { Component, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService, PRESET_THEMES } from '../../../core/services/theme.service';
import { ApplicationBrandingService } from '../../../core/services/application-branding.service';
import { HmsAlertComponent, HmsStatusPillComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, HmsAlertComponent, HmsStatusPillComponent],
  template: `
    <div class="overview-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="eyebrow-badge">SYSTEM PREFERENCES</div>
        <h1 class="section-title">Appearance &amp; Theme Preferences</h1>
        <p class="section-desc">
          Customize the visual identity, typography, motion kinetics, and layout geometry of the HMS.
        </p>
      </header>

      <!-- Success Notification -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>

      <!-- Active Configuration Summary & Live Mini Preview -->
      <div class="active-config-grid">
        <!-- Current Preferences Card -->
        <div class="summary-card">
          <div class="summary-card-header">
            <h2 class="summary-card-title">Active Configuration</h2>
            <span class="active-preset-badge">{{ activePresetName() }}</span>
          </div>

          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Current Theme</span>
              <div class="spec-val-group">
                <div class="swatches-inline">
                  <span class="dot-swatch" [style.background]="colors().primary"></span>
                  <span class="dot-swatch" [style.background]="colors().secondary"></span>
                  <span class="dot-swatch" [style.background]="colors().accent"></span>
                </div>
                <span class="spec-value">{{ activePresetName() }}</span>
                <a routerLink="/settings/themes" class="spec-link">Change &rarr;</a>
              </div>
            </div>

            <div class="spec-row">
              <span class="spec-label">Typography</span>
              <div class="spec-val-group">
                <span class="spec-value">{{ typography().headingFont }} / {{ typography().bodyFont }} ({{ typography().baseFontSize }}px)</span>
                <a routerLink="/settings/typography" class="spec-link">Configure &rarr;</a>
              </div>
            </div>

            <div class="spec-row">
              <span class="spec-label">Motion</span>
              <div class="spec-val-group">
                <span class="spec-value">{{ motion().preference | titlecase }} &bull; {{ motion().style | titlecase }}</span>
                <a routerLink="/settings/motion" class="spec-link">Adjust &rarr;</a>
              </div>
            </div>

            <div class="spec-row">
              <span class="spec-label">Density</span>
              <div class="spec-val-group">
                <span class="spec-value">{{ density() | titlecase }}</span>
                <a routerLink="/settings/layout" class="spec-link">Change &rarr;</a>
              </div>
            </div>

            <div class="spec-row">
              <span class="spec-label">Corner Radius</span>
              <div class="spec-val-group">
                <span class="spec-value">{{ radiusLabel() }}</span>
                <a routerLink="/settings/layout" class="spec-link">Change &rarr;</a>
              </div>
            </div>

            <div class="spec-row">
              <span class="spec-label">Application</span>
              <div class="spec-val-group">
                <span class="spec-value">{{ branding.applicationName() }}</span>
                <a routerLink="/settings/branding" class="spec-link">Edit &rarr;</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Small Summary Preview -->
        <div class="mini-preview-card">
          <div class="mini-preview-header">
            <span class="preview-tag">LIVE SUMMARY PREVIEW</span>
          </div>

          <div class="mini-preview-content">
            <div class="mini-topbar">
              <div class="mini-brand">
                <span class="mini-crest">{{ branding.logoMark() }}</span>
                <span class="mini-brand-name">{{ branding.applicationName() }}</span>
              </div>
              <span class="mini-property-pill">● Tokyo Grandeur</span>
            </div>

            <div class="mini-room-card">
              <div class="mini-room-head">
                <div>
                  <span class="mini-room-type">PRESIDENTIAL SUITE</span>
                  <div class="mini-room-title">Grandeur Suite 401</div>
                </div>
                <hms-status-pill statusKey="clean" statusLabel="Clean & Ready"></hms-status-pill>
              </div>

              <div class="mini-metrics-row">
                <div class="mini-metric">
                  <span class="mini-m-lbl">OCCUPANCY</span>
                  <span class="mini-m-val">84.2%</span>
                </div>
                <div class="mini-metric">
                  <span class="mini-m-lbl">RATE</span>
                  <span class="mini-m-val">$485.00</span>
                </div>
                <div class="mini-metric">
                  <span class="mini-m-lbl">CONTRAST</span>
                  <span class="mini-m-val text-pass">{{ textBgContrast() | number:'1.1-1' }}:1 AA</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Cards Grid -->
      <section class="nav-cards-section" aria-label="Appearance Configuration Areas">
        <h2 class="section-subheading">Configuration Sections</h2>
        <div class="nav-cards-grid">
          <!-- Themes -->
          <a routerLink="/settings/themes" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Theme Presets</h3>
              <p class="nav-card-desc">16 curated hospitality palettes across Professional, Seasonal, and Festival collections.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>

          <!-- Colors -->
          <a routerLink="/settings/colors" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Color Tokens</h3>
              <p class="nav-card-desc">Realtime color token pickers with protected operational safety colors and WCAG metrics.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>

          <!-- Typography -->
          <a routerLink="/settings/typography" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Typography Studio</h3>
              <p class="nav-card-desc">Curated 15-font library, recommended pairings, weights, base sizing, and custom font uploads.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>

          <!-- Motion -->
          <a routerLink="/settings/motion" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Motion Kinetics</h3>
              <p class="nav-card-desc">Calibrate interface fluid motion, easing curves, and speed while preserving vestibular accessibility.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>

          <!-- Layout -->
          <a routerLink="/settings/layout" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Density &amp; Geometry</h3>
              <p class="nav-card-desc">Adjust table whitespace padding and border-radius curvature across cards and dialogs.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>

          <!-- Branding -->
          <a routerLink="/settings/branding" class="nav-card">
            <div class="nav-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <div class="nav-card-body">
              <h3 class="nav-card-title">Application Branding</h3>
              <p class="nav-card-desc">Configure the enterprise product identity and subtitles displayed across all application surfaces.</p>
            </div>
            <span class="nav-card-arrow">&rarr;</span>
          </a>
        </div>
      </section>

      <!-- Appearance Tools Section (Export, Import, Reset) -->
      <section class="tools-card" aria-label="Appearance Management Tools">
        <input
          type="file"
          #importFileInput
          accept=".json"
          class="hidden-file-input"
          (change)="onImportFileSelected($event)"
        />

        <div class="tools-header">
          <div>
            <h2 class="tools-title">Appearance Configuration Tools</h2>
            <p class="tools-desc">Export or import the full design configuration as JSON, or reset preferences to system defaults.</p>
          </div>
        </div>

        <div class="tools-actions-row">
          <button type="button" class="tool-btn" (click)="exportSettings()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tool-icon" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export Appearance JSON</span>
          </button>

          <button type="button" class="tool-btn" (click)="triggerImportClick()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tool-icon" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Import Appearance JSON</span>
          </button>

          <button type="button" class="tool-btn" (click)="resetThemeOnly()">
            <span>Reset Theme Colors</span>
          </button>

          <button type="button" class="tool-btn tool-btn-danger" (click)="resetAllDefaults()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tool-icon" aria-hidden="true">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            <span>Reset All to Defaults</span>
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .overview-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
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

    .section-subheading {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.75rem;
    }

    .active-config-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1.25rem;
      align-items: start;
    }

    @media (max-width: 960px) {
      .active-config-grid {
        grid-template-columns: 1fr;
      }
    }

    .summary-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
    }

    .summary-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .summary-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .active-preset-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: var(--gold-light);
      color: var(--gold-dark);
      border: 1px solid rgba(154, 123, 56, 0.3);
    }

    .specs-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .spec-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .spec-label {
      color: var(--text-muted);
      font-weight: 500;
      min-width: 110px;
    }

    .spec-val-group {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .spec-value {
      color: var(--text-primary);
      font-weight: 600;
    }

    .spec-link {
      font-size: 0.75rem;
      color: var(--gold-accent);
      text-decoration: none;
      font-weight: 600;
    }

    .spec-link:hover {
      text-decoration: underline;
    }

    .swatches-inline {
      display: flex;
      gap: 0.25rem;
    }

    .dot-swatch {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }

    /* Mini Preview */
    .mini-preview-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .preview-tag {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--gold-accent);
    }

    .mini-preview-content {
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .mini-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.4rem 0.6rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
    }

    .mini-brand {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .mini-crest {
      font-size: 0.6rem;
      font-weight: 800;
      background: var(--gold-light);
      color: var(--gold-dark);
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      border: 1px solid rgba(154, 123, 56, 0.3);
    }

    .mini-brand-name {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .mini-property-pill {
      font-size: 0.65rem;
      color: var(--text-muted);
    }

    .mini-room-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .mini-room-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .mini-room-type {
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--gold-accent);
      letter-spacing: 0.05em;
    }

    .mini-room-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .mini-metrics-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      border-top: 1px solid var(--surface-border);
      padding-top: 0.5rem;
    }

    .mini-metric {
      display: flex;
      flex-direction: column;
    }

    .mini-m-lbl {
      font-size: 0.58rem;
      color: var(--text-muted);
      font-weight: 700;
    }

    .mini-m-val {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .text-pass {
      color: var(--status-success);
    }

    /* Navigation Cards */
    .nav-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .nav-card {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1rem;
      text-decoration: none;
      transition: all 0.15s ease;
      color: inherit;
    }

    .nav-card:hover {
      border-color: var(--gold-accent);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .nav-card-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm, 6px);
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-accent);
      flex-shrink: 0;
    }

    .nav-card-icon svg {
      width: 18px;
      height: 18px;
    }

    .nav-card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .nav-card-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .nav-card-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .nav-card-arrow {
      font-size: 1rem;
      color: var(--text-muted);
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .nav-card:hover .nav-card-arrow {
      color: var(--gold-accent);
      transform: translateX(3px);
    }

    /* Tools Card */
    .tools-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .hidden-file-input {
      display: none;
    }

    .tools-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.2rem;
    }

    .tools-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .tools-actions-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .tool-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.85rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .tool-btn:hover {
      background: var(--surface-raised);
      border-color: var(--gold-accent);
    }

    .tool-btn-danger {
      color: var(--status-danger);
    }

    .tool-btn-danger:hover {
      background: rgba(220, 38, 38, 0.08);
      border-color: var(--status-danger);
    }

    .tool-icon {
      width: 14px;
      height: 14px;
    }
  `],
})
export class AppearanceOverviewComponent {
  readonly themeService = inject(ThemeService);
  readonly branding = inject(ApplicationBrandingService);

  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;

  readonly colors = this.themeService.currentColors;
  readonly density = this.themeService.currentDensity;
  readonly radius = this.themeService.currentRadius;
  readonly typography = this.themeService.currentTypography;
  readonly motion = this.themeService.currentMotion;
  readonly activePreset = this.themeService.currentPreset;

  readonly successMessage = signal<string | null>(null);

  readonly activePresetName = computed(() => {
    const key = this.activePreset();
    if (key === 'custom') return 'Custom Palette';
    return PRESET_THEMES[key]?.name || 'Premium Hospitality';
  });

  readonly radiusLabel = computed(() => {
    const r = this.radius();
    if (r === 'none') return 'Sharp (0px)';
    if (r === 'sm') return 'Subtle (4px)';
    if (r === 'md') return 'Medium (8px)';
    return 'Soft (14px)';
  });

  readonly textBgContrast = computed(() => {
    return this.themeService.calculateContrastRatio(this.colors().text, this.colors().background);
  });

  exportSettings(): void {
    const jsonStr = this.themeService.exportPreferencesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hms-appearance.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showSuccess('Appearance configuration exported as hms-appearance.json');
  }

  triggerImportClick(): void {
    if (this.importFileInput) {
      this.importFileInput.nativeElement.click();
    }
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const res = this.themeService.importPreferencesJson(text);
      if (res.success) {
        this.showSuccess('Appearance settings imported successfully.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  resetThemeOnly(): void {
    this.themeService.resetTheme();
    this.showSuccess('Theme colors reset to Premium Hospitality.');
  }

  resetAllDefaults(): void {
    this.themeService.resetToDefault();
    this.branding.resetToDefault();
    this.showSuccess('All appearance studio settings restored to system defaults.');
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

