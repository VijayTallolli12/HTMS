import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomTypeDto, CreateRoomTypeRequest } from '@hms/api-contracts';
import { PmsApiService } from '../services/pms-api.service';
import { OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'hms-room-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pms-container">
      <div class="header">
        <h2>PMS — Room Types Management</h2>
        <p class="subtitle">
          Configure room classes, occupancies, bed layouts, and initialize 365-day inventory
        </p>
      </div>

      <div *ngIf="errorMessage()" class="alert alert-danger">{{ errorMessage() }}</div>
      <div *ngIf="successMessage()" class="alert alert-success">{{ successMessage() }}</div>

      <div class="actions-bar">
        <button class="btn btn-primary" (click)="openCreateModal()">+ Add Room Type</button>
        <button class="btn btn-secondary" (click)="loadRoomTypes()">Refresh</button>
      </div>

      <div *ngIf="isLoading()" class="loading-state">Loading room types...</div>

      <div *ngIf="!isLoading()" class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Class</th>
              <th>Occupancy (Base/Max)</th>
              <th>Adults / Children</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let rt of roomTypes()">
              <td>
                <strong>{{ rt.code }}</strong>
              </td>
              <td>{{ rt.name }}</td>
              <td>
                <span class="badge">{{ rt.roomClass }}</span>
              </td>
              <td>{{ rt.baseOccupancy }} / {{ rt.maxOccupancy }}</td>
              <td>{{ rt.maxAdults }}A / {{ rt.maxChildren }}C</td>
              <td>
                <span [class]="rt.isActive ? 'badge-active' : 'badge-inactive'">
                  {{ rt.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <button class="btn btn-sm btn-outline-danger" (click)="deleteRoomType(rt.id)">
                  Deactivate
                </button>
              </td>
            </tr>
            <tr *ngIf="roomTypes().length === 0">
              <td colspan="7" class="empty-text">
                No room types found. Create your first room type to begin.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Simple Create Modal -->
      <div *ngIf="showModal()" class="modal-backdrop">
        <div class="modal-card">
          <h3>Create Room Type</h3>
          <div class="form-group">
            <label>Code</label>
            <input
              type="text"
              [(ngModel)]="newCode"
              placeholder="e.g. DLX-K"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              [(ngModel)]="newName"
              placeholder="e.g. Deluxe King Suite"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label>Room Class</label>
            <input
              type="text"
              [(ngModel)]="newRoomClass"
              placeholder="e.g. DELUXE"
              class="form-control"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Base Occupancy</label>
              <input type="number" [(ngModel)]="newBaseOccupancy" class="form-control" min="1" />
            </div>
            <div class="form-group">
              <label>Max Occupancy</label>
              <input type="number" [(ngModel)]="newMaxOccupancy" class="form-control" min="1" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Max Adults</label>
              <input type="number" [(ngModel)]="newMaxAdults" class="form-control" min="1" />
            </div>
            <div class="form-group">
              <label>Max Children</label>
              <input type="number" [(ngModel)]="newMaxChildren" class="form-control" min="0" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveRoomType()">
              Save & Initialize Inventory
            </button>
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
      .alert-success {
        background: #dcfce7;
        color: #15803d;
      }
      .actions-bar {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
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
      .btn-secondary {
        background: #e2e8f0;
        color: #334155;
      }
      .btn-sm {
        padding: 4px 10px;
        font-size: 12px;
      }
      .btn-outline-danger {
        background: transparent;
        border-color: #ef4444;
        color: #ef4444;
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
      .badge {
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      .badge-active {
        background: #dcfce7;
        color: #166534;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      .badge-inactive {
        background: #f1f5f9;
        color: #64748b;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      .empty-text {
        text-align: center;
        color: #94a3b8;
        padding: 32px;
      }
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-card {
        background: #fff;
        padding: 24px;
        border-radius: 10px;
        width: 440px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      .form-group {
        margin-bottom: 14px;
      }
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #475569;
        margin-bottom: 4px;
      }
      .form-control {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 14px;
      }
      .form-row {
        display: flex;
        gap: 12px;
      }
      .form-row .form-group {
        flex: 1;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class RoomTypesComponent implements OnInit {
  private readonly pmsApi = inject(PmsApiService);
  private readonly orgService = inject(OrganizationService);

  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showModal = signal(false);

  // Form fields
  newCode = '';
  newName = '';
  newRoomClass = 'STANDARD';
  newBaseOccupancy = 2;
  newMaxOccupancy = 3;
  newMaxAdults = 2;
  newMaxChildren = 1;

  get currentPropertyId(): string {
    return this.orgService.activePropertyContext()?.id || '00000000-0000-7000-0000-000000000001';
  }

  ngOnInit() {
    this.loadRoomTypes();
  }

  loadRoomTypes() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.pmsApi.getRoomTypes(this.currentPropertyId, true).subscribe({
      next: (res) => {
        this.roomTypes.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Failed to load room types');
        this.isLoading.set(false);
      },
    });
  }

  openCreateModal() {
    this.newCode = '';
    this.newName = '';
    this.newRoomClass = 'STANDARD';
    this.newBaseOccupancy = 2;
    this.newMaxOccupancy = 3;
    this.newMaxAdults = 2;
    this.newMaxChildren = 1;
    this.showModal.set(true);
  }

  saveRoomType() {
    const dto: CreateRoomTypeRequest = {
      code: this.newCode.trim().toUpperCase(),
      name: this.newName.trim(),
      roomClass: this.newRoomClass.trim().toUpperCase(),
      baseOccupancy: this.newBaseOccupancy,
      maxOccupancy: this.newMaxOccupancy,
      maxAdults: this.newMaxAdults,
      maxChildren: this.newMaxChildren,
      bedConfiguration: [{ type: 'KING', count: 1 }],
      amenities: ['WIFI', 'AC'],
    };

    this.pmsApi.createRoomType(this.currentPropertyId, dto).subscribe({
      next: () => {
        this.successMessage.set(
          'Room type created successfully with 365-day inventory initialization',
        );
        this.showModal.set(false);
        this.loadRoomTypes();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Failed to create room type');
      },
    });
  }

  deleteRoomType(id: string) {
    if (!confirm('Are you sure you want to deactivate/delete this room type?')) return;
    this.pmsApi.deleteRoomType(this.currentPropertyId, id).subscribe({
      next: () => {
        this.successMessage.set('Room type deleted successfully');
        this.loadRoomTypes();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Failed to delete room type');
      },
    });
  }
}
