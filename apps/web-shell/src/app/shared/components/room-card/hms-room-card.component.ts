import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Rich per-room data supplied by the occupancy board API (all optional). */
export interface RoomCardStay {
  confirmationNumber: string;
  arrivalDate: string;
  departureDate: string;
}
export interface RoomCardDetail {
  roomTypeName?: string;
  bedConfiguration?: string | null;
  guestName?: string | null;
  isLoyaltyMember?: boolean;
  stay?: RoomCardStay | null;
  folioBalance?: number | null;
  folioCurrency?: string | null;
  fnbOrders?: number | null;
  fnbTotal?: number | null;
  spaBookings?: number | null;
  spaUpcoming?: number | null;
  maintenanceType?: string | null;
  maintenanceReason?: string | null;
  currency?: string | null;
}

@Component({
  selector: 'hms-room-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hms-room-card" [ngClass]="cardCssClass">
      <div class="hms-room-card__header">
        <div class="room-identity">
          <span class="hms-room-card__number">{{ roomNumber }}</span>
          <span class="hms-room-card__type" *ngIf="detail?.roomTypeName || roomType">{{ detail?.roomTypeName || roomType }}</span>
        </div>
        <span class="status-pill status-pill--{{ occupancyNormalized }}" *ngIf="occupancyKey || detail">
          <span class="dot"></span> {{ occupancyLabel || occupancyKey || statusKey }}
        </span>
        <span class="ready-badge" *ngIf="ready && !detail">Ready</span>
      </div>

      <!-- Bed configuration (from RoomType.bedConfiguration — real domain data) -->
      <div class="bed-row" *ngIf="bedLabel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
          <path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path>
        </svg>
        <span>{{ bedLabel }}</span>
      </div>

      <!-- Guest + stay (real reservation data) -->
      <div class="guest-block" *ngIf="detail?.guestName">
        <div class="guest-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="guest-name">{{ detail!.guestName }}</span>
          <span class="loyalty-tag" *ngIf="detail!.isLoyaltyMember">CRM</span>
        </div>
        <div class="stay-row" *ngIf="detail?.stay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ formatDate(detail!.stay!.arrivalDate) }} &rarr; {{ formatDate(detail!.stay!.departureDate) }}</span>
        </div>
        <div class="checkout-row" *ngIf="detail?.stay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
            <path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>Checkout {{ formatDate(detail!.stay!.departureDate) }}</span>
        </div>
      </div>

      <!-- Services opted (real F&B / spa activity on the reservation) -->
      <div class="services-row" *ngIf="hasServices">
        <span class="service-tag" [class.active-tag]="(detail?.spaBookings ?? 0) > 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17H8v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"></path><line x1="9" y1="21" x2="15" y2="21"></line>
          </svg>
          SPA {{ detail!.spaBookings! > 0 ? '(' + detail!.spaBookings + ')' : '' }}
        </span>
        <span class="service-tag" [class.active-tag]="(detail?.fnbOrders ?? 0) > 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
            <path d="M3 2v7a3 3 0 0 0 6 0V2"></path><path d="M6 2v20"></path><path d="M21 15V2a5 5 0 0 0-5 5v6h5z"></path><path d="M18.5 15v7"></path>
          </svg>
          {{ (detail?.fnbOrders ?? 0) > 0 ? 'F&B (' + detail!.fnbOrders + ')' : 'F&B' }}
        </span>
      </div>

      <!-- Folio / balance indicator -->
      <div class="folio-row" *ngIf="detail?.folioBalance != null">
        <span class="folio-label">Folio</span>
        <span class="folio-amount font-mono">{{ formatMoney(detail!.folioBalance!, detail!.folioCurrency || detail?.currency || '') }}</span>
      </div>

      <!-- Maintenance / OOO indicator -->
      <div class="maintenance-tag" *ngIf="detail?.maintenanceType || (serviceStatus && serviceStatus !== 'IN_SERVICE' && !detail)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-svg" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>{{ maintenanceLabel }}</span>
      </div>

      <!-- Legacy compact status stack (when no rich detail is bound) -->
      <div class="hms-room-card__status-stack" *ngIf="!detail">
        <div class="status-row">
          <span class="status-pill status-pill--{{ housekeepingNormalized }}">
            <span class="dot"></span> {{ statusLabel || statusKey }}
          </span>
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
        gap: 0.5rem;
      }
      .room-identity { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
      .hms-room-card__number {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary, #0f172a);
        font-family: var(--font-mono, monospace);
        letter-spacing: 0.02em;
      }
      .hms-room-card__type { font-size: 0.72rem; color: var(--text-secondary, #64748b); font-weight: 500; }
      .ready-badge {
        font-size: 0.68rem; font-weight: 600;
        background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;
        padding: 0.15rem 0.4rem; border-radius: 4px;
      }
      .hms-room-card__status-stack { display: flex; flex-direction: column; gap: 0.35rem; }
      .status-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
      .status-pill {
        display: inline-flex; align-items: center; gap: 0.25rem;
        font-size: 0.68rem; font-weight: 600;
        padding: 0.2rem 0.5rem; border-radius: 4px;
        letter-spacing: 0.02em; text-transform: uppercase;
      }
      .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
      .status-pill--vacant { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .status-pill--occupied { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
      .status-pill--clean, .status-pill--inspected { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
      .status-pill--dirty { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      .status-pill--cleaning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

      .meta-svg { width: 13px; height: 13px; flex: 0 0 auto; }
      .bed-row, .stay-row, .checkout-row, .guest-row {
        display: inline-flex; align-items: center; gap: 0.35rem;
        font-size: 0.75rem; color: var(--text-secondary, #334155);
      }
      .guest-block {
        display: flex; flex-direction: column; gap: 0.3rem;
        border-top: 1px dashed var(--surface-border-subtle, #f1f5f9);
        padding-top: 0.5rem;
      }
      .guest-name { font-weight: 600; color: var(--text-primary, #0f172a); font-size: 0.8rem; }
      .loyalty-tag {
        font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
        background: var(--gold-light, #fdf8ee); color: var(--gold-dark, #83672e);
        border: 1px solid rgba(154, 123, 56, 0.3);
        padding: 0.05rem 0.3rem; border-radius: 3px;
      }
      .services-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
      .service-tag {
        display: inline-flex; align-items: center; gap: 0.25rem;
        font-size: 0.65rem; font-weight: 600; letter-spacing: 0.04em;
        color: var(--text-muted, #64748b);
        border: 1px solid var(--surface-border, #e2e8f0);
        padding: 0.15rem 0.45rem; border-radius: 4px;
      }
      .service-tag.active-tag {
        color: var(--gold-dark, #83672e);
        background: var(--gold-light, #fdf8ee);
        border-color: rgba(154, 123, 56, 0.35);
      }
      .folio-row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 0.75rem;
        border-top: 1px dashed var(--surface-border-subtle, #f1f5f9);
        padding-top: 0.5rem;
      }
      .folio-label { color: var(--text-muted, #64748b); font-weight: 600; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.05em; }
      .folio-amount { font-weight: 700; color: var(--text-primary, #0f172a); }
      .maintenance-tag {
        display: inline-flex; align-items: center; gap: 0.3rem;
        font-size: 0.65rem; font-weight: 700;
        padding: 0.15rem 0.45rem; border-radius: 4px;
        background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;
        text-transform: uppercase; width: fit-content;
      }
      .hms-room-card__footer {
        display: flex; justify-content: flex-end; align-items: center;
        border-top: 1px solid var(--surface-border-subtle, #f1f5f9);
        padding-top: 0.45rem; margin-top: 0.1rem;
      }
      .click-prompt { font-size: 0.72rem; font-weight: 600; color: var(--gold-accent, #9a7b38); }
      .hms-room-card:hover .click-prompt { color: var(--gold-dark, #7e6328); text-decoration: underline; }
      .hms-room-card--dirty { border-left: 3px solid #dc2626; }
      .hms-room-card--clean { border-left: 3px solid #059669; }
      .hms-room-card--occupied { border-left: 3px solid #2563eb; }
      .hms-room-card--ooo { border-left: 3px solid #ea580c; background: #fffdfc; }
      .tag-svg { width: 13px; height: 13px; display: inline-block; vertical-align: -2px; margin-right: 3px; }
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
  /** Rich occupancy-board data (guest/stay/folio/fnb/spa/bed/maintenance). */
  @Input() detail: RoomCardDetail | null = null;

  get cardCssClass(): string {
    if (this.detail?.maintenanceType) return 'hms-room-card--ooo';
    if (this.statusClass) return 'hms-room-card--' + this.statusClass;
    if (this.serviceStatus === 'OUT_OF_ORDER' || this.serviceStatus === 'OUT_OF_SERVICE') return 'hms-room-card--ooo';
    if (this.detail?.guestName || this.occupancyKey === 'OCCUPIED') return 'hms-room-card--occupied';
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

  get bedLabel(): string {
    const bed = this.detail?.bedConfiguration;
    if (!bed) return '';
    return bed;
  }

  get hasServices(): boolean {
    return (this.detail?.spaBookings ?? 0) > 0 || (this.detail?.fnbOrders ?? 0) > 0;
  }

  get maintenanceLabel(): string {
    if (this.detail?.maintenanceType) {
      const reason = this.detail.maintenanceReason ? ` — ${this.detail.maintenanceReason}` : '';
      return `${this.detail.maintenanceType}${reason}`;
    }
    if (this.serviceStatus === 'OUT_OF_ORDER') return 'OUT OF ORDER';
    if (this.serviceStatus === 'OUT_OF_SERVICE') return 'OUT OF SERVICE';
    return this.serviceStatus;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  formatMoney(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }
}
