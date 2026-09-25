// ==============================================================================
// Enterprise HMS — Food & Beverage (F&B / Restaurant) Contracts
// ==============================================================================

export type OutletType = 'RESTAURANT' | 'BAR' | 'ROOM_SERVICE' | 'CAFE';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export type FnbOrderStatus =
  | 'OPEN'
  | 'ORDERED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CLOSED'
  | 'CANCELLED';

export type SettlementType = 'ROOM_CHARGE' | 'DIRECT_PAY';

export type FnbPaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ROOM_CHARGE';

export interface OutletDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description?: string | null;
  outletType: OutletType;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutletDto {
  code: string;
  name: string;
  description?: string;
  outletType?: OutletType;
}

export interface MenuCategoryDto {
  id: string;
  propertyId: string;
  outletId: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuCategoryDto {
  code: string;
  name: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface MenuItemDto {
  id: string;
  propertyId: string;
  outletId: string;
  categoryId: string;
  categoryName?: string;
  code: string;
  name: string;
  description?: string | null;
  price: string; // Decimal string
  currency: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuItemDto {
  categoryId: string;
  code: string;
  name: string;
  description?: string;
  price: string | number;
  currency?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface RestaurantTableDto {
  id: string;
  propertyId: string;
  outletId: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  activeOrderId?: string | null;
  activeOrder?: FnbOrderDto | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableDto {
  tableNumber: string;
  capacity?: number;
  status?: TableStatus;
}

export interface UpdateTableStatusDto {
  status: TableStatus;
}

export interface FnbOrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: string; // Decimal string
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddOrderItemDto {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface FnbOrderDto {
  id: string;
  propertyId: string;
  outletId: string;
  outletName?: string;
  orderNumber: string;
  tableId?: string | null;
  tableNumber?: string | null;
  status: FnbOrderStatus;
  guestCount: number;
  serverName?: string | null;
  notes?: string | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  settlementType: SettlementType;
  paymentMethod?: FnbPaymentMethod | string | null;
  reservationId?: string | null;
  folioId?: string | null;
  folioTransactionId?: string | null;
  roomNumber?: string | null;
  guestName?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: FnbOrderItemDto[];
}

export interface CreateOrderDto {
  outletId: string;
  tableId?: string;
  guestCount?: number;
  serverName?: string;
  notes?: string;
  roomNumber?: string;
  guestName?: string;
  reservationId?: string;
}

export interface UpdateOrderStatusDto {
  status: FnbOrderStatus;
  reason?: string;
}

export interface CloseOrderDto {
  settlementType: SettlementType; // ROOM_CHARGE | DIRECT_PAY
  paymentMethod?: FnbPaymentMethod; // CASH | CREDIT_CARD | ROOM_CHARGE
  roomNumber?: string;
  reservationId?: string;
  folioId?: string;
}

export interface QueryFnbOrdersDto {
  outletId?: string;
  tableId?: string;
  status?: FnbOrderStatus;
  date?: string;
  limit?: number;
  page?: number;
}

