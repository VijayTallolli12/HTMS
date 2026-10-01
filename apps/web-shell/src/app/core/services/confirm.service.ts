import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export type ConfirmVariant = 'danger' | 'primary';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

/**
 * Application-wide replacement for the native `confirm()` dialog. Renders a
 * single, accessible HMS modal (mounted once in the app shell) so destructive
 * mutations never depend on the browser's unstyled, non-themeable prompt.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly state = signal<ConfirmRequest | null>(null);
  readonly request = this.state.asReadonly();

  confirm(options: ConfirmOptions): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      this.state.set({
        options,
        resolve: (result: boolean) => {
          subscriber.next(result);
          subscriber.complete();
        },
      });
    });
  }

  /** Convenience wrapper for destructive actions (delete / deactivate). */
  confirmDanger(title: string, message: string, confirmLabel = 'Confirm'): Observable<boolean> {
    return this.confirm({ title, message, confirmLabel, variant: 'danger' });
  }

  resolve(result: boolean): void {
    const current = this.state();
    this.state.set(null);
    current?.resolve(result);
  }
}
