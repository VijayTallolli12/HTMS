import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationBrandingService } from '../../../core/services/application-branding.service';
import { HmsAlertComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-branding',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsAlertComponent],
  template: `
    <div class="branding-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="header-titles">
          <div class="eyebrow-badge">BRANDING</div>
          <h1 class="section-title">Application Branding</h1>
          <p class="section-desc">
            Configure the enterprise product identity and subtitles displayed throughout the HMS.
          </p>
        </div>

        <div class="header-actions">
          <button type="button" class="reset-btn" (click)="resetBrandingDefaults()">
            Reset to Default
          </button>
        </div>
      </header>

      <!-- Success Notification -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>

      <!-- Branding Form Card -->
      <section class="branding-card">
        <h2 class="branding-card-title">Enterprise Product Identity</h2>
        <p class="branding-card-desc">
          These names are consumed universally by the global topbar, authentication lockups, and reporting footers.
        </p>

        <div class="branding-form-row">
          <div class="branding-field">
            <label for="brandingAppName" class="token-label">Application Name</label>
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
            <label for="brandingAppSub" class="token-label">Application Subtitle</label>
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
        </div>

        <!-- Live Branding Lockup Preview -->
        <div class="preview-box-wrapper">
          <span class="preview-tag">LIVE BRANDING LOCKUP PREVIEW</span>
          <div class="branding-preview-box">
            <div class="branding-preview-crest">{{ branding.logoMark() }}</div>
            <div class="branding-preview-meta">
              <span class="branding-preview-title">{{ branding.applicationName() }}</span>
              <span class="branding-preview-sub">{{ branding.applicationSubtitle() }}</span>
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
      gap: 1.25rem;
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

    .branding-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 640px) {
      .branding-form-row {
        grid-template-columns: 1fr;
      }
    }

    .branding-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .token-label {
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
    }

    .branding-input:focus {
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 2px var(--gold-ring);
    }

    .field-hint {
      font-size: 0.68rem;
      color: var(--text-muted);
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
      padding: 0.85rem 1.25rem;
      background: var(--surface-root);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      max-width: 380px;
    }

    .branding-preview-crest {
      background: var(--gold-accent);
      color: var(--text-inverse, #ffffff);
      font-weight: 800;
      font-size: 0.88rem;
      letter-spacing: 0.05em;
      padding: 0.4rem 0.6rem;
      border-radius: var(--radius-sm, 4px);
      line-height: 1;
      flex-shrink: 0;
    }

    .branding-preview-meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .branding-preview-title {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .branding-preview-sub {
      font-size: 0.72rem;
      color: var(--text-muted);
      letter-spacing: 0.02em;
      line-height: 1.2;
    }
  `],
})
export class AppearanceBrandingComponent {
  readonly branding = inject(ApplicationBrandingService);

  brandingEdit = {
    applicationName: this.branding.applicationName(),
    applicationSubtitle: this.branding.applicationSubtitle(),
  };

  readonly successMessage = signal<string | null>(null);

  onBrandingChange(): void {
    this.branding.updateBranding({
      applicationName: this.brandingEdit.applicationName,
      applicationSubtitle: this.brandingEdit.applicationSubtitle,
    });
  }

  resetBrandingDefaults(): void {
    this.branding.resetToDefault();
    this.brandingEdit = {
      applicationName: this.branding.applicationName(),
      applicationSubtitle: this.branding.applicationSubtitle(),
    };
    this.showSuccess('Restored branding to defaults.');
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

