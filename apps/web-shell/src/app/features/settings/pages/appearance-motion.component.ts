import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeService,
  MotionPreferenceOption,
  MotionIntensityOption,
  TransitionSpeedOption,
  MotionStyleOption,
} from '../../../core/services/theme.service';
import { HmsAlertComponent } from '../../../shared/index';

@Component({
  selector: 'app-appearance-motion',
  standalone: true,
  imports: [CommonModule, HmsAlertComponent],
  template: `
    <div class="motion-page-container">
      <!-- Page Header -->
      <header class="section-header">
        <div class="eyebrow-badge">MOTION</div>
        <h1 class="section-title">Motion Kinetics</h1>
        <p class="section-desc">
          Control transitions and animation behavior across the interface while maintaining vestibular comfort.
        </p>
      </header>

      <!-- Success Notification -->
      <hms-alert type="success" *ngIf="successMessage()" (closed)="successMessage.set(null)">
        {{ successMessage() }}
      </hms-alert>

      <!-- Section 1: Motion Preference -->
      <section class="motion-card">
        <h2 class="motion-card-title">Motion Preference</h2>
        <p class="motion-card-desc">Governs global animation behaviors across navigation, modals, and tooltips.</p>

        <div class="choice-group">
          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="motion().preference === 'full'"
            (click)="onPreferenceChange('full')"
          >
            <span class="choice-title">Full Motion</span>
            <span class="choice-desc">Rich micro-interactions and smooth layout transitions (Standard)</span>
          </button>

          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="motion().preference === 'reduced'"
            (click)="onPreferenceChange('reduced')"
          >
            <span class="choice-title">Reduced Motion</span>
            <span class="choice-desc">Gentle fade transitions only; zero sliding or panning motions</span>
          </button>

          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="motion().preference === 'minimal'"
            (click)="onPreferenceChange('minimal')"
          >
            <span class="choice-title">Minimal</span>
            <span class="choice-desc">Instant cuts with subtle color state changes</span>
          </button>

          <button
            type="button"
            class="choice-btn"
            [class.is-selected]="motion().preference === 'none'"
            (click)="onPreferenceChange('none')"
          >
            <span class="choice-title">None (Instant Cut)</span>
            <span class="choice-desc">All transitions execute at 0ms duration for high-volume data dispatch</span>
          </button>
        </div>
      </section>

      <!-- Section 2: Motion Style (Easing Curve) -->
      <section class="motion-card">
        <h2 class="motion-card-title">Motion Style &amp; Easing Curve</h2>
        <div class="segmented-control">
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().style === 'subtle'"
            (click)="onStyleChange('subtle')"
          >
            Subtle (Ease-Out)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().style === 'professional'"
            (click)="onStyleChange('professional')"
          >
            Professional (Cubic Bezier)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().style === 'smooth'"
            (click)="onStyleChange('smooth')"
          >
            Smooth (Ease-In-Out)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().style === 'expressive'"
            (click)="onStyleChange('expressive')"
          >
            Expressive (Snappy)
          </button>
        </div>
      </section>

      <!-- Section 3: Transition Speed Multiplier -->
      <section class="motion-card">
        <h2 class="motion-card-title">Transition Speed Multiplier</h2>
        <div class="segmented-control">
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().speed === 'fast'"
            (click)="onSpeedChange('fast')"
          >
            Fast (0.75x)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().speed === 'normal'"
            (click)="onSpeedChange('normal')"
          >
            Normal (1.0x)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().speed === 'slow'"
            (click)="onSpeedChange('slow')"
          >
            Slow (1.5x)
          </button>
        </div>
      </section>

      <!-- Section 4: Animation Intensity -->
      <section class="motion-card">
        <h2 class="motion-card-title">Animation Intensity</h2>
        <div class="segmented-control">
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().intensity === 'subtle'"
            (click)="onIntensityChange('subtle')"
          >
            Subtle (0.15s)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().intensity === 'balanced'"
            (click)="onIntensityChange('balanced')"
          >
            Balanced (0.25s)
          </button>
          <button
            type="button"
            class="segment-btn"
            [class.is-active]="motion().intensity === 'expressive'"
            (click)="onIntensityChange('expressive')"
          >
            Expressive (0.35s)
          </button>
        </div>
      </section>

      <!-- Section 5: Live Interactive Motion Tester -->
      <section class="motion-card test-card">
        <div class="test-header">
          <div>
            <h2 class="motion-card-title">Live Motion Kinetic Test</h2>
            <p class="motion-card-desc">Click below to test the kinetic response curve with your active speed and easing parameters.</p>
          </div>
          <button type="button" class="trigger-btn" (click)="triggerMotionTest()">
            Trigger Motion
          </button>
        </div>

        <div class="test-canvas">
          <div class="test-sample-chip" [class.is-animating]="isTesting()">
            <span>Kinetic Chip</span>
          </div>
        </div>
      </section>

      <!-- Section 6: Operational Guarantee Note -->
      <div class="guarantee-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shield-icon" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <p>
          <strong>Operational Guarantee:</strong> Mission-critical hospitality flows (Guest Check-In, Room Dispatch, Billing, and Folio Settlement) never utilize blocking or decorative animation delays. OS-level <code>prefers-reduced-motion</code> is always respected.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .motion-page-container {
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

    .motion-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-sm);
    }

    .motion-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .motion-card-desc {
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
      min-width: 85px;
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

    /* Test Box */
    .test-card {
      background: var(--surface-root);
    }

    .test-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .trigger-btn {
      padding: 0.45rem 0.9rem;
      background: var(--gold-accent);
      color: var(--text-inverse, #ffffff);
      border: none;
      border-radius: var(--radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .trigger-btn:hover {
      background: var(--gold-hover);
    }

    .test-canvas {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 6px);
    }

    .test-sample-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1.25rem;
      border-radius: var(--radius-md, 8px);
      background: var(--gold-light);
      color: var(--gold-dark);
      font-size: 0.82rem;
      font-weight: 700;
      border: 1px solid rgba(154, 123, 56, 0.4);
      transition: transform var(--transition-speed, 200ms) var(--transition-timing, ease),
                  box-shadow var(--transition-speed, 200ms) var(--transition-timing, ease);
    }

    .test-sample-chip.is-animating {
      transform: scale(1.18) translateY(-6px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
    }

    /* Guarantee Box */
    .guarantee-box {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      background: var(--surface-raised);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm, 6px);
      padding: 0.85rem 1rem;
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.45;
    }

    .shield-icon {
      width: 18px;
      height: 18px;
      color: var(--gold-accent);
      flex-shrink: 0;
      margin-top: 0.1rem;
    }
  `],
})
export class AppearanceMotionComponent {
  readonly themeService = inject(ThemeService);
  readonly motion = this.themeService.currentMotion;

  readonly successMessage = signal<string | null>(null);
  readonly isTesting = signal<boolean>(false);

  onPreferenceChange(preference: MotionPreferenceOption): void {
    this.themeService.setMotion({ preference });
    this.showSuccess(`Motion preference set to ${preference}.`);
  }

  onStyleChange(style: MotionStyleOption): void {
    this.themeService.setMotion({ style });
    this.showSuccess(`Motion style set to ${style}.`);
  }

  onSpeedChange(speed: TransitionSpeedOption): void {
    this.themeService.setMotion({ speed });
    this.showSuccess(`Transition speed set to ${speed}.`);
  }

  onIntensityChange(intensity: MotionIntensityOption): void {
    this.themeService.setMotion({ intensity });
    this.showSuccess(`Motion intensity set to ${intensity}.`);
  }

  triggerMotionTest(): void {
    this.isTesting.set(true);
    setTimeout(() => {
      this.isTesting.set(false);
    }, 600);
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

