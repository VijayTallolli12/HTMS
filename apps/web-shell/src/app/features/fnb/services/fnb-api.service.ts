import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  OutletDto,
  RestaurantTableDto,
  MenuCategoryDto,
  MenuItemDto,
  FnbOrderDto,
  CreateOrderDto,
  AddOrderItemDto,
  UpdateOrderStatusDto,
  CloseOrderDto,
  TableStatus,
  FnbOrderStatus,
} from '@hms/api-contracts';
import { environment } from '../../../../environments/environment';

export interface InHouseGuestOption {
  reservationId: string;
  confirmationNumber: string;
  roomNumber: string;
  guestName: string;
  folioId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FnbApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private fnbUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/fnb`;
  }

  // -------------------------------------------------------------
  // Outlets
  // -------------------------------------------------------------
  getOutlets(propertyId: string) {
    return this.http.get<ApiSuccessResponse<OutletDto[]>>(
      `${this.fnbUrl(propertyId)}/outlets`,
    );
  }

  getOutlet(propertyId: string, outletId: string) {
    return this.http.get<ApiSuccessResponse<OutletDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}`,
    );
  }

  // -------------------------------------------------------------
  // Tables
  // -------------------------------------------------------------
  getTables(propertyId: string, outletId: string) {
    return this.http.get<ApiSuccessResponse<RestaurantTableDto[]>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/tables`,
    );
  }

  updateTableStatus(propertyId: string, tableId: string, status: TableStatus) {
    return this.http.patch<ApiSuccessResponse<RestaurantTableDto>>(
      `${this.fnbUrl(propertyId)}/tables/${tableId}/status`,
      { status },
    );
  }

  // -------------------------------------------------------------
  // Menu Categories & Items
  // -------------------------------------------------------------
  getCategories(propertyId: string, outletId: string) {
    return this.http.get<ApiSuccessResponse<MenuCategoryDto[]>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/categories`,
    );
  }

  getItems(propertyId: string, outletId: string, categoryId?: string) {
    const url = categoryId
      ? `${this.fnbUrl(propertyId)}/outlets/${outletId}/items?categoryId=${categoryId}`
      : `${this.fnbUrl(propertyId)}/outlets/${outletId}/items`;
    return this.http.get<ApiSuccessResponse<MenuItemDto[]>>(url);
  }

  getFullMenu(propertyId: string, outletId: string) {
    return this.http.get<
      ApiSuccessResponse<Array<MenuCategoryDto & { items: MenuItemDto[] }>>
    >(`${this.fnbUrl(propertyId)}/outlets/${outletId}/menu`);
  }

  // -------------------------------------------------------------
  // In-House Checked-in Guests
  // -------------------------------------------------------------
  getInHouseGuests(propertyId: string) {
    return this.http.get<ApiSuccessResponse<InHouseGuestOption[]>>(
      `${this.fnbUrl(propertyId)}/in-house-guests`,
    );
  }

  // -------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------
  getOrders(
    propertyId: string,
    params?: { outletId?: string; status?: FnbOrderStatus; tableId?: string },
  ) {
    const query = new URLSearchParams();
    if (params?.outletId) query.set('outletId', params.outletId);
    if (params?.status) query.set('status', params.status);
    if (params?.tableId) query.set('tableId', params.tableId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.http.get<ApiSuccessResponse<FnbOrderDto[]>>(
      `${this.fnbUrl(propertyId)}/orders${queryString}`,
    );
  }

  getOrder(propertyId: string, orderId: string) {
    return this.http.get<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}`,
    );
  }

  createOrder(propertyId: string, dto: CreateOrderDto) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders`,
      dto,
    );
  }

  addOrderItem(propertyId: string, orderId: string, dto: AddOrderItemDto) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/items`,
      dto,
    );
  }

  removeOrderItem(propertyId: string, orderId: string, itemId: string) {
    return this.http.delete<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/items/${itemId}`,
    );
  }

  updateOrderStatus(
    propertyId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/status`,
      dto,
    );
  }

  closeOrder(propertyId: string, orderId: string, dto: CloseOrderDto) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/close`,
      dto,
    );
  }
}
