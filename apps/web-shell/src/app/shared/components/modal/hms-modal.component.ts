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

/**
 * Canonical HMS centered dialog used for CREATE / EDIT / INSPECT / CONFIGURE /
 * ASSIGN flows. Provides a titled (optionally subtitled) header, scrollable
 * body, sticky footer, dialog accessibility semantics, Esc-to-close, focus
 * trapping with auto-focus and restore, and an optional loading state.
 */
@Component({
  selector: 'hms-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-modal-backdrop" (click)="onBackdropClick()" role="presentation">
      <div
        #panel
        class="hms-modal"
        [class.hms-modal--wide]="wide"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="subtitle ? subtitleId : null"
        (click)="$event.stopPropagation()"
      >
        <div class="hms-modal__header">
          <div class="hms-modal__heading">
            <h3 class="hms-modal__title" [id]="titleId">{{ title }}</h3>
            <p class="hms-modal__subtitle" *ngIf="subtitle" [id]="subtitleId">{{ subtitle }}</p>
          </div>
          <button type="button" class="hms-modal__close" (click)="onClose()" aria-label="Close dialog">
            &times;
          </button>
        </div>
        <div class="hms-modal__body">
          <div class="hms-modal__loading" *ngIf="loading" role="status" aria-live="polite">
            <span class="hms-modal__spinner" aria-hidden="true"></span>
            <span>{{ loadingText }}</span>
          </div>
          <ng-content></ng-content>
        </div>
        <div class="hms-modal__footer" *ngIf="showFooter">
          <ng-content select="[hmsModalFooter]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class HmsModalComponent implements OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() wide = false;
  @Input() showFooter = true;
  @Input() loading = false;
  @Input() loadingText = 'Loading…';
  /** Close when the backdrop is clicked. Disable for forms with unsaved input. */
  @Input() dismissOnBackdrop = true;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  readonly titleId = 'hms-modal-title';
  readonly subtitleId = 'hms-modal-subtitle';

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

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (this.dismissOnBackdrop) {
      this.closed.emit();
    }
  }
}
