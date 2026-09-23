import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-drawer-backdrop" (click)="onBackdropClick()"></div>
    <div class="hms-drawer">
      <div class="hms-drawer__header">
        <h3 class="hms-drawer__title">{{ title }}</h3>
        <button class="hms-modal__close" (click)="onClose()">&times;</button>
      </div>
      <div class="hms-drawer__body">
        <ng-content></ng-content>
      </div>
      <div class="hms-drawer__footer" *ngIf="showFooter">
        <ng-content select="[hmsDrawerFooter]"></ng-content>
      </div>
    </div>
  `,
  styles: [],
})
export class HmsDrawerComponent {
  @Input() title = '';
  @Input() showFooter = false;
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.closed.emit();
  }
}
