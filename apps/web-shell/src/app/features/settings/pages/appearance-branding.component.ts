import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationBrandingService } from '../../../core/services/application-branding.service';
import { HmsAlertComponent, HmsBrandLogoComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-branding',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsAlertComponent, HmsBrandLogoComponent],
  template: `
    <div class="branding-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="header-titles">
          <div class="eyebrow-badge">BRANDING</div>
          <h1 class="section-title">Application Branding</h1>
          <p class="section-desc">
            Configure the enterprise product identity, logos, and favicons displayed throughout the HMS.
          </p>
        </div>

        <div class="header-actions">
          <button type="button" class="reset-btn" (click)="resetBrandingDefaults()">
            Reset to Default
          </button>
        </div>
      </header>

      <!-- Feedback Notifications -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>
      <hms-alert type="error" *ngIf="errorMessage()" (closed)="errorMessage.set(null)">
        {{ errorMessage() }}
      </hms-alert>

      <!-- 1. Enterprise Product Identity -->
      <section class="branding-card">
        <h2 class="branding-card-title">Enterprise Product Identity</h2>
        <p class="branding-card-desc">
          Universal platform titles consumed by topbars, authentication lockups, footers, and tab titles.
        </p>

        <div class="branding-form-grid">
          <div class="branding-field">
            <label for="brandingAppName" class="field-label">Application Name</label>
            <input
              id="brandingAppName"
              type="text"
              class="branding-input"
              [(ngModel)]="brandingEdit.applicationName"
              (ngModelChange)="onBrandingChange()"
              placeholder="e.g. Folkslogic HTMS"
              maxlength="40"
            />
            <span class="field-hint">Default: Folkslogic HTMS</span>
          </div>

          <div class="branding-field">
            <label for="brandingAppSub" class="field-label">Application Subtitle</label>
            <input
              id="brandingAppSub"
              type="text"
              class="branding-input"
              [(ngModel)]="brandingEdit.applicationSubtitle"
              (ngModelChange)="onBrandingChange()"
              placeholder="e.g. Hotel Management System"
              maxlength="50"
            />
            <span class="field-hint">Default: Hotel Management System</span>
          </div>

          <div class="branding-field">
            <label for="brandingShortName" class="field-label">Short Name</label>
            <input
              id="brandingShortName"
              type="text"
              class="branding-input"
              [(ngModel)]="brandingEdit.shortName"
              (ngModelChange)="onBrandingChange()"
              placeholder="e.g. HTMS"
              maxlength="15"
            />
            <span class="field-hint">Default: HTMS (used in compact contexts)</span>
          </div>

          <!-- Brand Mark Controls -->
          <div class="branding-field">
            <label class="field-label">Fallback Brand Mark</label>
            <div class="mark-preview-row">
              <div class="mark-preview-badge" aria-label="Brand Mark Preview">
                {{ branding.brandMark() }}
              </div>
              <span class="field-hint">
                {{ brandingEdit.useCustomBrandMark ? 'Using custom brand mark override.' : 'Automatically generated from application name.' }}
              </span>
            </div>

            <!-- Custom Brand Mark Toggle -->
            <div class="custom-mark-toggle-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [(ngModel)]="brandingEdit.useCustomBrandMark"
                  (ngModelChange)="onBrandingChange()"
                />
                <span>Use custom brand mark</span>
              </label>

              <input
                *ngIf="brandingEdit.useCustomBrandMark"
                type="text"
                class="branding-input compact-input"
                [(ngModel)]="brandingEdit.customBrandMark"
                (ngModelChange)="onBrandingChange()"
                placeholder="FH"
                maxlength="4"
                aria-label="Custom brand mark (2-4 characters)"
              />
            </div>
          </div>
        </div>

        <!-- Live Branding Lockup Preview -->
        <div class="preview-box-wrapper">
          <span class="preview-tag">LIVE BRANDING LOCKUP PREVIEW</span>
          <div class="branding-preview-box">
            <hms-brand-logo variant="full" size="lg"></hms-brand-logo>
          </div>
        </div>
      </section>

      <!-- 2. Brand Assets (Logo & Favicon) -->
      <section class="branding-card">
        <h2 class="branding-card-title">Brand Assets</h2>
        <p class="branding-card-desc">
          Upload custom visual assets for high-resolution displays, email receipts, and browser tabs.
        </p>

        <div class="assets-grid">
          <!-- Application Logo Card -->
          <div class="asset-card">
            <div class="asset-header">
              <div class="asset-title-group">
                <h3 class="asset-title">Application Logo</h3>
                <span class="asset-badge" [class.badge-active]="branding.logoAsset() !== null">
                  {{ branding.logoAsset() ? 'Custom Upload' : 'Dynamic Fallback' }}
                </span>
              </div>
              <span class="asset-spec">SVG, PNG, WebP, JPG (Max 2MB)</span>
            </div>

            <div class="asset-preview-container">
              <ng-container *ngIf="branding.logoAsset() as logo; else noLogo">
                <div class="logo-display-box">
                  <img [src]="logo.dataUrl" [alt]="branding.applicationName()" class="logo-preview-img" />
                </div>
                <div class="asset-meta-info">
                  <div class="meta-row">
                    <span class="meta-key">File:</span>
                    <span class="meta-val">{{ logo.fileName }}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-key">Status:</span>
                    <span class="meta-val status-active">Active</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-key">Size:</span>
                    <span class="meta-val">{{ formatBytes(logo.fileSize) }}</span>
                  </div>
                </div>
              </ng-container>

              <ng-template #noLogo>
                <div class="fallback-display-box">
                  <div class="fallback-crest">{{ branding.brandMark() }}</div>
                  <span class="fallback-note">Using dynamic fallback mark</span>
                </div>
              </ng-template>
            </div>

            <div class="asset-actions">
              <input
                #logoInput
                type="file"
                class="hidden-file-input"
                accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
                (change)="onLogoSelected($event)"
              />
              <button
                type="button"
                class="asset-btn primary-action"
                (click)="logoInput.click()"
              >
                {{ branding.logoAsset() ? 'Replace Logo' : 'Upload Logo' }}
              </button>
              <button
                type="button"
                class="asset-btn danger-action"
                *ngIf="branding.logoAsset()"
                (click)="onRemoveLogo()"
              >
                Remove Logo
              </button>
            </div>
          </div>

          <!-- Favicon Card -->
          <div class="asset-card">
            <div class="asset-header">
              <div class="asset-title-group">
                <h3 class="asset-title">Favicon</h3>
                <span class="asset-badge" [class.badge-active]="branding.faviconAsset() !== null">
                  {{ branding.faviconAsset() ? 'Custom Upload' : 'Dynamic Fallback' }}
                </span>
              </div>
              <span class="asset-spec">SVG, PNG, ICO (Max 512KB)</span>
            </div>

            <div class="asset-preview-container">
              <ng-container *ngIf="branding.faviconAsset() as fav; else noFavicon">
                <div class="favicon-display-box">
                  <img [src]="fav.dataUrl" alt="Favicon preview" class="favicon-preview-img" />
                </div>
                <div class="asset-meta-info">
                  <div class="meta-row">
                    <span class="meta-key">File:</span>
                    <span class="meta-val">{{ fav.fileName }}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-key">Status:</span>
                    <span class="meta-val status-active">Active</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-key">Size:</span>
                    <span class="meta-val">{{ formatBytes(fav.fileSize) }}</span>
                  </div>
                </div>
              </ng-container>

              <ng-template #noFavicon>
                <div class="fallback-display-box">
                  <div class="favicon-fallback-badge">{{ branding.brandMark() }}</div>
                  <span class="fallback-note">Using dynamic theme-aware favicon</span>
                </div>
              </ng-template>
            </div>

            <div class="asset-actions">
              <input
                #faviconInput
                type="file"
                class="hidden-file-input"
                accept=".svg,.png,.ico,image/svg+xml,image/png,image/x-icon,image/vnd.microsoft.icon"
                (change)="onFaviconSelected($event)"
              />
              <button
                type="button"
                class="asset-btn primary-action"
                (click)="faviconInput.click()"
              >
                {{ branding.faviconAsset() ? 'Replace Favicon' : 'Upload Favicon' }}
              </button>
              <button
                type="button"
                class="asset-btn danger-action"
                *ngIf="branding.faviconAsset()"
                (click)="onRemoveFavicon()"
              >
                Remove Favicon
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .branding-page-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      width: 100%;
      box-sizing: border-box;
    }

    .section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 1rem;
      flex-wrap: wrap;
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

    .reset-btn {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--gold-accent);
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm, 4px);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .reset-btn:hover {
      background: var(--surface-raised);
      border-color: var(--gold-accent);
    }

    .branding-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: var(--shadow-sm);
    }

    .branding-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .branding-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: -0.5rem;
    }

    .branding-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .branding-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .field-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .branding-input {
      width: 100%;
      padding: 0.55rem 0.75rem;
      font-size: 0.88rem;
      color: var(--text-primary);
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 6px);
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s ease;
    }

    .branding-input:focus {
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 2px var(--gold-ring);
    }

    .compact-input {
      width: 80px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-align: center;
      padding: 0.35rem 0.5rem;
    }

    .field-hint {
      font-size: 0.68rem;
      color: var(--text-muted);
      line-height: 1.3;
    }

    .mark-preview-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .mark-preview-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--navy-primary, #0f172a);
      border: 1px solid var(--gold-accent, #9a7b38);
      color: var(--gold-accent, #9a7b38);
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.06em;
      border-radius: var(--radius-sm, 6px);
      flex-shrink: 0;
    }

    .custom-mark-toggle-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.4rem;
    }

    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.76rem;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
    }

    .preview-box-wrapper {
      border-top: 1px solid var(--surface-border);
      padding-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .preview-tag {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .branding-preview-box {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.4rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      max-width: 440px;
    }

    /* Brand Assets Cards */
    .assets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.25rem;
    }

    .asset-card {
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .asset-header {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .asset-title-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .asset-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .asset-badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
      background: var(--surface-raised);
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
    }

    .asset-badge.badge-active {
      background: var(--gold-light, #fdf8ee);
      color: var(--gold-dark, #83672d);
      border-color: rgba(154, 123, 56, 0.3);
    }

    .asset-spec {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .asset-preview-container {
      min-height: 120px;
      background: var(--surface-card);
      border: 1px dashed var(--surface-border);
      border-radius: var(--radius-sm, 6px);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      box-sizing: border-box;
    }

    .logo-display-box {
      max-height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-preview-img {
      max-height: 60px;
      max-width: 180px;
      object-fit: contain;
    }

    .favicon-display-box {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .favicon-preview-img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }

    .fallback-display-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .fallback-crest {
      width: 44px;
      height: 44px;
      background: var(--navy-primary, #0f172a);
      border: 1px solid var(--gold-accent, #9a7b38);
      color: var(--gold-accent, #9a7b38);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.06em;
      border-radius: var(--radius-sm, 6px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .favicon-fallback-badge {
      width: 32px;
      height: 32px;
      background: var(--navy-primary, #0f172a);
      border: 1px solid var(--gold-accent, #9a7b38);
      color: var(--gold-accent, #9a7b38);
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      border-radius: var(--radius-sm, 6px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fallback-note {
      font-size: 0.68rem;
      color: var(--text-muted);
    }

    .asset-meta-info {
      width: 100%;
      border-top: 1px solid var(--surface-border-subtle);
      padding-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
    }

    .meta-key {
      color: var(--text-muted);
    }

    .meta-val {
      color: var(--text-secondary);
      font-weight: 500;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta-val.status-active {
      color: var(--color-success, #059669);
      font-weight: 600;
    }

    .asset-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .hidden-file-input {
      display: none;
    }

    .asset-btn {
      flex: 1;
      padding: 0.45rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      border-radius: var(--radius-sm, 4px);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
      border: 1px solid transparent;
    }

    .asset-btn.primary-action {
      background: var(--surface-card);
      border-color: var(--surface-border);
      color: var(--text-primary);
    }

    .asset-btn.primary-action:hover {
      background: var(--surface-raised);
      border-color: var(--gold-accent);
      color: var(--gold-accent);
    }

    .asset-btn.danger-action {
      background: rgba(225, 29, 72, 0.05);
      border-color: rgba(225, 29, 72, 0.2);
      color: #e11d48;
    }

    .asset-btn.danger-action:hover {
      background: rgba(225, 29, 72, 0.12);
      border-color: #e11d48;
    }
  `],
})
export class AppearanceBrandingComponent {
  readonly branding = inject(ApplicationBrandingService);

  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('faviconInput') faviconInputRef!: ElementRef<HTMLInputElement>;

  brandingEdit = {
    applicationName: this.branding.applicationName(),
    applicationSubtitle: this.branding.applicationSubtitle(),
    shortName: this.branding.shortName(),
    useCustomBrandMark: this.branding.useCustomBrandMark(),
    customBrandMark: this.branding.customBrandMark(),
  };

  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  onBrandingChange(): void {
    this.branding.updateBranding({
      applicationName: this.brandingEdit.applicationName,
      applicationSubtitle: this.brandingEdit.applicationSubtitle,
      shortName: this.brandingEdit.shortName,
      useCustomBrandMark: this.brandingEdit.useCustomBrandMark,
      customBrandMark: this.brandingEdit.customBrandMark,
    });
  }

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.errorMessage.set(null);
      await this.branding.uploadLogo(file);
      this.showSuccess(`Custom logo "${file.name}" uploaded successfully.`);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to upload logo.');
    } finally {
      input.value = '';
    }
  }

  async onRemoveLogo(): Promise<void> {
    try {
      await this.branding.removeLogo();
      this.showSuccess('Logo removed. Restored dynamic brand mark.');
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to remove logo.');
    }
  }

  async onFaviconSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.errorMessage.set(null);
      await this.branding.uploadFavicon(file);
      this.showSuccess(`Custom favicon "${file.name}" uploaded and applied.`);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to upload favicon.');
    } finally {
      input.value = '';
    }
  }

  async onRemoveFavicon(): Promise<void> {
    try {
      await this.branding.removeFavicon();
      this.showSuccess('Custom favicon removed. Restored generated favicon.');
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to remove favicon.');
    }
  }

  async resetBrandingDefaults(): Promise<void> {
    await this.branding.resetToDefault();
    this.brandingEdit = {
      applicationName: this.branding.applicationName(),
      applicationSubtitle: this.branding.applicationSubtitle(),
      shortName: this.branding.shortName(),
      useCustomBrandMark: this.branding.useCustomBrandMark(),
      customBrandMark: this.branding.customBrandMark(),
    };
    this.showSuccess('Restored all branding configurations and assets to defaults.');
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
