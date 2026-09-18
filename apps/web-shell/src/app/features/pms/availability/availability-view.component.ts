import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyInventoryDto, StayQuoteResponse } from '@hms/api-contracts';
import { PmsApiService } from '../services/pms-api.service';
import { OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'hms-availability-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pms-container">
      <div class="header">
        <h2>PMS — Daily Inventory Calendar & Stay Quotes</h2>
        <p class="subtitle">
          Authoritative ATS Calculation Engine, Stop-Sells, and Multi-Day Restriction Quotes
        </p>
      </div>

      <div *ngIf="errorMessage()" class="alert alert-danger">{{ errorMessage() }}</div>

      <!-- Tab Selection -->
      <div class="tabs">
        <button [class.active]="activeTab() === 'calendar'" (click)="activeTab.set('calendar')">
          Inventory & ATS Calendar
        </button>
        <button [class.active]="activeTab() === 'quote'" (click)="activeTab.set('quote')">
          Stay Quote Evaluator
        </button>
      </div>

      <!-- Calendar Tab -->
      <div *ngIf="activeTab() === 'calendar'" class="tab-content">
        <div class="filter-card">
          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input type="date" [(ngModel)]="calendarStartDate" class="form-control" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input type="date" [(ngModel)]="calendarEndDate" class="form-control" />
            </div>
            <div class="form-group" style="align-self: flex-end;">
              <button class="btn btn-primary" (click)="loadCalendar()">Query Calendar</button>
            </div>
          </div>
        </div>

        <div *ngIf="isLoading()" class="loading-state">Loading calendar records...</div>

        <div *ngIf="!isLoading()" class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Room Type ID</th>
                <th>Total Rooms</th>
                <th>Out of Order</th>
                <th>Blocked</th>
                <th>Booked</th>
                <th>Overbooking</th>
                <th>ATS (Sellable)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of calendarRecords()">
                <td>
                  <strong>{{ item.businessDate }}</strong>
                </td>
                <td>
                  <code>{{ item.roomTypeId }}</code>
                </td>
                <td>{{ item.totalRooms }}</td>
                <td>{{ item.outOfOrderCount }}</td>
                <td>{{ item.blockedCount }}</td>
                <td>{{ item.bookedCount }}</td>
                <td>{{ item.overbookingLimit }}</td>
                <td>
                  <span class="ats-badge" [class.ats-zero]="item.ats === 0">
                    {{ item.ats }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="calendarRecords().length === 0">
                <td colspan="8" class="empty-text">
                  No inventory ledger rows found for this date range.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Quote Tab -->
      <div *ngIf="activeTab() === 'quote'" class="tab-content">
        <div class="filter-card">
          <div class="form-row">
            <div class="form-group">
              <label>Arrival Date</label>
              <input type="date" [(ngModel)]="quoteArrivalDate" class="form-control" />
            </div>
            <div class="form-group">
              <label>Departure Date</label>
              <input type="date" [(ngModel)]="quoteDepartureDate" class="form-control" />
            </div>
            <div class="form-group">
              <label>Adults</label>
              <input type="number" [(ngModel)]="quoteAdults" min="1" class="form-control" />
            </div>
            <div class="form-group">
              <label>Children</label>
              <input type="number" [(ngModel)]="quoteChildren" min="0" class="form-control" />
            </div>
            <div class="form-group" style="align-self: flex-end;">
              <button class="btn btn-primary" (click)="loadQuote()">Calculate Stay Quote</button>
            </div>
          </div>
        </div>

        <div *ngIf="isLoading()" class="loading-state">Evaluating restrictions & rates...</div>

        <div *ngIf="!isLoading() && quoteResult()" class="quote-results">
          <h3>Stay Quote: {{ quoteResult()?.lengthOfStay }} Night(s)</h3>
          <div class="quote-grid">
            <div
              *ngFor="let opt of quoteResult()?.options"
              class="quote-card"
              [class.rejected]="!opt.isAvailable"
            >
              <div class="card-header">
                <h4>{{ opt.ratePlanName }} ({{ opt.ratePlanCode }})</h4>
                <span class="room-type-tag">{{ opt.roomTypeName }}</span>
              </div>
              <div class="card-body">
                <div *ngIf="opt.isAvailable" class="price-section">
                  <div class="total-price">{{ opt.currency }} {{ opt.totalAmount }}</div>
                  <div class="rates-breakdown">
                    <span *ngFor="let nr of opt.nightlyRates" class="nightly-rate">
                      {{ nr.date }}: {{ nr.amount }}
                    </span>
                  </div>
                </div>
                <div *ngIf="!opt.isAvailable" class="rejection-section">
                  <span class="badge-rejected">UNAVAILABLE</span>
                  <p class="rejection-reason">Reason: {{ opt.rejectionReason }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .pms-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .header h2 {
        margin: 0 0 6px 0;
        font-size: 24px;
        color: #1e293b;
      }
      .subtitle {
        margin: 0 0 20px 0;
        color: #64748b;
        font-size: 14px;
      }
      .alert {
        padding: 12px 16px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 14px;
      }
      .alert-danger {
        background: #fee2e2;
        color: #b91c1c;
      }
      .tabs {
        display: flex;
        gap: 8px;
        border-bottom: 2px solid #e2e8f0;
        margin-bottom: 20px;
      }
      .tabs button {
        padding: 10px 18px;
        border: none;
        background: transparent;
        font-size: 15px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
      }
      .tabs button.active {
        color: #2563eb;
        border-bottom-color: #2563eb;
      }
      .filter-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      .form-row {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #475569;
        margin-bottom: 4px;
      }
      .form-control {
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 14px;
      }
      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn-primary {
        background: #2563eb;
        color: #fff;
      }
      .table-responsive {
        overflow-x: auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 14px;
      }
      .table th,
      .table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
      }
      .table th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
      }
      .ats-badge {
        background: #dcfce7;
        color: #166534;
        padding: 3px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 13px;
      }
      .ats-badge.ats-zero {
        background: #fee2e2;
        color: #991b1b;
      }
      .quote-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .quote-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      .quote-card.rejected {
        opacity: 0.75;
        background: #f8fafc;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .card-header h4 {
        margin: 0;
        font-size: 16px;
        color: #1e293b;
      }
      .room-type-tag {
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .total-price {
        font-size: 22px;
        font-weight: 700;
        color: #059669;
        margin-bottom: 8px;
      }
      .rates-breakdown {
        font-size: 12px;
        color: #64748b;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .badge-rejected {
        background: #fecaca;
        color: #b91c1c;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .rejection-reason {
        font-size: 13px;
        color: #dc2626;
        margin-top: 6px;
      }
      .empty-text {
        text-align: center;
        color: #94a3b8;
        padding: 32px;
      }
    `,
  ],
})
export class AvailabilityViewComponent implements OnInit {
  private readonly pmsApi = inject(PmsApiService);
  private readonly orgService = inject(OrganizationService);

  readonly activeTab = signal<'calendar' | 'quote'>('calendar');
  readonly calendarRecords = signal<DailyInventoryDto[]>([]);
  readonly quoteResult = signal<StayQuoteResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Calendar query fields
  calendarStartDate = '2026-10-01';
  calendarEndDate = '2026-10-15';

  // Quote query fields
  quoteArrivalDate = '2026-10-01';
  quoteDepartureDate = '2026-10-04';
  quoteAdults = 2;
  quoteChildren = 0;

  get currentPropertyId(): string {
    return this.orgService.activePropertyContext()?.id || '00000000-0000-7000-0000-000000000001';
  }

  ngOnInit() {
    this.loadCalendar();
  }

  loadCalendar() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.pmsApi
      .getInventoryCalendar(this.currentPropertyId, this.calendarStartDate, this.calendarEndDate)
      .subscribe({
        next: (res) => {
          this.calendarRecords.set(res.data || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.detail || 'Failed to load inventory calendar');
          this.isLoading.set(false);
        },
      });
  }

  loadQuote() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.pmsApi
      .getStayQuote(
        this.currentPropertyId,
        this.quoteArrivalDate,
        this.quoteDepartureDate,
        this.quoteAdults,
        this.quoteChildren,
      )
      .subscribe({
        next: (res) => {
          this.quoteResult.set(res.data || null);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.detail || 'Failed to evaluate stay quote');
          this.isLoading.set(false);
        },
      });
  }
}
