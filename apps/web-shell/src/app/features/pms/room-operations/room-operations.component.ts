import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  RoomStatusDto,
  HousekeepingStatus,
  FloorDto,
} from '@hms/api-contracts';

@Component({
  selector: 'app-room-operations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room-operations.component.html',
  styleUrls: ['./room-operations.component.css'],
})
export class RoomOperationsComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly rooms = signal<RoomStatusDto[]>([]);
  readonly filteredRooms = signal<RoomStatusDto[]>([]);
  readonly floors = signal<FloorDto[]>([]);

  // Filters
  selectedStatusFilter = signal<string>('ALL');
  selectedFloorId = signal<string>('ALL');

  // Command Panel State
  selectedRoom = signal<RoomStatusDto | null>(null);
  isUpdating = signal<boolean>(false);
  transitionReason = '';

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadRoomOperations(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadRoomOperations(prop.id);
    }
  }

  loadRoomOperations(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getRoomOperationsRooms(propertyId).subscribe({
      next: (res) => {
        const roomList = res.data || [];
        this.rooms.set(roomList);
        this.applyFilters();

        this.orgService.getFloors().subscribe({
          next: (flRes) => {
            this.floors.set(flRes.data || []);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
          },
        });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load rooms.');
        this.isLoading.set(false);
      },
    });
  }

  setStatusFilter(filter: string): void {
    this.selectedStatusFilter.set(filter);
    this.applyFilters();
  }

  onFloorFilterChange(floorId: string): void {
    this.selectedFloorId.set(floorId);
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.rooms()];
    const status = this.selectedStatusFilter();

    if (status === 'VACANT_CLEAN') {
      result = result.filter(
        (r) =>
          (r.effective?.occupancyStatus === 'VACANT' || r.occupancyStatus === 'VACANT') &&
          (r.effective?.housekeepingStatus === 'CLEAN' ||
            r.effective?.housekeepingStatus === 'INSPECTED' ||
            r.housekeepingStatus === 'CLEAN' ||
            r.housekeepingStatus === 'INSPECTED') &&
          (r.effective?.serviceStatus === 'IN_SERVICE' || r.serviceStatus === 'IN_SERVICE'),
      );
    } else if (status === 'VACANT_DIRTY') {
      result = result.filter(
        (r) =>
          (r.effective?.occupancyStatus === 'VACANT' || r.occupancyStatus === 'VACANT') &&
          (r.effective?.housekeepingStatus === 'DIRTY' || r.housekeepingStatus === 'DIRTY'),
      );
    } else if (status === 'OCCUPIED') {
      result = result.filter(
        (r) => r.effective?.occupancyStatus === 'OCCUPIED' || r.occupancyStatus === 'OCCUPIED',
      );
    } else if (status === 'MAINTENANCE') {
      result = result.filter(
        (r) =>
          r.effective?.serviceStatus === 'OUT_OF_ORDER' ||
          r.effective?.serviceStatus === 'OUT_OF_SERVICE' ||
          r.serviceStatus === 'OUT_OF_ORDER' ||
          r.serviceStatus === 'OUT_OF_SERVICE',
      );
    }

    this.filteredRooms.set(result);
  }

  openRoomCommand(room: RoomStatusDto): void {
    this.selectedRoom.set(room);
    this.transitionReason = '';
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  closeRoomCommand(): void {
    this.selectedRoom.set(null);
  }

  changeHousekeepingStatus(newStatus: HousekeepingStatus): void {
    const prop = this.activeProperty();
    const room = this.selectedRoom();
    if (!prop || !room) return;

    this.isUpdating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi
      .updateRoomHousekeepingStatus(prop.id, room.roomId, {
        housekeepingStatus: newStatus,
        reason: this.transitionReason.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isUpdating.set(false);
          const updatedRoom = res.data;
          this.selectedRoom.set(updatedRoom);

          // Update in rooms array
          const updatedList = this.rooms().map((r) =>
            r.roomId === updatedRoom.roomId ? updatedRoom : r,
          );
          this.rooms.set(updatedList);
          this.applyFilters();

          this.successMessage.set(
            `Room ${updatedRoom.roomNumber} housekeeping status changed to ${newStatus}.`,
          );
        },
        error: (err) => {
          this.isUpdating.set(false);
          this.errorMessage.set(
            err?.error?.message || err?.error?.detail || 'Status transition failed.',
          );
        },
      });
  }
}
