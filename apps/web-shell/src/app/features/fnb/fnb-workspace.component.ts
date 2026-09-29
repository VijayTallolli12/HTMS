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
  MenuItemDetailDto,
  MenuItemVariantDto,
  ModifierGroupDto,
  ModifierDto,
  MenuItemPriceDto,
  MenuItemAvailability,
  CreateMenuItemVariantDto,
  UpdateMenuItemVariantDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierDto,
  UpdateModifierDto,
  UpdateMenuItemDto,
  UpdateMenuItemAvailabilityDto,
  UpdateMenuItemPriceDto,
  QueryMenuItemsDto,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../shared/index';

type ActiveViewTab = 'tables' | 'kitchen' | 'menu' | 'catalog' | 'pricing' | 'outlets';

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

  // Catalog Management State
  catalogItems = signal<MenuItemDto[]>([]);
  catalogCategories = signal<MenuCategoryDto[]>([]);
  catalogSearch = signal<string>('');
  catalogCategoryFilter = signal<string>('ALL');
  catalogAvailabilityFilter = signal<string>('ALL');
  catalogActiveOnly = signal<boolean>(true);
  catalogSelectedItem = signal<MenuItemDetailDto | null>(null);
  showCatalogItemDrawer = signal<boolean>(false);
  isLoadingCatalog = signal<boolean>(false);
  catalogPage = signal<number>(1);
  catalogLimit = signal<number>(20);
  catalogTotal = signal<number>(0);

  // Catalog Item Form
  catalogFormMode = signal<'create' | 'edit'>('create');
  catalogForm = signal<UpdateMenuItemDto>({});

  // Pricing State
  pricingItems = signal<MenuItemPriceDto[]>([]);
  pricingSearch = signal<string>('');
  pricingAvailabilityFilter = signal<string>('ALL');
  isLoadingPricing = signal<boolean>(false);
  pricingPage = signal<number>(1);
  pricingLimit = signal<number>(20);
  pricingTotal = signal<number>(0);
  pricingSelectedItem = signal<MenuItemPriceDto | null>(null);
  showPriceEditDrawer = signal<boolean>(false);
  priceEditForm = signal<UpdateMenuItemPriceDto>({ price: 0 });

  // Outlets Management State
  managementOutlets = signal<OutletDto[]>([]);
  isLoadingOutletsMgmt = signal<boolean>(false);
  outletSelectedForMgmt = signal<OutletDto | null>(null);
  showOutletDetailDrawer = signal<boolean>(false);
  isLoadingOutletDetail = signal<boolean>(false);
  outletDetail = signal<any>(null);

  // W4: Category CRUD modal state
  showCategoryModal = signal<boolean>(false);
  categoryFormMode = signal<'create' | 'edit'>('create');
  categoryEditingId = signal<string | null>(null);
  categoryForm = signal<{ name?: string; description?: string; displayOrder?: number }>({});

  // W4: item create needs an explicit category selection
  itemFormCategoryId = signal<string>('');

  // W4: template-safe field setters (Angular templates cannot use spread)
  setCategoryField(field: 'name' | 'description' | 'displayOrder', value: unknown): void {
    this.categoryForm.set({ ...this.categoryForm(), [field]: value } as { name?: string; description?: string; displayOrder?: number });
  }

  setCatalogField(field: string, value: unknown): void {
    this.catalogForm.set({ ...this.catalogForm(), [field]: value } as UpdateMenuItemDto);
  }

  setVariantField(field: 'name' | 'priceModifier', value: unknown): void {
    this.variantDraft.set({ ...this.variantDraft(), [field]: value });
  }

  setModifierGroupField(field: 'name' | 'minSelections' | 'maxSelections', value: unknown): void {
    this.modifierGroupDraft.set({ ...this.modifierGroupDraft(), [field]: value });
  }

  setModifierField(field: 'name' | 'priceModifier', value: unknown): void {
    this.modifierDraft.set({ ...this.modifierDraft(), [field]: value });
  }

  setPriceEdit(value: unknown): void {
    this.priceEditForm.set({ price: Number(value) || 0 });
  }

  // W4: variant / modifier drafts (real sub-entity CRUD)
  variantDraft = signal<{ name?: string; priceModifier?: number }>({});
  modifierGroupDraft = signal<{ name?: string; minSelections?: number; maxSelections?: number }>({});
  modifierDraft = signal<{ name?: string; priceModifier?: number }>({});

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
      this.loadCatalog(prop.id, outletId);
      this.loadPricing(prop.id, outletId);
      this.loadCatalogCategories(prop.id, outletId);
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

  // ================================================================
  // Catalog Management
  // ================================================================
  loadCatalog(propertyId: string, outletId: string, page = 1): void {
    this.isLoadingCatalog.set(true);
    const query: QueryMenuItemsDto = {
      outletId,
      page,
      limit: this.catalogLimit(),
      search: this.catalogSearch() || undefined,
      categoryId: this.catalogCategoryFilter() === 'ALL' ? undefined : this.catalogCategoryFilter(),
      availability: this.catalogAvailabilityFilter() === 'ALL' ? undefined : this.catalogAvailabilityFilter() as MenuItemAvailability,
      isActive: this.catalogActiveOnly() || undefined,
    };

    this.fnbApi.searchMenuItems(propertyId, outletId, query).subscribe({
      next: (res) => {
        this.catalogItems.set(res.data.items);
        this.catalogTotal.set(res.data.total);
        this.catalogPage.set(res.data.page);
        this.isLoadingCatalog.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load catalog');
        this.isLoadingCatalog.set(false);
      },
    });
  }

  loadCatalogCategories(propertyId: string, outletId: string): void {
    this.fnbApi.getCategories(propertyId, outletId).subscribe({
      next: (res) => {
        this.catalogCategories.set(res.data || []);
      },
    });
  }

  openCatalogItem(item: MenuItemDto): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;

    this.isLoadingCatalog.set(true);
    this.fnbApi.getMenuItemDetail(propertyId, outletId, item.id).subscribe({
      next: (res) => {
        this.catalogSelectedItem.set(res.data);
        this.showCatalogItemDrawer.set(true);
        this.isLoadingCatalog.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load item details');
        this.isLoadingCatalog.set(false);
      },
    });
  }

  closeCatalogItemDrawer(): void {
    this.showCatalogItemDrawer.set(false);
    this.catalogSelectedItem.set(null);
  }

  startEditCatalogItem(item: MenuItemDto): void {
    this.catalogFormMode.set('edit');
    this.catalogForm.set({
      name: item.name,
      description: item.description ?? undefined,
      price: item.price,
      currency: item.currency,
      availability: item.availability,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
  }

  startCreateCatalogItem(): void {
    this.catalogFormMode.set('create');
    this.catalogForm.set({});
  }

  saveCatalogItem(): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    if (!propertyId || !outletId || !item) return;

    this.isSubmitting.set(true);
    if (this.catalogFormMode() === 'edit') {
      this.fnbApi.updateMenuItem(propertyId, outletId, item.id, this.catalogForm()).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.loadCatalog(propertyId, outletId, this.catalogPage());
          this.closeCatalogItemDrawer();
          this.successMessage.set('Menu item updated');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to update menu item');
        },
      });
    } else {
      // Create new menu item - need outlet and category
      const categoryId = this.catalogCategories()[0]?.id;
      if (!categoryId) return;
      this.fnbApi.createItem(propertyId, outletId, {
        categoryId,
        code: `ITEM-${Date.now()}`,
        ...this.catalogForm(),
      } as any).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.loadCatalog(propertyId, outletId, this.catalogPage());
          this.successMessage.set('Menu item created');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to create menu item');
        },
      });
    }
  }

  deleteCatalogItem(item: MenuItemDto): void {
    if (!confirm(`Delete menu item "${item.name}"?`)) return;
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;

    // Soft-delete via isActive=false (domain rules keep orders referential).
    this.fnbApi.updateMenuItem(propertyId, outletId, item.id, { isActive: false } as UpdateMenuItemDto).subscribe({
      next: () => {
        this.successMessage.set(`Menu item "${item.name}" archived.`);
        this.loadCatalog(propertyId, outletId, this.catalogPage());
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to archive menu item'),
    });
  }

  // ================================================================
  // W4: Category CRUD (create / edit via modal)
  // ================================================================
  openCategoryCreateModal(): void {
    this.categoryFormMode.set('create');
    this.categoryEditingId.set(null);
    this.categoryForm.set({ displayOrder: (this.catalogCategories().length || 0) + 1 });
    this.showCategoryModal.set(true);
  }

  openCategoryEditModal(cat: MenuCategoryDto): void {
    this.categoryFormMode.set('edit');
    this.categoryEditingId.set(cat.id);
    this.categoryForm.set({ name: cat.name, displayOrder: cat.displayOrder });
    this.showCategoryModal.set(true);
  }

  saveCategory(): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;
    const form = this.categoryForm();
    if (!form.name) return;

    this.isSubmitting.set(true);
    const call = this.categoryFormMode() === 'create'
      ? this.fnbApi.createCategory(propertyId, outletId, { name: form.name, description: form.description, displayOrder: form.displayOrder } as never)
      : this.fnbApi.updateCategory(propertyId, outletId, this.categoryEditingId()!, { name: form.name, description: form.description, displayOrder: form.displayOrder } as never);

    call.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showCategoryModal.set(false);
        this.successMessage.set('Menu category saved');
        this.loadCatalogCategories(propertyId, outletId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to save category');
      },
    });
  }

  // ================================================================
  // W4: Variants & modifier groups (sub-entity CRUD on item detail)
  // ================================================================
  addVariant(): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    const draft = this.variantDraft();
    if (!propertyId || !outletId || !item || !draft.name) return;

    this.fnbApi.createVariant(propertyId, outletId, item.id, { menuItemId: item.id, code: `VAR-${Date.now()}`, name: draft.name, price: draft.priceModifier ?? 0 } as CreateMenuItemVariantDto).subscribe({
      next: () => {
        this.variantDraft.set({});
        this.successMessage.set('Variant added');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to add variant'),
    });
  }

  deleteVariant(variantId: string): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    if (!propertyId || !outletId || !item) return;

    this.fnbApi.deleteVariant(propertyId, outletId, item.id, variantId).subscribe({
      next: () => {
        this.successMessage.set('Variant removed');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to remove variant'),
    });
  }

  addModifierGroup(): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    const draft = this.modifierGroupDraft();
    if (!propertyId || !outletId || !item || !draft.name) return;

    this.fnbApi.createModifierGroup(propertyId, outletId, item.id, { menuItemId: item.id, name: draft.name } as CreateModifierGroupDto).subscribe({
      next: () => {
        this.modifierGroupDraft.set({});
        this.successMessage.set('Modifier group added');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to add modifier group'),
    });
  }

  deleteModifierGroup(groupId: string): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    if (!propertyId || !outletId || !item) return;

    this.fnbApi.deleteModifierGroup(propertyId, outletId, item.id, groupId).subscribe({
      next: () => {
        this.successMessage.set('Modifier group removed');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to remove modifier group'),
    });
  }

  addModifier(groupId: string): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    const draft = this.modifierDraft();
    if (!propertyId || !outletId || !item || !draft.name) return;

    this.fnbApi.createModifier(propertyId, outletId, item.id, groupId, { modifierGroupId: groupId, name: draft.name, priceAdjustment: draft.priceModifier ?? 0 } as CreateModifierDto).subscribe({
      next: () => {
        this.modifierDraft.set({});
        this.successMessage.set('Modifier added');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to add modifier'),
    });
  }

  deleteModifier(groupId: string, modifierId: string): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.catalogSelectedItem();
    if (!propertyId || !outletId || !item) return;

    this.fnbApi.deleteModifier(propertyId, outletId, item.id, groupId, modifierId).subscribe({
      next: () => {
        this.successMessage.set('Modifier removed');
        this.refreshItemDetail(item.id);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to remove modifier'),
    });
  }

  refreshItemDetail(itemId: string): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;
    this.fnbApi.getMenuItemDetail(propertyId, outletId, itemId).subscribe({
      next: (res) => this.catalogSelectedItem.set(res.data),
      error: () => this.errorMessage.set('Failed to refresh item detail'),
    });
  }

  // ================================================================
  // W4: Pricing drawer + availability toggle + tab entry loaders
  // ================================================================
  toggleAvailability(item: MenuItemPriceDto): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;
    const next: MenuItemAvailability = item.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    this.fnbApi.updateMenuItemAvailability(propertyId, outletId, item.id, { availability: next }).subscribe({
      next: () => {
        this.successMessage.set(`"${item.name}" is now ${next === 'AVAILABLE' ? 'available' : '86\'d'}`);
        this.loadPricing(propertyId, outletId, this.pricingPage());
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to update availability'),
    });
  }

  onCatalogTab(): void {
    this.activeTab.set('catalog');
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadCatalog(propertyId, outletId, 1);
      this.loadCatalogCategories(propertyId, outletId);
    }
  }

  onPricingTab(): void {
    this.activeTab.set('pricing');
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadPricing(propertyId, outletId, 1);
    }
  }

  onOutletsTab(): void {
    this.activeTab.set('outlets');
    const propertyId = this.activeProperty()?.id;
    if (propertyId) {
      this.loadOutlets(propertyId);
      const outletId = this.selectedOutletId();
      if (outletId) this.loadCatalogCategories(propertyId, outletId);
    }
  }

  selectOutlet(outletId: string): void {
    this.selectedOutletId.set(outletId);
    const propertyId = this.activeProperty()?.id;
    if (propertyId) {
      this.loadMenu(propertyId, outletId);
      this.loadCatalog(propertyId, outletId, 1);
      this.loadCatalogCategories(propertyId, outletId);
    }
  }

  onCatalogSearchChange(): void {
    this.catalogPage.set(1);
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadCatalog(propertyId, outletId, 1);
    }
  }

  onCatalogPageChange(page: number): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadCatalog(propertyId, outletId, page);
    }
  }

  // ================================================================
  // Pricing Management
  // ================================================================
  loadPricing(propertyId: string, outletId: string, page = 1): void {
    this.isLoadingPricing.set(true);
    const query: QueryMenuItemsDto = {
      outletId,
      page,
      limit: this.pricingLimit(),
      search: this.pricingSearch() || undefined,
      availability: this.pricingAvailabilityFilter() === 'ALL' ? undefined : this.pricingAvailabilityFilter() as MenuItemAvailability,
      isActive: true,
    };

    this.fnbApi.searchMenuItems(propertyId, outletId, query).subscribe({
      next: (res) => {
        this.pricingItems.set(res.data.items as any);
        this.pricingTotal.set(res.data.total);
        this.pricingPage.set(res.data.page);
        this.isLoadingPricing.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load pricing');
        this.isLoadingPricing.set(false);
      },
    });
  }

  openPriceEdit(item: MenuItemPriceDto): void {
    this.pricingSelectedItem.set(item);
    this.priceEditForm.set({ price: Number(item.basePrice) });
    this.showPriceEditDrawer.set(true);
  }

  closePriceEditDrawer(): void {
    this.showPriceEditDrawer.set(false);
    this.pricingSelectedItem.set(null);
  }

  savePriceEdit(): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    const item = this.pricingSelectedItem();
    if (!propertyId || !outletId || !item) return;

    this.isSubmitting.set(true);
    this.fnbApi.updateMenuItemPrice(propertyId, outletId, item.id, this.priceEditForm()).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.loadPricing(propertyId, outletId, this.pricingPage());
        this.closePriceEditDrawer();
        this.successMessage.set('Price updated');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to update price');
      },
    });
  }

  onPricingSearchChange(): void {
    this.pricingPage.set(1);
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadPricing(propertyId, outletId, 1);
    }
  }

  onPricingPageChange(page: number): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (propertyId && outletId) {
      this.loadPricing(propertyId, outletId, page);
    }
  }

  // ================================================================
  // Outlets Management
  // ================================================================
  loadOutletsForManagement(propertyId: string): void {
    this.isLoadingOutletsMgmt.set(true);
    this.fnbApi.getOutlets(propertyId).subscribe({
      next: (res) => {
        this.managementOutlets.set(res.data || []);
        this.isLoadingOutletsMgmt.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load outlets');
        this.isLoadingOutletsMgmt.set(false);
      },
    });
  }

  openOutletDetail(outlet: OutletDto): void {
    const propertyId = this.activeProperty()?.id;
    if (!propertyId) return;

    this.isLoadingOutletDetail.set(true);
    this.fnbApi.getOutlet(propertyId, outlet.id).subscribe({
      next: (res) => {
        this.outletDetail.set(res.data);
        this.outletSelectedForMgmt.set(outlet);
        this.showOutletDetailDrawer.set(true);
        this.isLoadingOutletDetail.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load outlet details');
        this.isLoadingOutletDetail.set(false);
      },
    });
  }

  closeOutletDetailDrawer(): void {
    this.showOutletDetailDrawer.set(false);
    this.outletSelectedForMgmt.set(null);
    this.outletDetail.set(null);
  }

  toggleOutletStatus(outlet: OutletDto): void {
    // Note: Update outlet status endpoint would need to be added
    this.errorMessage.set('Outlet status toggle not yet implemented');
  }

  // ================================================================
  // Outlet Change Handler Override
  // ================================================================

  // ================================================================
  // Quick Availability Toggle
  // ================================================================
  quickToggleAvailability(item: MenuItemDto): void {
    const propertyId = this.activeProperty()?.id;
    const outletId = this.selectedOutletId();
    if (!propertyId || !outletId) return;

    const newAvailability = item.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    this.isSubmitting.set(true);
    this.fnbApi.updateMenuItemAvailability(propertyId, outletId, item.id, { availability: newAvailability }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.loadCatalog(propertyId, outletId, this.catalogPage());
        this.loadPricing(propertyId, outletId, this.pricingPage());
        this.successMessage.set(`Availability changed to ${newAvailability}`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to update availability');
      },
    });
  }
}
