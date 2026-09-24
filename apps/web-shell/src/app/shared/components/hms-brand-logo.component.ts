import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationBrandingService } from '../../core/services/application-branding.service';

@Component({
  selector: 'hms-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="hms-brand-lockup"
      [class.variant-compact]="variant === 'compact'"
      [class.variant-full]="variant === 'full'"
      [class.size-sm]="size === 'sm'"
      [class.size-md]="size === 'md'"
      [class.size-lg]="size === 'lg'"
    >
      <!-- Logo Asset or Fallback Brand Mark -->
      <div class="hms-brand-visual" [attr.role]="logoAsset ? null : 'img'" [attr.aria-label]="logoAsset ? null : applicationName">
        <ng-container *ngIf="logoAsset; else fallbackMark">
          <img
            [src]="logoAsset.dataUrl"
            [alt]="applicationName"
            class="hms-brand-logo-img"
          />
        </ng-container>

        <ng-template #fallbackMark>
          <div class="hms-fallback-mark">
            <span class="mark-chars">{{ brandMark }}</span>
          </div>
        </ng-template>
      </div>

      <!-- Textual Brand Lockup (Shown only in 'full' variant) -->
      <div class="hms-brand-text" *ngIf="variant === 'full'">
        <span class="hms-brand-title">{{ applicationName }}</span>
        <span class="hms-brand-subtitle" *ngIf="showSubtitle && applicationSubtitle">
          {{ applicationSubtitle }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      vertical-align: middle;
    }

    .hms-brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      user-select: none;
    }

    .hms-brand-lockup.variant-compact {
      gap: 0;
    }

    .hms-brand-visual {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    /* Fallback Brand Mark Badge */
    .hms-fallback-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--navy-primary, #0f172a);
      border: 1px solid var(--gold-accent, #9a7b38);
      color: var(--gold-accent, #9a7b38);
      font-family: var(--font-body, system-ui, -apple-system, sans-serif);
      font-weight: 700;
      letter-spacing: 0.06em;
      border-radius: var(--radius-sm, 6px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
      line-height: 1;
    }

    .hms-brand-logo-img {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: var(--radius-sm, 4px);
    }

    /* Size variants */
    .size-sm .hms-fallback-mark,
    .size-sm .hms-brand-visual {
      width: 28px;
      height: 28px;
    }
    .size-sm .mark-chars {
      font-size: 0.72rem;
    }

    .size-md .hms-fallback-mark,
    .size-md .hms-brand-visual {
      width: 34px;
      height: 34px;
    }
    .size-md .mark-chars {
      font-size: 0.85rem;
    }

    .size-lg .hms-fallback-mark,
    .size-lg .hms-brand-visual {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md, 8px);
    }
    .size-lg .mark-chars {
      font-size: 1.05rem;
      letter-spacing: 0.08em;
    }

    /* Brand typography */
    .hms-brand-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.1rem;
      min-width: 0;
      text-align: left;
    }

    .hms-brand-title {
      font-family: var(--font-heading, system-ui, -apple-system, sans-serif);
      font-weight: 700;
      color: var(--text-primary, #0f172a);
      line-height: 1.2;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hms-brand-subtitle {
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--text-muted, #64748b);
      line-height: 1.2;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .size-sm .hms-brand-title {
      font-size: 0.88rem;
    }
    .size-sm .hms-brand-subtitle {
      font-size: 0.65rem;
    }

    .size-md .hms-brand-title {
      font-size: 0.95rem;
    }
    .size-md .hms-brand-subtitle {
      font-size: 0.7rem;
    }

    .size-lg .hms-brand-title {
      font-size: 1.25rem;
      letter-spacing: 0.04em;
    }
    .size-lg .hms-brand-subtitle {
      font-size: 0.82rem;
    }
  `],
})
export class HmsBrandLogoComponent {
  private readonly brandingService = inject(ApplicationBrandingService);

  @Input() variant: 'full' | 'compact' = 'full';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showSubtitle: boolean = true;

  get logoAsset() {
    return this.brandingService.logoAsset();
  }

  get brandMark(): string {
    return this.brandingService.brandMark();
  }

  get applicationName(): string {
    return this.brandingService.applicationName();
  }

  get applicationSubtitle(): string {
    return this.brandingService.applicationSubtitle();
  }
}
