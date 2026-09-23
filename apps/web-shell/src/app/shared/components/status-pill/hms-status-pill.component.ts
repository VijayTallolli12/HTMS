import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { STATUS_TOKENS } from '@hms/ui';

@Component({
  selector: 'hms-status-pill',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="hms-status-pill"
      [style.color]="token.color"
      [style.background]="token.backgroundColor"
      [style.borderColor]="token.borderColor"
      [attr.aria-label]="statusLabel || token.ariaLabel"
    >
      <span class="hms-status-pill__icon">{{ statusIcon || token.icon }}</span>
      {{ statusLabel || token.label }}
    </span>
  `,
  styles: [],
})
export class HmsStatusPillComponent {
  @Input() statusKey = 'PENDING';
  @Input() statusLabel = '';
  @Input() statusIcon = '';

  get token() {
    const normalized = this.statusKey.toUpperCase();
    return STATUS_TOKENS[normalized] ?? STATUS_TOKENS.WARNING;
  }
}
