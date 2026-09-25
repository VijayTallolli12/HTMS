// ==============================================================================
// Enterprise HMS — Procurement & Inventory Contracts
// ==============================================================================

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

// ==========================================
// SUPPLIERS
// ==========================================
export interface SupplierDto {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// INVENTORY ITEMS
// ==========================================
export interface InventoryItemDto {
  id: string;
  propertyId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  reorderLevel: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PURCHASE ORDERS
// ==========================================
export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  inventoryItem?: InventoryItemDto;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDto {
  id: string;
  propertyId: string;
  supplierId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  totalAmount: number;
  notes?: string | null;
  version: number;
  supplier?: SupplierDto;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// GOODS RECEIPTS
// ==========================================
export interface GoodsReceiptItemDto {
  id: string;
  receiptId: string;
  inventoryItemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  inventoryItem?: InventoryItemDto;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptDto {
  id: string;
  propertyId: string;
  purchaseOrderId: string;
  receiptNumber: string;
  receivedDate: string;
  status: string;
  notes?: string | null;
  idempotencyKey: string;
  version: number;
  purchaseOrder?: PurchaseOrderDto;
  items: GoodsReceiptItemDto[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// STOCK BALANCES
// ==========================================
export interface StockBalanceDto {
  id: string;
  propertyId: string;
  inventoryItemId: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  version: number;
  inventoryItem?: InventoryItemDto;
  createdAt: string;
  updatedAt: string;
}

