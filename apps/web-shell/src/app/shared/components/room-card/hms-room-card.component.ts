import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-room-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-room-card" [ngClass]="statusClass ? 'hms-room-card--' + statusClass : ''">
      <div class="hms-room-card__top">
        <span class="hms-room-card__number">{{ roomNumber }}</span>
        <span class="hms-room-card__status" *ngIf="ready">✓ Ready</span>
      </div>
      <div class="hms-room-card__status">
        <span class="hms-status-pill hms-status-pill--{{ statusKey }}">
          {{ statusLabel }}
        </span>
        <span class="hms-status-pill hms-status-pill--{{ occupancyKey }}">
          {{ occupancyLabel }}
        </span>
      </div>
      <div class="hms-room-card__footer">
        <span *ngIf="serviceStatus !== 'IN_SERVICE'">{{ serviceStatus }}</span>
        <span>Click to manage →</span>
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
