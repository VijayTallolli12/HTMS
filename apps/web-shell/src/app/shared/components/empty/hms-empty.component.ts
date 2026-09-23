import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-empty',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-empty">
      <div class="hms-empty__icon" *ngIf="icon">{{ icon }}</div>
      <div class="hms-empty__title">{{ title }}</div>
      <div class="hms-empty__desc">{{ desc }}</div>
      <button class="hms-btn hms-btn--gold hms-btn--sm" (click)="onAction()" *ngIf="actionLabel">
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: [],
})
export class HmsEmptyComponent {
  @Input() icon = '📋';
  @Input() title = 'No data found';
  @Input() desc = 'There are no items matching the current criteria.';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();

  onAction(): void {
    this.action.emit();
  }
}
