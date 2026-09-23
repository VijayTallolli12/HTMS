import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-alert hms-alert--{{ type }}">
      <span class="hms-alert__icon" aria-hidden="true">{{ resolvedIcon }}</span>
      <span class="hms-alert__message"><ng-content></ng-content></span>
      <button class="hms-alert__close" (click)="onClose()" *ngIf="dismissible" aria-label="Dismiss alert">×</button>
    </div>
  `,
  styles: [],
})
export class HmsAlertComponent {
  @Input() type = 'error';
  @Input() icon = '';
  @Input() dismissible = true;
  @Output() closed = new EventEmitter<void>();

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
  }
}
