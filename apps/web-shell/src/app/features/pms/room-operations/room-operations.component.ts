import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  HmsDataTableComponent,
  HmsAlertComponent,
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsEmptyComponent,
  HmsLoadingComponent,
  HmsModalComponent,
  HmsRoomCardComponent,
} from '../../../shared/index';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  RoomStatusDto,
  HousekeepingStatus,
  FloorDto,
  OccupancyBoard,
  OccupancyRoomCard,
} from '@hms/api-contracts';
import { RoomCardDetail } from '../../../shared/components/room-card/hms-room-card.component';

@Component({
  selector: 'app-room-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsDataTableComponent, HmsAlertComponent, HmsButtonComponent, HmsStatusPillComponent, HmsEmptyComponent, HmsLoadingComponent, HmsModalComponent, HmsRoomCardComponent],
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

  /** Rich occupancy cards from the board API (real guest/stay/folio/F&B/spa data). */
  readonly board = signal<OccupancyBoard | null>(null);
  readonly boardCards = signal<Map<string, OccupancyRoomCard>>(new Map());

  selectedStatusFilter = signal<string>('ALL');
  selectedFloorId = signal<string>('ALL');

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

    // Occupancy board powers the rich cards; room status list powers filters.
    this.pmsApi.getOccupancyBoard(propertyId).subscribe({
      next: (res) => {
        this.board.set(res.data);
        const map = new Map<string, OccupancyRoomCard>();
        for (const card of res.data.rooms) map.set(card.roomId, card);
        this.boardCards.set(map);
      },
      error: () => {
        // Board is an enhancement; the status list alone still renders cards.
      },
    });

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

  /** Rich board data for a room, used by the enhanced room card. */
  boardCardFor(roomId: string): OccupancyRoomCard | null {
    return this.boardCards().get(roomId) ?? null;
  }

  /** Maps a board card to the shared room card detail shape. */
  boardCardDetail(room: RoomStatusDto): RoomCardDetail | null {
    const card = this.boardCardFor(room.roomId);
    if (!card) return null;
    return {
      roomTypeName: card.roomType.name,
      bedConfiguration: this.bedLabelFor(card),
      guestName: card.guest?.name ?? null,
      isLoyaltyMember: card.guest?.isLoyaltyMember ?? false,
      stay: card.stay ? { confirmationNumber: card.stay.confirmationNumber, arrivalDate: card.stay.arrivalDate, departureDate: card.stay.departureDate } : null,
      folioBalance: card.folio?.balance ?? null,
      folioCurrency: card.folio?.currency ?? null,
      fnbOrders: card.fnb?.orders ?? 0,
      fnbTotal: card.fnb?.total ?? null,
      spaBookings: card.spa?.bookings ?? 0,
      spaUpcoming: card.spa?.upcoming ?? 0,
      maintenanceType: card.maintenance?.type ?? null,
      maintenanceReason: card.maintenance?.reason ?? null,
      currency: card.folio?.currency ?? card.fnb?.currency ?? card.spa?.currency ?? null,
    };
  }

  bedLabelFor(card: OccupancyRoomCard | null): string | null {
    if (!card) return null;
    const bed = card.roomType.bedConfiguration as {
      primary?: string;
      quantity?: number;
      secondary?: string;
      secondaryQty?: number;
    } | null;
    if (!bed?.primary) return null;
    const primary = `${bed.quantity && bed.quantity > 1 ? `${bed.quantity}x ` : ''}${humanize(bed.primary)}`;
    const secondary = bed.secondary
      ? ` + ${bed.secondaryQty && bed.secondaryQty > 1 ? `${bed.secondaryQty}x ` : ''}${humanize(bed.secondary)}`
      : '';
    return primary + secondary;
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

          const updatedList = this.rooms().map((r) =>
            r.roomId === updatedRoom.roomId ? updatedRoom : r,
          );
          this.rooms.set(updatedList);
          this.applyFilters();

          this.successMessage.set(
            `Room ${updatedRoom.roomNumber} housekeeping status changed to ${newStatus}.`,
          );
          // Refresh board so cards reflect the change.
          const prop2 = this.activeProperty();
          if (prop2) {
            this.pmsApi.getOccupancyBoard(prop2.id).subscribe({
              next: (res2) => {
                this.board.set(res2.data);
                const map = new Map<string, OccupancyRoomCard>();
                for (const card of res2.data.rooms) map.set(card.roomId, card);
                this.boardCards.set(map);
              },
              error: () => {},
            });
          }
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

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
