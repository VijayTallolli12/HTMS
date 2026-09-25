import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import {
  FnbApiService,
  InHouseGuestOption,
} from './services/fnb-api.service';
import {
  OutletDto,
  RestaurantTableDto,
  MenuCategoryDto,
  MenuItemDto,
  FnbOrderDto,
  TableStatus,
  FnbOrderStatus,
  SettlementType,
  FnbPaymentMethod,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../shared/index';

type ActiveViewTab = 'tables' | 'kitchen' | 'menu';

@Component({
  selector: 'app-fnb-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HmsButtonComponent,
    HmsStatusPillComponent,
    HmsModalComponent,
    HmsAlertComponent,
    HmsLoadingComponent,
    HmsEmptyComponent,
  ],
  templateUrl: './fnb-workspace.component.html',
  styleUrls: ['./fnb-workspace.component.css'],
})
export class FnbWorkspaceComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly fnbApi = inject(FnbApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // View state
  activeTab = signal<ActiveViewTab>('tables');
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Outlets
  outlets = signal<OutletDto[]>([]);
  selectedOutletId = signal<string | null>(null);
  selectedOutlet = computed(() =>
    this.outlets().find((o) => o.id === this.selectedOutletId()) || null,
  );

  // Tables
  tables = signal<RestaurantTableDto[]>([]);
  selectedTable = signal<RestaurantTableDto | null>(null);

  // Menu
  categories = signal<MenuCategoryDto[]>([]);
  selectedCategoryId = signal<string>('ALL');
  menuItems = signal<MenuItemDto[]>([]);
  filteredMenuItems = computed(() => {
    const catId = this.selectedCategoryId();
    if (catId === 'ALL') return this.menuItems();
    return this.menuItems().filter((item) => item.categoryId === catId);
  });

  // Active Order Inspection
  activeOrder = signal<FnbOrderDto | null>(null);
  isLoadingOrder = signal<boolean>(false);

  // In-House Guests for Room Charge
  inHouseGuests = signal<InHouseGuestOption[]>([]);
  isLoadingGuests = signal<boolean>(false);

  // Kitchen/All Active Orders
  kitchenOrders = signal<FnbOrderDto[]>([]);

  // Modals state
  showOpenTableModal = signal<boolean>(false);
  showCloseOrderModal = signal<boolean>(false);

  // Open Table Form
  openTableTarget = signal<RestaurantTableDto | null>(null);
  openTableGuestCount = 2;
  openTableServerName = 'Staff';
  openTableNotes = '';
  openTableRoomNumber = '';
  openTableGuestName = '';

  // Close Order Form
  closeSettlementType: SettlementType = 'ROOM_CHARGE';
  closePaymentMethod: FnbPaymentMethod = 'ROOM_CHARGE';
  closeSelectedGuestReservationId = '';
  closeManualRoomNumber = '';

  // Permission helpers
  hasPermission(perm: string): boolean {
    return this.authService.hasPermission(perm);
  }

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop?.id) {
          this.loadOutlets(prop.id);
          this.loadInHouseGuests(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadOutlets(prop.id);
      this.loadInHouseGuests(prop.id);
    }
  }

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  loadOutlets(propertyId: string): void {
    this.isLoading.set(true);
    this.fnbApi.getOutlets(propertyId).subscribe({
      next: (res) => {
        const data = res.data || [];
        this.outlets.set(data);
        if (data.length > 0 && !this.selectedOutletId()) {
          this.selectedOutletId.set(data[0].id);
          this.loadOutletDetails(propertyId, data[0].id);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.message || 'Failed to load restaurant outlets',
        );
        this.isLoading.set(false);
      },
    });
  }

  onOutletChange(outletId: string): void {
    this.selectedOutletId.set(outletId);
    this.selectedTable.set(null);
    this.activeOrder.set(null);
    const prop = this.activeProperty();
    if (prop?.id && outletId) {
      this.loadOutletDetails(prop.id, outletId);
    }
  }

  loadOutletDetails(propertyId: string, outletId: string): void {
    this.loadTables(propertyId, outletId);
    this.loadMenu(propertyId, outletId);
    this.loadKitchenOrders(propertyId, outletId);
  }

  loadTables(propertyId: string, outletId: string): void {
    this.fnbApi.getTables(propertyId, outletId).subscribe({
      next: (res) => {
        this.tables.set(res.data || []);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.message || 'Failed to load restaurant tables',
        );
      },
    });
  }

  loadMenu(propertyId: string, outletId: string): void {
    this.fnbApi.getCategories(propertyId, outletId).subscribe({
      next: (res) => {
        this.categories.set(res.data || []);
      },
    });

    this.fnbApi.getItems(propertyId, outletId).subscribe({
      next: (res) => {
        this.menuItems.set(res.data || []);
      },
    });
  }

  loadInHouseGuests(propertyId: string): void {
    this.isLoadingGuests.set(true);
    this.fnbApi.getInHouseGuests(propertyId).subscribe({
      next: (res) => {
        this.inHouseGuests.set(res.data || []);
        this.isLoadingGuests.set(false);
      },
      error: () => {
        this.isLoadingGuests.set(false);
      },
    });
  }

  loadKitchenOrders(propertyId: string, outletId: string): void {
    this.fnbApi.getOrders(propertyId, { outletId }).subscribe({
      next: (res) => {
        const active = (res.data || []).filter(
          (o) => o.status !== 'CLOSED' && o.status !== 'CANCELLED',
        );
        this.kitchenOrders.set(active);
      },
    });
  }

  // -------------------------------------------------------------
  // Table Interactions
  // -------------------------------------------------------------
  onTableClick(table: RestaurantTableDto): void {
    this.selectedTable.set(table);
    if (table.status === 'AVAILABLE') {
      this.openTableTarget.set(table);
      this.openTableGuestCount = table.capacity || 2;
      this.openTableServerName = this.currentUser()?.firstName || 'Staff';
      this.openTableNotes = '';
      this.openTableRoomNumber = '';
      this.openTableGuestName = '';
      this.showOpenTableModal.set(true);
    } else if (table.activeOrderId) {
      this.loadOrder(table.activeOrderId);
    } else {
      this.activeOrder.set(null);
    }
  }

  confirmOpenTable(): void {
    const prop = this.activeProperty();
    const outlet = this.selectedOutlet();
    const table = this.openTableTarget();

    if (!prop?.id || !outlet || !table) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.fnbApi
      .createOrder(prop.id, {
        outletId: outlet.id,
        tableId: table.id,
        guestCount: this.openTableGuestCount,
        serverName: this.openTableServerName,
        notes: this.openTableNotes || undefined,
        roomNumber: this.openTableRoomNumber || undefined,
        guestName: this.openTableGuestName || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showOpenTableModal.set(false);
          this.successMessage.set(
            `Table ${table.tableNumber} opened successfully. Order #${res.data.orderNumber} initiated.`,
          );
          this.activeOrder.set(res.data);
          this.loadTables(prop.id, outlet.id);
          this.loadKitchenOrders(prop.id, outlet.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to open table order',
          );
        },
      });
  }

  loadOrder(orderId: string): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isLoadingOrder.set(true);
    this.fnbApi.getOrder(prop.id, orderId).subscribe({
      next: (res) => {
        this.activeOrder.set(res.data);
        this.isLoadingOrder.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.message || 'Failed to load order details',
        );
        this.isLoadingOrder.set(false);
      },
    });
  }

  // -------------------------------------------------------------
  // Order Item Management
  // -------------------------------------------------------------
  addItemToOrder(item: MenuItemDto): void {
    const prop = this.activeProperty();
    const order = this.activeOrder();
    if (!prop?.id || !order) return;

    this.isSubmitting.set(true);
    this.fnbApi
      .addOrderItem(prop.id, order.id, {
        menuItemId: item.id,
        quantity: 1,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.activeOrder.set(res.data);
          this.loadTables(prop.id, order.outletId);
          this.loadKitchenOrders(prop.id, order.outletId);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to add item to order',
          );
        },
      });
  }

  removeItemFromOrder(itemId: string): void {
    const prop = this.activeProperty();
    const order = this.activeOrder();
    if (!prop?.id || !order) return;

    this.isSubmitting.set(true);
    this.fnbApi.removeOrderItem(prop.id, order.id, itemId).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.activeOrder.set(res.data);
        this.loadTables(prop.id, order.outletId);
        this.loadKitchenOrders(prop.id, order.outletId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Failed to remove order item',
        );
      },
    });
  }

  // -------------------------------------------------------------
  // Order Lifecycle Transitions
  // -------------------------------------------------------------
  transitionOrderStatus(nextStatus: FnbOrderStatus): void {
    const prop = this.activeProperty();
    const order = this.activeOrder();
    if (!prop?.id || !order) return;

    this.isSubmitting.set(true);
    this.fnbApi
      .updateOrderStatus(prop.id, order.id, { status: nextStatus })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.activeOrder.set(res.data);
          this.successMessage.set(
            `Order #${res.data.orderNumber} status updated to ${nextStatus}.`,
          );
          this.loadTables(prop.id, order.outletId);
          this.loadKitchenOrders(prop.id, order.outletId);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to update order status',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Order Settlement & Folio Posting
  // -------------------------------------------------------------
  openCloseOrderModal(): void {
    const order = this.activeOrder();
    if (!order) return;

    this.closeSettlementType = 'ROOM_CHARGE';
    this.closePaymentMethod = 'ROOM_CHARGE';
    this.closeSelectedGuestReservationId = '';
    this.closeManualRoomNumber = order.roomNumber || '';

    // If order already has a roomNumber, try matching in-house guest
    if (order.roomNumber) {
      const match = this.inHouseGuests().find(
        (g) => g.roomNumber.toLowerCase() === order.roomNumber?.toLowerCase(),
      );
      if (match) {
        this.closeSelectedGuestReservationId = match.reservationId;
      }
    }

    this.showCloseOrderModal.set(true);
  }

  confirmCloseOrder(): void {
    const prop = this.activeProperty();
    const order = this.activeOrder();
    if (!prop?.id || !order) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    let roomNumber: string | undefined = undefined;
    let reservationId: string | undefined = undefined;
    let folioId: string | undefined = undefined;

    if (this.closeSettlementType === 'ROOM_CHARGE') {
      if (this.closeSelectedGuestReservationId) {
        const selectedGuest = this.inHouseGuests().find(
          (g) => g.reservationId === this.closeSelectedGuestReservationId,
        );
        if (selectedGuest) {
          reservationId = selectedGuest.reservationId;
          roomNumber = selectedGuest.roomNumber;
          folioId = selectedGuest.folioId || undefined;
        }
      } else if (this.closeManualRoomNumber) {
        roomNumber = this.closeManualRoomNumber.trim();
      } else {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          'Please select an in-house guest or enter a room number to post charge to folio.',
        );
        return;
      }
    }

    this.fnbApi
      .closeOrder(prop.id, order.id, {
        settlementType: this.closeSettlementType,
        paymentMethod:
          this.closeSettlementType === 'ROOM_CHARGE'
            ? 'ROOM_CHARGE'
            : this.closePaymentMethod,
        roomNumber,
        reservationId,
        folioId,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCloseOrderModal.set(false);
          this.activeOrder.set(res.data);

          if (res.data.settlementType === 'ROOM_CHARGE') {
            this.successMessage.set(
              `Order #${res.data.orderNumber} successfully closed and posted to Room ${res.data.roomNumber} (${res.data.guestName}) folio. Table released.`,
            );
          } else {
            this.successMessage.set(
              `Order #${res.data.orderNumber} settled with ${res.data.paymentMethod}. Table released.`,
            );
          }

          this.loadTables(prop.id, order.outletId);
          this.loadKitchenOrders(prop.id, order.outletId);
          this.selectedTable.set(null);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to settle order and post to folio',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  getStatusPillVariant(
    status: TableStatus | FnbOrderStatus,
  ): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    switch (status) {
      case 'AVAILABLE':
      case 'READY':
      case 'SERVED':
      case 'CLOSED':
        return 'success';
      case 'OCCUPIED':
      case 'ORDERED':
      case 'PREPARING':
        return 'warning';
      case 'OUT_OF_SERVICE':
      case 'CANCELLED':
        return 'danger';
      case 'RESERVED':
        return 'info';
      default:
        return 'default';
    }
  }

  formatPrice(price: string | number, currency = 'JPY'): string {
    const num = Number(price) || 0;
    if (currency === 'JPY') {
      return `¥${num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    }
    return `$${num.toFixed(2)}`;
  }
}
