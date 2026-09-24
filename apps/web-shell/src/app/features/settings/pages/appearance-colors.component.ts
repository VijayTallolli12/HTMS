import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, ThemeColors } from '../../../core/services/theme.service';
import { HmsAlertComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-colors',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsAlertComponent],
  template: `
    <div class="colors-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="eyebrow-badge">COLORS</div>
        <h1 class="section-title">Color Tokens</h1>
        <p class="section-desc">
          Fine-tune core UI brand and foundation tokens with real-time accessibility contrast feedback.
        </p>
      </header>

      <!-- Low Contrast Warning -->
      <hms-alert type="warning" *ngIf="isLowContrast()">
        Accessibility Notice: The current color configuration has a contrast ratio below WCAG AA standards ({{ textBgContrast() | number:'1.1-1' }}:1). Text readability may be reduced.
      </hms-alert>

      <!-- Section 1: Brand Colors -->
      <section class="token-group-card">
        <h2 class="token-group-title">Brand Colors</h2>
        <p class="token-group-desc">Define the primary accents that define your property identity.</p>

        <div class="tokens-grid">
          <!-- Primary -->
          <div class="token-field">
            <label class="token-label">Primary (Accent)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().primary"
                (ngModelChange)="onColorChange('primary', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().primary"
                (change)="onColorChange('primary', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Secondary -->
          <div class="token-field">
            <label class="token-label">Secondary (Surface Tint)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().secondary"
                (ngModelChange)="onColorChange('secondary', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().secondary"
                (change)="onColorChange('secondary', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Accent -->
          <div class="token-field">
            <label class="token-label">Accent (Contrast Highlight)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().accent"
                (ngModelChange)="onColorChange('accent', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().accent"
                (change)="onColorChange('accent', $any($event.target).value)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Foundation Colors -->
      <section class="token-group-card">
        <h2 class="token-group-title">Foundation Tokens</h2>
        <p class="token-group-desc">Neutral canvas and structural colors engineered for eye comfort and prolonged operational shifts.</p>

        <div class="tokens-grid">
          <!-- Background -->
          <div class="token-field">
            <label class="token-label">Background (Canvas)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().background"
                (ngModelChange)="onColorChange('background', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().background"
                (change)="onColorChange('background', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Surface -->
          <div class="token-field">
            <label class="token-label">Surface (Card Background)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().surface"
                (ngModelChange)="onColorChange('surface', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().surface"
                (change)="onColorChange('surface', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Border -->
          <div class="token-field">
            <label class="token-label">Border (Dividers)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().border"
                (ngModelChange)="onColorChange('border', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().border"
                (change)="onColorChange('border', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Text -->
          <div class="token-field">
            <label class="token-label">Text (Base Primary)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().text"
                (ngModelChange)="onColorChange('text', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().text"
                (change)="onColorChange('text', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Muted Text -->
          <div class="token-field">
            <label class="token-label">Muted Text (Secondary)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().mutedText"
                (ngModelChange)="onColorChange('mutedText', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().mutedText"
                (change)="onColorChange('mutedText', $any($event.target).value)"
              />
            </div>
          </div>

          <!-- Focus Ring -->
          <div class="token-field">
            <label class="token-label">Focus Ring (Keyboard)</label>
            <div class="token-input-group">
              <input
                type="color"
                class="color-picker"
                [ngModel]="colors().focus"
                (ngModelChange)="onColorChange('focus', $event)"
              />
              <input
                type="text"
                class="hex-input"
                maxlength="7"
                [ngModel]="colors().focus"
                (change)="onColorChange('focus', $any($event.target).value)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Semantic Operational Colors (Strictly Protected) -->
      <section class="token-group-card semantic-card">
        <div class="semantic-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shield-icon" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <div>
            <h2 class="token-group-title">Protected Semantic Operational Colors</h2>
            <p class="token-group-desc">
              Operational status colors are strictly independent from brand styling. Customizing theme or festival colors will never invert room readiness, maintenance warnings, or financial settlement indicators.
            </p>
          </div>
        </div>

        <!-- Semantic States Grid -->
        <div class="semantic-grid">
          <div class="semantic-item item-success">
            <span class="semantic-swatch swatch-success"></span>
            <div class="semantic-meta">
              <span class="semantic-title">Success / Clean</span>
              <span class="semantic-hex">#059669 &bull; Clean &amp; Ready, Settled, Paid</span>
            </div>
          </div>

          <div class="semantic-item item-warning">
            <span class="semantic-swatch swatch-warning"></span>
            <div class="semantic-meta">
              <span class="semantic-title">Warning / Turnover</span>
              <span class="semantic-hex">#D97706 &bull; Dirty, In Turnover, Action Required</span>
            </div>
          </div>

          <div class="semantic-item item-danger">
            <span class="semantic-swatch swatch-danger"></span>
            <div class="semantic-meta">
              <span class="semantic-title">Danger / Critical</span>
              <span class="semantic-hex">#DC2626 &bull; Occupied, Overdue Folio, Emergency</span>
            </div>
          </div>

          <div class="semantic-item item-info">
            <span class="semantic-swatch swatch-info"></span>
            <div class="semantic-meta">
              <span class="semantic-title">Info / Inspected</span>
              <span class="semantic-hex">#0D9488 &bull; Inspected, Verified, System Notice</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Live Contrast Inspector Card -->
      <section class="contrast-card">
        <h2 class="contrast-card-title">Live WCAG Accessibility Contrast Metrics</h2>
        <div class="contrast-rows">
          <div class="contrast-row">
            <span class="c-label">Text / Background Contrast Ratio</span>
            <div class="c-val-group">
              <span class="c-val" [class.pass]="textBgContrast() >= 4.5" [class.fail]="textBgContrast() < 4.5">
                {{ textBgContrast() | number:'1.1-1' }}:1
              </span>
              <span class="wcag-badge" *ngIf="textBgContrast() >= 4.5">WCAG AA PASS</span>
              <span class="wcag-badge fail" *ngIf="textBgContrast() < 4.5">FAIL</span>
            </div>
          </div>

          <div class="contrast-row">
            <span class="c-label">Primary / Surface Contrast Ratio</span>
            <div class="c-val-group">
              <span class="c-val" [class.pass]="priSurfaceContrast() >= 3.0" [class.fail]="priSurfaceContrast() < 3.0">
                {{ priSurfaceContrast() | number:'1.1-1' }}:1
              </span>
              <span class="wcag-badge" *ngIf="priSurfaceContrast() >= 3.0">PASS</span>
              <span class="wcag-badge fail" *ngIf="priSurfaceContrast() < 3.0">FAIL</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .colors-page-container {
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

    .token-group-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-sm);
    }

    .token-group-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .token-group-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: -0.45rem;
    }

    .tokens-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .token-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .token-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .token-input-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      padding: 0.25rem 0.4rem;
    }

    .color-picker {
      -webkit-appearance: none;
      appearance: none;
      border: none;
      width: 26px;
      height: 26px;
      border-radius: 4px;
      cursor: pointer;
      background: none;
      padding: 0;
    }

    .color-picker::-webkit-color-swatch {
      border: 1px solid var(--surface-border);
      border-radius: 4px;
    }

    .hex-input {
      border: none;
      background: transparent;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      color: var(--text-primary);
      width: 100%;
      outline: none;
    }

    /* Semantic Card */
    .semantic-card {
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
    }

    .semantic-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .shield-icon {
      width: 22px;
      height: 22px;
      color: var(--gold-accent);
      flex-shrink: 0;
      margin-top: 0.1rem;
    }

    .semantic-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .semantic-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.65rem 0.85rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 6px);
    }

    .semantic-swatch {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .swatch-success { background: #059669; }
    .swatch-warning { background: #d97706; }
    .swatch-danger { background: #dc2626; }
    .swatch-info { background: #0d9488; }

    .semantic-meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .semantic-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .semantic-hex {
      font-size: 0.68rem;
      color: var(--text-muted);
    }

    /* Contrast Card */
    .contrast-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .contrast-card-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .contrast-rows {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .contrast-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
      border-top: 1px solid var(--surface-border);
      padding-top: 0.5rem;
    }

    .c-label {
      color: var(--text-muted);
    }

    .c-val-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .c-val {
      font-weight: 700;
      font-size: 0.88rem;
    }

    .c-val.pass { color: var(--status-success); }
    .c-val.fail { color: var(--status-danger); }

    .wcag-badge {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      background: rgba(5, 150, 105, 0.15);
      color: var(--status-success);
    }

    .wcag-badge.fail {
      background: rgba(220, 38, 38, 0.15);
      color: var(--status-danger);
    }
  `],
})
export class AppearanceColorsComponent {
  readonly themeService = inject(ThemeService);
  readonly colors = this.themeService.currentColors;

  readonly textBgContrast = computed(() => {
    return this.themeService.calculateContrastRatio(this.colors().text, this.colors().background);
  });

  readonly priSurfaceContrast = computed(() => {
    return this.themeService.calculateContrastRatio(this.colors().primary, this.colors().surface);
  });

  readonly isLowContrast = computed(() => {
    return this.textBgContrast() < 4.5 || this.priSurfaceContrast() < 3.0;
  });

  onColorChange(key: keyof ThemeColors, hex: string): void {
    if (this.themeService.isValidHex(hex)) {
      this.themeService.setCustomColor(key, hex);
    }
  }
}

