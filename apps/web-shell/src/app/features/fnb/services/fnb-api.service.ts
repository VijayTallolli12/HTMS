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
  UpdateMenuCategoryDto,
  UpdateOrderStatusDto,
  CloseOrderDto,
  TableStatus,
  FnbOrderStatus,
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

  updateTableStatus(propertyId: string, outletId: string, tableId: string, status: TableStatus) {
    return this.http.patch<ApiSuccessResponse<RestaurantTableDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/tables/${tableId}/status`,
      { status },
    );
  }

  // -------------------------------------------------------------
  // Menu Categories & Items
  // -------------------------------------------------------------
  getCategories(propertyId: string, outletId: string) {
    return this.http.get<ApiSuccessResponse<MenuCategoryDto[]>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/categories`,
    );
  }

  createCategory(propertyId: string, outletId: string, dto: { code: string; name: string; displayOrder?: number }) {
    return this.http.post<ApiSuccessResponse<MenuCategoryDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/categories`,
      dto,
    );
  }

  updateCategory(propertyId: string, outletId: string, categoryId: string, dto: UpdateMenuCategoryDto) {
    return this.http.patch<ApiSuccessResponse<MenuCategoryDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/categories/${categoryId}`,
      dto,
    );
  }

  getItems(propertyId: string, outletId: string, categoryId?: string) {
    const url = categoryId
      ? `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items?categoryId=${categoryId}`
      : `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items`;
    return this.http.get<ApiSuccessResponse<MenuItemDto[]>>(url);
  }

  createItem(propertyId: string, outletId: string, dto: any) {
    return this.http.post<ApiSuccessResponse<MenuItemDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items`,
      dto,
    );
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
    return this.http.patch<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/status`,
      dto,
    );
  }

  submitOrder(propertyId: string, orderId: string) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/submit`,
      null,
    );
  }

  closeOrder(propertyId: string, orderId: string, dto: CloseOrderDto) {
    return this.http.post<ApiSuccessResponse<FnbOrderDto>>(
      `${this.fnbUrl(propertyId)}/orders/${orderId}/close`,
      dto,
    );
  }

  // -------------------------------------------------------------
  // Menu Item Detail (with variants and modifiers)
  // -------------------------------------------------------------
  getMenuItemDetail(propertyId: string, outletId: string, itemId: string) {
    return this.http.get<ApiSuccessResponse<MenuItemDetailDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}`,
    );
  }

  updateMenuItem(propertyId: string, outletId: string, itemId: string, dto: UpdateMenuItemDto) {
    return this.http.patch<ApiSuccessResponse<MenuItemDetailDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}`,
      dto,
    );
  }

  updateMenuItemAvailability(propertyId: string, outletId: string, itemId: string, dto: UpdateMenuItemAvailabilityDto) {
    return this.http.patch<ApiSuccessResponse<MenuItemDetailDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/availability`,
      dto,
    );
  }

  updateMenuItemPrice(propertyId: string, outletId: string, itemId: string, dto: UpdateMenuItemPriceDto) {
    return this.http.patch<ApiSuccessResponse<MenuItemPriceDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/price`,
      dto,
    );
  }

  searchMenuItems(propertyId: string, outletId: string, query: QueryMenuItemsDto) {
    const params = new URLSearchParams();
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.availability) params.set('availability', query.availability);
    if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<
      ApiSuccessResponse<{ items: MenuItemDto[]; total: number; page: number; limit: number }>
    >(`${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/search${queryString}`);
  }

  // -------------------------------------------------------------
  // Menu Item Variants
  // -------------------------------------------------------------
  createVariant(propertyId: string, outletId: string, itemId: string, dto: CreateMenuItemVariantDto) {
    return this.http.post<ApiSuccessResponse<MenuItemVariantDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/variants`,
      dto,
    );
  }

  updateVariant(propertyId: string, outletId: string, itemId: string, variantId: string, dto: UpdateMenuItemVariantDto) {
    return this.http.patch<ApiSuccessResponse<MenuItemVariantDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/variants/${variantId}`,
      dto,
    );
  }

  deleteVariant(propertyId: string, outletId: string, itemId: string, variantId: string) {
    return this.http.delete(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/variants/${variantId}`,
    );
  }

  // -------------------------------------------------------------
  // Modifier Groups
  // -------------------------------------------------------------
  createModifierGroup(propertyId: string, outletId: string, itemId: string, dto: CreateModifierGroupDto) {
    return this.http.post<ApiSuccessResponse<ModifierGroupDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups`,
      dto,
    );
  }

  updateModifierGroup(propertyId: string, outletId: string, itemId: string, groupId: string, dto: UpdateModifierGroupDto) {
    return this.http.patch<ApiSuccessResponse<ModifierGroupDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups/${groupId}`,
      dto,
    );
  }

  deleteModifierGroup(propertyId: string, outletId: string, itemId: string, groupId: string) {
    return this.http.delete(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups/${groupId}`,
    );
  }

  // -------------------------------------------------------------
  // Modifiers
  // -------------------------------------------------------------
  createModifier(propertyId: string, outletId: string, itemId: string, groupId: string, dto: CreateModifierDto) {
    return this.http.post<ApiSuccessResponse<ModifierDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups/${groupId}/modifiers`,
      dto,
    );
  }

  updateModifier(propertyId: string, outletId: string, itemId: string, groupId: string, modifierId: string, dto: UpdateModifierDto) {
    return this.http.patch<ApiSuccessResponse<ModifierDto>>(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups/${groupId}/modifiers/${modifierId}`,
      dto,
    );
  }

  deleteModifier(propertyId: string, outletId: string, itemId: string, groupId: string, modifierId: string) {
    return this.http.delete(
      `${this.fnbUrl(propertyId)}/outlets/${outletId}/menu/items/${itemId}/modifier-groups/${groupId}/modifiers/${modifierId}`,
    );
  }
}
