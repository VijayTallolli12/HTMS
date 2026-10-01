import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Canonical HMS offcanvas used for CREATE / EDIT / INSPECT / CONFIGURE / ASSIGN
 * flows. Provides a titled (optionally subtitled) header, scrollable body,
 * sticky footer, dialog accessibility semantics, Esc-to-close, focus trapping
 * with auto-focus and restore, and an optional loading state.
 */
@Component({
  selector: 'hms-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-drawer-backdrop" (click)="onBackdropClick()" role="presentation"></div>
    <div
      #panel
      class="hms-drawer hms-drawer--{{ width }}"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="subtitle ? subtitleId : null"
      (keydown)="onKeydown($event)"
    >
      <div class="hms-drawer__header">
        <div class="hms-drawer__heading">
          <h3 class="hms-drawer__title" [id]="titleId">{{ title }}</h3>
          <p class="hms-drawer__subtitle" *ngIf="subtitle" [id]="subtitleId">{{ subtitle }}</p>
        </div>
        <button type="button" class="hms-modal__close" (click)="onClose()" aria-label="Close panel">
          &times;
        </button>
      </div>
      <div class="hms-drawer__body">
        <div class="hms-drawer__loading" *ngIf="loading" role="status" aria-live="polite">
          <span class="hms-drawer__spinner" aria-hidden="true"></span>
          <span>{{ loadingText }}</span>
        </div>
        <ng-content></ng-content>
      </div>
      <div class="hms-drawer__footer" *ngIf="showFooter">
        <ng-content select="[hmsDrawerFooter]"></ng-content>
      </div>
    </div>
  `,
  styles: [],
})
export class HmsDrawerComponent implements OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showFooter = false;
  @Input() width: DrawerWidth = 'md';
  @Input() loading = false;
  @Input() loadingText = 'Loading…';
  /** Close when the backdrop is clicked. Disable for forms with unsaved input. */
  @Input() dismissOnBackdrop = true;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  readonly titleId = 'hms-drawer-title';
  readonly subtitleId = 'hms-drawer-subtitle';

  private previouslyFocused: HTMLElement | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.installListener();
    // setTimeout (not rAF) so this also runs when the tab is hidden.
    setTimeout(() => this.focusInitial(), 0);
  }

  ngOnDestroy(): void {
    this.releaseListener();
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
  }

  private focusInitial(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel).focus();
  }

  private installListener(): void {
    this.releaseListener();
    this.keydownListener = (e: KeyboardEvent) => this.onDocumentKeydown(e);
    document.addEventListener('keydown', this.keydownListener, true);
  }

  private releaseListener(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }
  }

  private onDocumentKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.onClose();
      return;
    }
    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onKeydown(e: KeyboardEvent): void {
    // Reserved for consumer-side handling; panel-level keys bubble to document.
    e.stopPropagation();
  }

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (this.dismissOnBackdrop) {
      this.closed.emit();
    }
  }
}
