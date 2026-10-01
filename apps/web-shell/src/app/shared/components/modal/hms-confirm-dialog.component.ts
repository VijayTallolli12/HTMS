import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../core/services/confirm.service';

/**
 * Single, globally-mounted host for {@link ConfirmService}. Renders the active
 * confirmation request inside the canonical HMS modal shell with dialog
 * semantics: Esc cancels, backdrop click cancels, focus is trapped and
 * restored, and the destructive action is visually distinct.
 */
@Component({
  selector: 'hms-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="hms-modal-backdrop"
      *ngIf="confirm.request() as req"
      (click)="onCancel()"
      role="presentation"
    >
      <div
        #dialog
        class="hms-modal hms-confirm"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="messageId"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <div class="hms-modal__header">
          <h3 class="hms-modal__title" [id]="titleId">{{ req.options.title }}</h3>
        </div>
        <div class="hms-modal__body">
          <p class="hms-confirm__message" [id]="messageId">{{ req.options.message }}</p>
        </div>
        <div class="hms-modal__footer">
          <button
            type="button"
            class="hms-btn hms-btn--outline"
            (click)="onCancel()"
          >
            {{ req.options.cancelLabel || 'Cancel' }}
          </button>
          <button
            type="button"
            class="hms-btn"
            [class.hms-btn--danger]="req.options.variant === 'danger'"
            [class.hms-btn--primary]="req.options.variant !== 'danger'"
            (click)="onConfirm()"
          >
            {{ req.options.confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .hms-confirm {
        max-width: 440px;
      }
      .hms-confirm__message {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.55;
      }
    `,
  ],
})
export class HmsConfirmDialogComponent implements OnDestroy {
  readonly confirm = inject(ConfirmService);

  @ViewChild('dialog') dialogRef?: ElementRef<HTMLElement>;

  readonly titleId = 'hms-confirm-title';
  readonly messageId = 'hms-confirm-message';

  private previouslyFocused: HTMLElement | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private lastSeen: object | null = null;

  constructor() {
    effect(() => {
      const req = this.confirm.request();
      if (req && req !== this.lastSeen) {
        this.lastSeen = req;
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        this.installListener();
        // Defer past Angular's render of the *ngIf dialog. setTimeout (not
        // requestAnimationFrame) is used because rAF is paused in hidden tabs.
        setTimeout(() => this.focusInitial(), 0);
      } else if (!req && this.lastSeen) {
        this.lastSeen = null;
        this.releaseListener();
        this.previouslyFocused?.focus?.();
        this.previouslyFocused = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseListener();
  }

  private focusInitial(): void {
    const dialog = this.dialogRef?.nativeElement ?? document.querySelector<HTMLElement>('.hms-confirm');
    if (!dialog) return;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    if (buttons.length === 0) return;
    // Destructive dialogs default-focus Cancel to avoid accidental confirmation.
    const target =
      this.confirm.request()?.options.variant === 'danger'
        ? buttons[0]
        : buttons[buttons.length - 1];
    target.focus();
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
    if (!this.confirm.request()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.onCancel();
      return;
    }
    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusables = this.dialogRef?.nativeElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !this.dialogRef?.nativeElement.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onKeydown(e: KeyboardEvent): void {
    // Enter activates the focused button natively; nothing extra required.
    if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
      e.preventDefault();
      this.onConfirm();
    }
  }

  onConfirm(): void {
    this.confirm.resolve(true);
  }

  onCancel(): void {
    this.confirm.resolve(false);
  }
}
