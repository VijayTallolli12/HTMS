import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-modal-backdrop" (click)="onBackdropClick()">
      <div class="hms-modal" [class.hms-modal--wide]="wide">
        <div class="hms-modal__header">
          <h3 class="hms-modal__title">{{ title }}</h3>
          <button class="hms-modal__close" (click)="onClose()">&times;</button>
        </div>
        <div class="hms-modal__body">
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
export class HmsModalComponent {
  @Input() title = '';
  @Input() wide = false;
  @Input() showFooter = true;
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.closed.emit();
  }
}
