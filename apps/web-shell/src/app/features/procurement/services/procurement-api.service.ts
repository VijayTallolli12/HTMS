import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  GoodsReceiptDto,
  InventoryItemDto,
  PurchaseOrderDto,
  PurchaseOrderStatus,
  StockBalanceDto,
  SupplierDto,
} from '@hms/api-contracts';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProcurementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private procurementUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/procurement`;
  }

  // -------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------
  getSuppliers(propertyId: string, activeOnly = false) {
    const query = activeOnly ? '?active=true' : '';
    return this.http.get<ApiSuccessResponse<SupplierDto[]>>(
      `${this.procurementUrl(propertyId)}/suppliers${query}`,
    );
  }

  createSupplier(propertyId: string, dto: Partial<SupplierDto>) {
    return this.http.post<ApiSuccessResponse<SupplierDto>>(
      `${this.procurementUrl(propertyId)}/suppliers`,
      dto,
    );
  }

  updateSupplier(propertyId: string, id: string, dto: Partial<SupplierDto>) {
    return this.http.patch<ApiSuccessResponse<SupplierDto>>(
      `${this.procurementUrl(propertyId)}/suppliers/${id}`,
      dto,
    );
  }

  deleteSupplier(propertyId: string, id: string) {
    return this.http.delete<void>(
      `${this.procurementUrl(propertyId)}/suppliers/${id}`,
    );
  }

  // -------------------------------------------------------------
  // Inventory Items
  // -------------------------------------------------------------
  getItems(propertyId: string, category?: string, activeOnly = false) {
    const params: string[] = [];
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (activeOnly) params.push('active=true');
    const query = params.length > 0 ? `?${params.join('&')}` : '';

    return this.http.get<ApiSuccessResponse<InventoryItemDto[]>>(
      `${this.procurementUrl(propertyId)}/items${query}`,
    );
  }

  createItem(propertyId: string, dto: Partial<InventoryItemDto>) {
    return this.http.post<ApiSuccessResponse<InventoryItemDto>>(
      `${this.procurementUrl(propertyId)}/items`,
      dto,
    );
  }

  updateItem(propertyId: string, id: string, dto: Partial<InventoryItemDto>) {
    return this.http.patch<ApiSuccessResponse<InventoryItemDto>>(
      `${this.procurementUrl(propertyId)}/items/${id}`,
      dto,
    );
  }

  deleteItem(propertyId: string, id: string) {
    return this.http.delete<void>(
      `${this.procurementUrl(propertyId)}/items/${id}`,
    );
  }

  // -------------------------------------------------------------
  // Purchase Orders
  // -------------------------------------------------------------
  getPurchaseOrders(propertyId: string, status?: PurchaseOrderStatus, supplierId?: string) {
    const params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (supplierId) params.push(`supplierId=${supplierId}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';

    return this.http.get<ApiSuccessResponse<PurchaseOrderDto[]>>(
      `${this.procurementUrl(propertyId)}/purchase-orders${query}`,
    );
  }

  getPurchaseOrder(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<PurchaseOrderDto>>(
      `${this.procurementUrl(propertyId)}/purchase-orders/${id}`,
    );
  }

  createPurchaseOrder(propertyId: string, dto: any) {
    return this.http.post<ApiSuccessResponse<PurchaseOrderDto>>(
      `${this.procurementUrl(propertyId)}/purchase-orders`,
      dto,
    );
  }

  updatePurchaseOrderStatus(propertyId: string, id: string, status: PurchaseOrderStatus) {
    return this.http.patch<ApiSuccessResponse<PurchaseOrderDto>>(
      `${this.procurementUrl(propertyId)}/purchase-orders/${id}/status`,
      { status },
    );
  }

  // -------------------------------------------------------------
  // Goods Receipts
  // -------------------------------------------------------------
  getGoodsReceipts(propertyId: string, purchaseOrderId?: string) {
    const query = purchaseOrderId ? `?purchaseOrderId=${purchaseOrderId}` : '';
    return this.http.get<ApiSuccessResponse<GoodsReceiptDto[]>>(
      `${this.procurementUrl(propertyId)}/goods-receipts${query}`,
    );
  }

  getGoodsReceipt(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<GoodsReceiptDto>>(
      `${this.procurementUrl(propertyId)}/goods-receipts/${id}`,
    );
  }

  createGoodsReceipt(propertyId: string, dto: any) {
    return this.http.post<ApiSuccessResponse<GoodsReceiptDto>>(
      `${this.procurementUrl(propertyId)}/goods-receipts`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Stock Balances
  // -------------------------------------------------------------
  getStockBalances(propertyId: string) {
    return this.http.get<ApiSuccessResponse<StockBalanceDto[]>>(
      `${this.procurementUrl(propertyId)}/stock-balances`,
    );
  }

  getStockBalanceByItem(propertyId: string, inventoryItemId: string) {
    return this.http.get<ApiSuccessResponse<StockBalanceDto>>(
      `${this.procurementUrl(propertyId)}/stock-balances/${inventoryItemId}`,
    );
  }
}

