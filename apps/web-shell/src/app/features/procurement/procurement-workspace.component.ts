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
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import { ProcurementApiService } from './services/procurement-api.service';
import {
  SupplierDto,
  InventoryItemDto,
  PurchaseOrderDto,
  GoodsReceiptDto,
  StockBalanceDto,
  PurchaseOrderStatus,
} from '@hms/api-contracts';
import {
  HmsButtonComponent,
  HmsStatusPillComponent,
  HmsModalComponent,
  HmsAlertComponent,
  HmsLoadingComponent,
  HmsEmptyComponent,
} from '../../shared/index';

type ActiveProcurementTab =
  | 'purchase-orders'
  | 'suppliers'
  | 'items'
  | 'receipts'
  | 'stock';

@Component({
  selector: 'app-procurement-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HmsButtonComponent,
    HmsStatusPillComponent,
    HmsModalComponent,
    HmsAlertComponent,
    HmsLoadingComponent,
    HmsEmptyComponent,
  ],
  templateUrl: './procurement-workspace.component.html',
  styleUrls: ['./procurement-workspace.component.css'],
})
export class ProcurementWorkspaceComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly procApi = inject(ProcurementApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // View state
  activeTab = signal<ActiveProcurementTab>('purchase-orders');
  statusFilter = signal<string>('ALL');
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Data
  suppliers = signal<SupplierDto[]>([]);
  items = signal<InventoryItemDto[]>([]);
  purchaseOrders = signal<PurchaseOrderDto[]>([]);
  receipts = signal<GoodsReceiptDto[]>([]);
  stockBalances = signal<StockBalanceDto[]>([]);

  // Filtered POs
  filteredPOs = computed(() => {
    const list = this.purchaseOrders();
    const filter = this.statusFilter();
    if (filter === 'ALL') return list;
    return list.filter((po) => po.status === filter);
  });

  // Selected PO for detail inspection
  selectedPO = signal<PurchaseOrderDto | null>(null);
  showPODetail = signal<boolean>(false);

  // Modal state
  showCreatePOModal = signal<boolean>(false);
  showCreateSupplierModal = signal<boolean>(false);

  // Create PO Form
  newPOSupplierId = '';
  newPONotes = '';
  newPOExpectedDate = '';
  newPOItems: { inventoryItemId: string; quantity: number; unitCost: number }[] = [];

  // Create Supplier Form
  newSupplierName = '';
  newSupplierCode = '';
  newSupplierContact = '';
  newSupplierEmail = '';
  newSupplierPhone = '';

  // Permission helpers
  hasPermission(perm: string): boolean {
    return this.authService.hasPermission(perm);
  }

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop?.id) {
          this.loadAllData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAllData(prop.id);
    }
  }

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  loadAllData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.procApi.getSuppliers(propertyId).subscribe({
      next: (res) => this.suppliers.set(res.data || []),
    });

    this.procApi.getItems(propertyId).subscribe({
      next: (res) => this.items.set(res.data || []),
    });

    this.procApi.getStockBalances(propertyId).subscribe({
      next: (res) => this.stockBalances.set(res.data || []),
    });

    this.procApi.getGoodsReceipts(propertyId).subscribe({
      next: (res) => this.receipts.set(res.data || []),
    });

    this.procApi.getPurchaseOrders(propertyId).subscribe({
      next: (res) => {
        this.purchaseOrders.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.message || 'Failed to load procurement data',
        );
        this.isLoading.set(false);
      },
    });
  }

  // -------------------------------------------------------------
  // PO Status Transitions
  // -------------------------------------------------------------
  updatePOStatus(po: PurchaseOrderDto, nextStatus: PurchaseOrderStatus): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isSubmitting.set(true);
    this.procApi
      .updatePurchaseOrderStatus(prop.id, po.id, nextStatus)
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.successMessage.set(
            `PO #${res.data.poNumber} updated to ${nextStatus}.`,
          );
          this.loadAllData(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to update PO status',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // PO Detail View
  // -------------------------------------------------------------
  inspectPO(po: PurchaseOrderDto): void {
    this.selectedPO.set(po);
    this.showPODetail.set(true);
  }

  closePODetail(): void {
    this.selectedPO.set(null);
    this.showPODetail.set(false);
  }

  // -------------------------------------------------------------
  // Create Supplier
  // -------------------------------------------------------------
  openCreateSupplierModal(): void {
    this.newSupplierName = '';
    this.newSupplierCode = '';
    this.newSupplierContact = '';
    this.newSupplierEmail = '';
    this.newSupplierPhone = '';
    this.showCreateSupplierModal.set(true);
  }

  confirmCreateSupplier(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.newSupplierName || !this.newSupplierCode) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.procApi
      .createSupplier(prop.id, {
        name: this.newSupplierName,
        code: this.newSupplierCode,
        contact: this.newSupplierContact || undefined,
        email: this.newSupplierEmail || undefined,
        phone: this.newSupplierPhone || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCreateSupplierModal.set(false);
          this.successMessage.set(
            `Supplier "${res.data.name}" created successfully.`,
          );
          this.loadAllData(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to create supplier',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Create PO (simplified)
  // -------------------------------------------------------------
  openCreatePOModal(): void {
    this.newPOSupplierId = this.suppliers().length > 0 ? this.suppliers()[0].id : '';
    this.newPONotes = '';
    this.newPOExpectedDate = '';
    this.newPOItems = [{ inventoryItemId: '', quantity: 1, unitCost: 0 }];
    this.showCreatePOModal.set(true);
  }

  addPOLineItem(): void {
    this.newPOItems = [
      ...this.newPOItems,
      { inventoryItemId: '', quantity: 1, unitCost: 0 },
    ];
  }

  removePOLineItem(index: number): void {
    this.newPOItems = this.newPOItems.filter((_, i) => i !== index);
  }

  confirmCreatePO(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.newPOSupplierId) return;

    const validItems = this.newPOItems.filter(
      (li) => li.inventoryItemId && li.quantity > 0 && li.unitCost > 0,
    );
    if (validItems.length === 0) {
      this.errorMessage.set('Please add at least one valid line item.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.procApi
      .createPurchaseOrder(prop.id, {
        supplierId: this.newPOSupplierId,
        notes: this.newPONotes || undefined,
        expectedDate: this.newPOExpectedDate || undefined,
        items: validItems,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.showCreatePOModal.set(false);
          this.successMessage.set(
            `Purchase Order #${res.data.poNumber} created.`,
          );
          this.loadAllData(prop.id);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Failed to create purchase order',
          );
        },
      });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  getStatusPillVariant(
    status: PurchaseOrderStatus | string,
  ): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    switch (status) {
      case 'RECEIVED':
        return 'success';
      case 'APPROVED':
        return 'info';
      case 'SUBMITTED':
        return 'warning';
      case 'DRAFT':
        return 'default';
      case 'PARTIALLY_RECEIVED':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'default';
    }
  }

  formatCurrency(amount: number | string): string {
    const num = Number(amount) || 0;
    return `¥${num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
  }

  getSupplierName(supplierId: string): string {
    const s = this.suppliers().find((sup) => sup.id === supplierId);
    return s ? s.name : supplierId;
  }

  getItemName(inventoryItemId: string): string {
    const item = this.items().find((i) => i.id === inventoryItemId);
    return item ? item.name : inventoryItemId;
  }

  getItemSku(inventoryItemId: string): string {
    const item = this.items().find((i) => i.id === inventoryItemId);
    return item ? item.sku : '';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
