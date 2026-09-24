import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      class="hms-btn hms-btn--{{ variant }}"
      [class.hms-btn--sm]="size === 'sm'"
      [class.hms-btn--lg]="size === 'lg'"
      [class.hms-btn--block]="block"
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [],
})
export class HmsButtonComponent {
  @Input() type = 'button';
  @Input() variant = 'outline';
  @Input() size = 'md';
  @Input() block = false;
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.clicked.emit(event);
    }
  }
}
