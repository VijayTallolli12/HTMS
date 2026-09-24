import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ThemeService,
  BUILT_IN_FONTS,
  LineHeightOption,
  LetterSpacingOption,
  HeadingScaleOption,
} from '../../../core/services/theme.service';
import { CustomFontService } from '../../../core/services/custom-font.service';
import { HmsAlertComponent } from '../../../shared/index';

export interface RecommendedPairing {
  name: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  bodyWeight: number;
  tag: string;
}

@Component({
  selector: 'app-appearance-typography',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsAlertComponent],
  template: `
    <div class="typography-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="eyebrow-badge">TYPOGRAPHY</div>
        <h1 class="section-title">Typography Studio</h1>
        <p class="section-desc">
          Control the fonts, hierarchy, proportional scale, and readability of the HMS interface.
        </p>
      </header>

      <!-- Alerts -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>
      <hms-alert type="danger" *ngIf="fontUploadError()" (closed)="fontUploadError.set(null)">
        {{ fontUploadError() }}
      </hms-alert>

      <!-- Section 1: Recommended Font Pairings -->
      <section class="typo-card">
        <h2 class="typo-card-title">Recommended Hospitality Font Pairings</h2>
        <p class="typo-card-desc">Hand-crafted combinations balancing brand elegance with operational legibility.</p>

        <div class="pairings-grid">
          <div
            *ngFor="let p of recommendedPairings"
            class="pairing-card"
            (click)="applyPairing(p)"
          >
            <div class="pairing-head">
              <span class="pairing-name">{{ p.name }}</span>
              <span class="pairing-tag">{{ p.tag }}</span>
            </div>
            <div class="pairing-sample">
              <div class="pairing-heading-sample" [style.font-family]="p.headingFont" [style.font-weight]="p.headingWeight">
                {{ p.headingFont }}
              </div>
              <div class="pairing-body-sample" [style.font-family]="p.bodyFont" [style.font-weight]="p.bodyWeight">
                Body in {{ p.bodyFont }} &bull; 100% Legibility
              </div>
            </div>
            <button type="button" class="apply-pairing-btn">Apply Pairing</button>
          </div>
        </div>
      </section>

      <!-- Section 2: Font Families & Weights -->
      <section class="typo-card">
        <h2 class="typo-card-title">Font Families &amp; Weight Architecture</h2>

        <div class="font-controls-grid">
          <!-- Heading Font Family -->
          <div class="font-control-item">
            <label for="headingFontSelect" class="token-label">Heading Font Family</label>
            <select
              id="headingFontSelect"
              class="studio-select"
              [ngModel]="typography().headingFont"
              (ngModelChange)="onHeadingFontChange($event)"
            >
              <optgroup label="Curated Library (15 Fonts)">
                <option *ngFor="let f of builtInFonts" [value]="f.name">{{ f.name }} ({{ f.category }})</option>
              </optgroup>
              <optgroup label="Custom Corporate Fonts" *ngIf="customFonts().length > 0">
                <option *ngFor="let cf of customFonts()" [value]="cf.name">{{ cf.name }} (Custom)</option>
              </optgroup>
            </select>
          </div>

          <!-- Body Font Family -->
          <div class="font-control-item">
            <label for="bodyFontSelect" class="token-label">Body Font Family</label>
            <select
              id="bodyFontSelect"
              class="studio-select"
              [ngModel]="typography().bodyFont"
              (ngModelChange)="onBodyFontChange($event)"
            >
              <optgroup label="Curated Library (15 Fonts)">
                <option *ngFor="let f of builtInFonts" [value]="f.name">{{ f.name }} ({{ f.category }})</option>
              </optgroup>
              <optgroup label="Custom Corporate Fonts" *ngIf="customFonts().length > 0">
                <option *ngFor="let cf of customFonts()" [value]="cf.name">{{ cf.name }} (Custom)</option>
              </optgroup>
            </select>
          </div>

          <!-- Heading Weight -->
          <div class="font-control-item">
            <label class="token-label">Heading Weight ({{ typography().headingWeight }})</label>
            <div class="segmented-control">
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingWeight === 400"
                (click)="onHeadingWeightChange(400)"
              >
                Regular (400)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingWeight === 500"
                (click)="onHeadingWeightChange(500)"
              >
                Medium (500)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingWeight === 600"
                (click)="onHeadingWeightChange(600)"
              >
                Semibold (600)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingWeight === 700"
                (click)="onHeadingWeightChange(700)"
              >
                Bold (700)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingWeight === 800"
                (click)="onHeadingWeightChange(800)"
              >
                Heavy (800)
              </button>
            </div>
          </div>

          <!-- Body Weight -->
          <div class="font-control-item">
            <label class="token-label">Body Weight ({{ typography().bodyWeight }})</label>
            <div class="segmented-control">
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().bodyWeight === 300"
                (click)="onBodyWeightChange(300)"
              >
                Light (300)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().bodyWeight === 400"
                (click)="onBodyWeightChange(400)"
              >
                Regular (400)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().bodyWeight === 500"
                (click)="onBodyWeightChange(500)"
              >
                Medium (500)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().bodyWeight === 600"
                (click)="onBodyWeightChange(600)"
              >
                Semibold (600)
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Sizing, Line Spacing & Scale -->
      <section class="typo-card">
        <h2 class="typo-card-title">Sizing, Line Spacing &amp; Scale</h2>

        <div class="font-controls-grid">
          <!-- Base Font Size Slider -->
          <div class="font-control-item">
            <div class="slider-header">
              <label for="baseFontSizeSlider" class="token-label">Base Font Size</label>
              <span class="slider-value">{{ typography().baseFontSize }}px</span>
            </div>
            <input
              id="baseFontSizeSlider"
              type="range"
              min="14"
              max="18"
              step="1"
              class="studio-slider"
              [ngModel]="typography().baseFontSize"
              (ngModelChange)="onBaseFontSizeChange($event)"
            />
            <div class="slider-ticks">
              <span>14px (Compact)</span>
              <span>16px (Standard)</span>
              <span>18px (Comfortable)</span>
            </div>
          </div>

          <!-- Line Height -->
          <div class="font-control-item">
            <label class="token-label">Line Height</label>
            <div class="segmented-control">
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().lineHeight === 'compact'"
                (click)="onLineHeightChange('compact')"
              >
                Compact (1.4)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().lineHeight === 'comfortable'"
                (click)="onLineHeightChange('comfortable')"
              >
                Comfortable (1.5)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().lineHeight === 'relaxed'"
                (click)="onLineHeightChange('relaxed')"
              >
                Relaxed (1.7)
              </button>
            </div>
          </div>

          <!-- Letter Spacing -->
          <div class="font-control-item">
            <label class="token-label">Letter Spacing</label>
            <div class="segmented-control">
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().letterSpacing === 'tight'"
                (click)="onLetterSpacingChange('tight')"
              >
                Tight (-0.01em)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().letterSpacing === 'default'"
                (click)="onLetterSpacingChange('default')"
              >
                Standard (0)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().letterSpacing === 'wide'"
                (click)="onLetterSpacingChange('wide')"
              >
                Wide (0.02em)
              </button>
            </div>
          </div>

          <!-- Heading Scale -->
          <div class="font-control-item">
            <label class="token-label">Heading Scale Ratio</label>
            <div class="segmented-control">
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingScale === 'classic'"
                (click)="onHeadingScaleChange('classic')"
              >
                Classic (1.20)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingScale === 'prominent'"
                (click)="onHeadingScaleChange('prominent')"
              >
                Prominent (1.25)
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.is-active]="typography().headingScale === 'editorial'"
                (click)="onHeadingScaleChange('editorial')"
              >
                Editorial (1.33)
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: Live Typography Specimen Preview -->
      <section class="typo-card specimen-card">
        <h2 class="typo-card-title">Live Typography Specimen</h2>
        <div class="specimen-content">
          <div class="specimen-h1">Grandeur Suite 401 &bull; Presidential Floor</div>
          <div class="specimen-h2">Five-Star Executive Hospitality Experience</div>
          <p class="specimen-body">
            Real-time operational dispatch. The system seamlessly calculates occupancy telemetry, room cleaning turnovers, and guest reservation folio balances with 100% WCAG AA contrast compliance.
          </p>
        </div>
      </section>

      <!-- Section 5: Custom Corporate Font Upload -->
      <section class="typo-card upload-card">
        <h2 class="typo-card-title">Upload Custom Corporate Font</h2>
        <p class="typo-card-desc">
          Support corporate brand guidelines with custom web fonts (.woff2, .woff, .ttf). Securely stored via browser IndexedDB and registered with FontFace API.
        </p>

        <div class="upload-fields-row">
          <div class="upload-file-field">
            <label for="fontFileInput" class="token-label">Font Binary File</label>
            <input
              id="fontFileInput"
              #customFontFileInput
              type="file"
              accept=".woff2,.woff,.ttf"
              class="studio-file-input"
              (change)="onFontFileSelected($event)"
            />
            <span class="file-hint">Supported: .woff2, .woff, .ttf (Max 5MB)</span>
          </div>

          <div class="upload-text-field">
            <label for="fontFamilyInput" class="token-label">Font Family Name</label>
            <input
              id="fontFamilyInput"
              type="text"
              class="studio-text-input"
              placeholder="e.g. Grandeur Corporate Sans"
              [ngModel]="fontUploadName()"
              (ngModelChange)="fontUploadName.set($event)"
            />
          </div>

          <div class="upload-weight-field">
            <label for="fontWeightSelect" class="token-label">Weight</label>
            <select
              id="fontWeightSelect"
              class="studio-select"
              [ngModel]="fontUploadWeight()"
              (ngModelChange)="fontUploadWeight.set(+$event)"
            >
              <option [value]="300">300 (Light)</option>
              <option [value]="400">400 (Regular)</option>
              <option [value]="500">500 (Medium)</option>
              <option [value]="600">600 (Semibold)</option>
              <option [value]="700">700 (Bold)</option>
            </select>
          </div>

          <div class="upload-action-field">
            <button
              type="button"
              class="install-btn"
              [disabled]="!fontUploadFile() || !fontUploadName() || isUploadingFont()"
              (click)="uploadCustomFont()"
            >
              <span *ngIf="!isUploadingFont()">Install Font</span>
              <span *ngIf="isUploadingFont()">Installing...</span>
            </button>
          </div>
        </div>

        <!-- Installed Custom Fonts List -->
        <div class="installed-fonts-list" *ngIf="customFonts().length > 0">
          <h3 class="installed-fonts-title">Installed Corporate Fonts ({{ customFonts().length }})</h3>
          <div class="custom-font-card" *ngFor="let cf of customFonts()">
            <div class="custom-font-meta">
              <span class="custom-font-name" [style.font-family]="cf.name">{{ cf.name }}</span>
              <span class="custom-font-tags">
                Weight {{ cf.weight }} &bull; {{ cf.format | uppercase }} &bull; {{ cf.fileName }}
              </span>
            </div>
            <button
              type="button"
              class="delete-font-btn"
              (click)="removeCustomFont(cf.id, cf.name)"
            >
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .typography-page-container {
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

    .typo-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-sm);
    }

    .typo-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .typo-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: -0.45rem;
    }

    .pairings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 0.75rem;
    }

    .pairing-card {
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 0.8rem;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .pairing-card:hover {
      border-color: var(--gold-accent);
      background: var(--surface-card);
      transform: translateY(-1px);
    }

    .pairing-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pairing-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .pairing-tag {
      font-size: 0.62rem;
      font-weight: 600;
      color: var(--gold-accent);
    }

    .pairing-sample {
      border-top: 1px solid var(--surface-border);
      padding-top: 0.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .pairing-heading-sample {
      font-size: 1rem;
      color: var(--text-primary);
    }

    .pairing-body-sample {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .apply-pairing-btn {
      margin-top: auto;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--gold-accent);
      background: transparent;
      border: 1px dashed var(--gold-accent);
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm, 4px);
      cursor: pointer;
    }

    .apply-pairing-btn:hover {
      background: var(--gold-light);
    }

    .font-controls-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .font-controls-grid {
        grid-template-columns: 1fr;
      }
    }

    .font-control-item {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .token-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .studio-select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      color: var(--text-primary);
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      outline: none;
    }

    .studio-select:focus {
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 2px var(--gold-ring);
    }

    .slider-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .slider-value {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--gold-accent);
    }

    .studio-slider {
      width: 100%;
      accent-color: var(--gold-accent);
      cursor: pointer;
    }

    .slider-ticks {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
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
      min-width: 75px;
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

    /* Specimen Preview */
    .specimen-card {
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
    }

    .specimen-content {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .specimen-h1 {
      font-family: var(--font-heading, inherit);
      font-weight: var(--font-heading-weight, 700);
      font-size: calc(var(--font-size-base, 16px) * 1.35);
      color: var(--text-primary);
      line-height: 1.25;
    }

    .specimen-h2 {
      font-family: var(--font-heading, inherit);
      font-weight: var(--font-heading-weight, 600);
      font-size: calc(var(--font-size-base, 16px) * 1.05);
      color: var(--gold-accent);
      line-height: 1.3;
    }

    .specimen-body {
      font-family: var(--font-primary, inherit);
      font-weight: var(--font-body-weight, 400);
      font-size: var(--font-size-base, 16px);
      line-height: var(--line-height-base, 1.5);
      letter-spacing: var(--letter-spacing-base, 0);
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    /* Custom Font Upload */
    .upload-card {
      border: 1px dashed var(--surface-border);
    }

    .upload-fields-row {
      display: grid;
      grid-template-columns: 1fr 1fr 120px auto;
      gap: 0.75rem;
      align-items: flex-end;
    }

    @media (max-width: 900px) {
      .upload-fields-row {
        grid-template-columns: 1fr;
      }
    }

    .studio-file-input {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .file-hint {
      font-size: 0.65rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
      display: block;
    }

    .studio-text-input {
      width: 100%;
      padding: 0.45rem 0.65rem;
      font-size: 0.82rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      color: var(--text-primary);
      outline: none;
    }

    .install-btn {
      padding: 0.5rem 0.9rem;
      background: var(--gold-accent);
      color: var(--text-inverse, #ffffff);
      border: none;
      border-radius: var(--radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .install-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .installed-fonts-list {
      border-top: 1px solid var(--surface-border);
      padding-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .installed-fonts-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .custom-font-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 4px);
      padding: 0.45rem 0.75rem;
    }

    .custom-font-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .custom-font-tags {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-left: 0.5rem;
    }

    .delete-font-btn {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm, 4px);
      background: transparent;
      color: var(--status-danger);
      border: 1px solid rgba(220, 38, 38, 0.3);
      cursor: pointer;
    }

    .delete-font-btn:hover {
      background: rgba(220, 38, 38, 0.08);
    }
  `],
})
export class AppearanceTypographyComponent {
  readonly themeService = inject(ThemeService);
  readonly customFontService = inject(CustomFontService);

  @ViewChild('customFontFileInput') customFontFileInput!: ElementRef<HTMLInputElement>;

  readonly builtInFonts = BUILT_IN_FONTS;
  readonly customFonts = this.customFontService.customFonts;
  readonly typography = this.themeService.currentTypography;

  readonly successMessage = signal<string | null>(null);

  // Recommended pairings
  readonly recommendedPairings: RecommendedPairing[] = [
    {
      name: 'Luxury Editorial',
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      headingWeight: 700,
      bodyWeight: 400,
      tag: 'Boutique & Heritage',
    },
    {
      name: 'Executive Hospitality',
      headingFont: 'Cinzel',
      bodyFont: 'Plus Jakarta Sans',
      headingWeight: 600,
      bodyWeight: 400,
      tag: '5-Star Luxury',
    },
    {
      name: 'Modern Clean',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingWeight: 600,
      bodyWeight: 400,
      tag: 'Contemporary Standard',
    },
    {
      name: 'Warm Boutique',
      headingFont: 'Outfit',
      bodyFont: 'DM Sans',
      headingWeight: 600,
      bodyWeight: 400,
      tag: 'Resort & Spa',
    },
    {
      name: 'Classical Heritage',
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Merriweather',
      headingWeight: 700,
      bodyWeight: 400,
      tag: 'Historic Properties',
    },
  ];

  // Custom Font Upload state
  fontUploadName = signal<string>('');
  fontUploadWeight = signal<number>(400);
  fontUploadFile = signal<File | null>(null);
  fontUploadError = signal<string | null>(null);
  isUploadingFont = signal<boolean>(false);

  onHeadingFontChange(font: string): void {
    this.themeService.setTypography({ headingFont: font });
    this.showSuccess(`Heading font set to ${font}.`);
  }

  onBodyFontChange(font: string): void {
    this.themeService.setTypography({ bodyFont: font });
    this.showSuccess(`Body font set to ${font}.`);
  }

  onHeadingWeightChange(weight: number): void {
    this.themeService.setTypography({ headingWeight: weight });
  }

  onBodyWeightChange(weight: number): void {
    this.themeService.setTypography({ bodyWeight: weight });
  }

  onBaseFontSizeChange(size: number): void {
    this.themeService.setTypography({ baseFontSize: size });
  }

  onLineHeightChange(lh: LineHeightOption): void {
    this.themeService.setTypography({ lineHeight: lh });
  }

  onLetterSpacingChange(ls: LetterSpacingOption): void {
    this.themeService.setTypography({ letterSpacing: ls });
  }

  onHeadingScaleChange(scale: HeadingScaleOption): void {
    this.themeService.setTypography({ headingScale: scale });
  }

  applyPairing(pairing: RecommendedPairing): void {
    this.themeService.setTypography({
      headingFont: pairing.headingFont,
      bodyFont: pairing.bodyFont,
      headingWeight: pairing.headingWeight,
      bodyWeight: pairing.bodyWeight,
    });
    this.showSuccess(`Applied "${pairing.name}" font pairing.`);
  }

  onFontFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.fontUploadFile.set(file);
      this.fontUploadError.set(null);

      if (!this.fontUploadName()) {
        const guessedName = file.name
          .replace(/\.(woff2|woff|ttf)$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        this.fontUploadName.set(guessedName);
      }
    }
  }

  async uploadCustomFont(): Promise<void> {
    const file = this.fontUploadFile();
    const name = this.fontUploadName().trim();
    const weight = this.fontUploadWeight();

    if (!file || !name) {
      this.fontUploadError.set('Please select a font file and specify a name.');
      return;
    }

    this.isUploadingFont.set(true);
    this.fontUploadError.set(null);

    try {
      await this.customFontService.saveFont(file, name, weight, 'normal');
      this.fontUploadFile.set(null);
      this.fontUploadName.set('');
      if (this.customFontFileInput) {
        this.customFontFileInput.nativeElement.value = '';
      }
      this.showSuccess(`Custom font "${name}" installed.`);
    } catch (err: any) {
      this.fontUploadError.set(err.message || 'Failed to upload font.');
    } finally {
      this.isUploadingFont.set(false);
    }
  }

  async removeCustomFont(id: string, name: string): Promise<void> {
    try {
      await this.customFontService.removeFont(id);
      this.showSuccess(`Removed font "${name}".`);
    } catch (err: any) {
      this.fontUploadError.set(err.message || 'Could not remove font.');
    }
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

