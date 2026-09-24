import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hms-room-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-room-card" [ngClass]="cardCssClass">
      <div class="hms-room-card__header">
        <div class="room-identity">
          <span class="hms-room-card__number">ROOM {{ roomNumber }}</span>
          <span class="hms-room-card__type" *ngIf="roomType">{{ roomType }}</span>
        </div>
        <span class="ready-badge" *ngIf="ready">✓ Ready</span>
      </div>

      <div class="hms-room-card__status-stack">
        <div class="status-row">
          <span class="status-pill status-pill--{{ occupancyNormalized }}">
            <span class="dot"></span> {{ occupancyLabel || occupancyKey }}
          </span>
          <span class="status-pill status-pill--{{ housekeepingNormalized }}">
            {{ housekeepingIcon }} {{ statusLabel || statusKey }}
          </span>
        </div>
        <div class="maintenance-tag" *ngIf="serviceStatus && serviceStatus !== 'IN_SERVICE'">
          🔧 {{ serviceLabel }}
        </div>
      </div>

      <div class="hms-room-card__footer">
        <span class="click-prompt">Manage &rarr;</span>
      </div>
    </div>
  `,
  styles: [
    `
      .hms-room-card {
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: 8px;
        padding: 0.85rem 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.65rem;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        min-height: 125px;
      }
      .hms-room-card:hover {
        border-color: var(--gold-accent, #9a7b38);
        box-shadow: 0 4px 12px rgba(154, 123, 56, 0.12);
        transform: translateY(-1px);
      }
      .hms-room-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .room-identity {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .hms-room-card__number {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary, #0f172a);
        font-family: var(--font-mono, monospace);
        letter-spacing: 0.02em;
      }
      .hms-room-card__type {
        font-size: 0.72rem;
        color: var(--text-secondary, #64748b);
        font-weight: 500;
      }
      .ready-badge {
        font-size: 0.68rem;
        font-weight: 600;
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
      }
      .hms-room-card__status-stack {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .status-pill .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .status-pill--vacant {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
      }
      .status-pill--occupied {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
      .status-pill--clean, .status-pill--inspected {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }
      .status-pill--dirty {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      .status-pill--cleaning {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
      .maintenance-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.65rem;
        font-weight: 700;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        background: #fff7ed;
        color: #c2410c;
        border: 1px solid #ffedd5;
        text-transform: uppercase;
        width: fit-content;
      }
      .hms-room-card__footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        border-top: 1px solid var(--surface-border-subtle, #f1f5f9);
        padding-top: 0.45rem;
        margin-top: 0.1rem;
      }
      .click-prompt {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--gold-accent, #9a7b38);
        transition: color 0.15s ease;
      }
      .hms-room-card:hover .click-prompt {
        color: var(--gold-dark, #7e6328);
        text-decoration: underline;
      }
      .hms-room-card--dirty {
        border-left: 3px solid #dc2626;
      }
      .hms-room-card--clean {
        border-left: 3px solid #059669;
      }
      .hms-room-card--occupied {
        border-left: 3px solid #2563eb;
      }
      .hms-room-card--ooo {
        border-left: 3px solid #ea580c;
        background: #fffdfc;
      }
    `,
  ],
})
export class HmsRoomCardComponent {
  @Input() roomNumber = '';
  @Input() roomType = '';
  @Input() statusClass = '';
  @Input() statusKey = '';
  @Input() statusLabel = '';
  @Input() occupancyKey = '';
  @Input() occupancyLabel = '';
  @Input() serviceStatus = 'IN_SERVICE';
  @Input() ready = false;

  get cardCssClass(): string {
    if (this.statusClass) return 'hms-room-card--' + this.statusClass;
    if (this.serviceStatus === 'OUT_OF_ORDER' || this.serviceStatus === 'OUT_OF_SERVICE') return 'hms-room-card--ooo';
    if (this.occupancyKey === 'OCCUPIED') return 'hms-room-card--occupied';
    if (this.statusKey === 'DIRTY') return 'hms-room-card--dirty';
    if (this.statusKey === 'CLEAN' || this.statusKey === 'INSPECTED') return 'hms-room-card--clean';
    return '';
  }

  get occupancyNormalized(): string {
    return (this.occupancyKey || '').toLowerCase();
  }

  get housekeepingNormalized(): string {
    return (this.statusKey || '').toLowerCase();
  }

  get housekeepingIcon(): string {
    const k = this.statusKey;
    if (k === 'CLEAN' || k === 'INSPECTED') return '✓';
    if (k === 'DIRTY') return '⚠';
    if (k === 'CLEANING') return '🧹';
    return '●';
  }

  get serviceLabel(): string {
    if (this.serviceStatus === 'OUT_OF_ORDER') return 'OUT OF ORDER';
    if (this.serviceStatus === 'OUT_OF_SERVICE') return 'OUT OF SERVICE';
    return this.serviceStatus;
  }
}
