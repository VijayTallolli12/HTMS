import { Component, Input, Output, EventEmitter, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-alert hms-alert--{{ type }}" *ngIf="hasMessage">
      <span class="hms-alert__icon" aria-hidden="true">{{ resolvedIcon }}</span>
      <span class="hms-alert__message">{{ message }}<ng-content></ng-content></span>
      <button class="hms-alert__close" (click)="onClose()" *ngIf="dismissible" aria-label="Dismiss alert">×</button>
    </div>
  `,
  styles: [],
})
export class HmsAlertComponent {
  @Input() type = 'error';
  @Input() icon = '';
  @Input() message = '';
  @Input() dismissible = true;
  @Output() closed = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  get hasMessage(): boolean {
    if (this.message && this.message.trim().length > 0) {
      return true;
    }
    const text = this.el?.nativeElement?.textContent?.trim() || '';
    return text.length > 0 && text !== '×' && text !== '!' && text !== '✓' && text !== 'i';
  }

  get resolvedIcon(): string {
    if (this.icon) {
      return this.icon;
    }

    const mapping: Record<string, string> = {
      success: '✓',
      info: 'i',
      warning: '!',
      error: '!',
    };

    return mapping[this.type] || '!';
  }

  onClose(): void {
    this.closed.emit();
    this.dismiss.emit();
  }
}
