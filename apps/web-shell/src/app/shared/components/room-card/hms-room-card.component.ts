import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HmsStatusPillComponent } from '../status-pill/hms-status-pill.component';

@Component({
  selector: 'hms-room-card',
  standalone: true,
  imports: [CommonModule, HmsStatusPillComponent],
  template: `
    <div class="hms-room-card" [ngClass]="statusClass ? 'hms-room-card--' + statusClass : ''">
      <div class="hms-room-card__top">
        <span class="hms-room-card__number">{{ roomNumber }}</span>
        <span class="ready-indicator" *ngIf="ready">✓ Ready</span>
      </div>
      <div class="hms-room-card__status">
        <hms-status-pill [statusKey]="statusKey" [statusLabel]="statusLabel"></hms-status-pill>
        <hms-status-pill [statusKey]="occupancyKey" [statusLabel]="occupancyLabel"></hms-status-pill>
      </div>
      <div class="hms-room-card__footer">
        <span *ngIf="serviceStatus !== 'IN_SERVICE'" class="service-tag">{{ serviceStatus }}</span>
        <span class="click-prompt">Manage &rarr;</span>
      </div>
    </div>
  `,
  styles: [],
})
export class HmsRoomCardComponent {
  @Input() roomNumber = '';
  @Input() statusClass = '';
  @Input() statusKey = '';
  @Input() statusLabel = '';
  @Input() occupancyKey = '';
  @Input() occupancyLabel = '';
  @Input() serviceStatus = 'IN_SERVICE';
  @Input() ready = false;
}
