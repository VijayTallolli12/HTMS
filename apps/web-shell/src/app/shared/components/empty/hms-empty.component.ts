import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-empty',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-empty">
      <div class="hms-empty__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="empty-svg" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <div class="hms-empty__title">{{ title }}</div>
      <div class="hms-empty__desc">{{ desc }}</div>
      <button class="hms-btn hms-btn--gold hms-btn--sm" (click)="onAction()" *ngIf="actionLabel">
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: [`
    .empty-svg {
      width: 36px;
      height: 36px;
      color: var(--text-muted, #94a3b8);
      margin: 0 auto;
      display: block;
    }
  `],
})
export class HmsEmptyComponent {
  @Input() icon = '';
  @Input() title = 'No data found';
  @Input() desc = 'There are no items matching the current criteria.';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();

  onAction(): void {
    this.action.emit();
  }
}
