import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ProcurementService } from '../services/procurement.service';
import {
  ApiSuccessResponse,
  GoodsReceiptDto,
  InventoryItemDto,
  PurchaseOrderDto,
  PurchaseOrderStatus,
  SecurityContext,
  StockBalanceDto,
  SupplierDto,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import {
  CreateGoodsReceiptDto,
  CreateInventoryItemDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  UpdateInventoryItemDto,
  UpdatePurchaseOrderStatusDto,
  UpdateSupplierDto,
} from '../dto/procurement.dto';

@ApiTags('PMS - Procurement & Inventory')
@Controller('properties/:propertyId/procurement')
@RequirePropertyContext()
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ============================================================================
  // SUPPLIERS
  // ============================================================================

  @Get('suppliers')
  @RequirePermissions('procurement.supplier.view')
  @ApiOperation({ summary: 'List all suppliers for property' })
  async getSuppliers(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('active') active?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<SupplierDto[]>> {
    const activeOnly = active !== undefined ? active === 'true' : undefined;
    const data = await this.procurementService.findSuppliers(propertyId, activeOnly);
    return createApiResponse(data, req);
  }

  @Get('suppliers/:id')
  @RequirePermissions('procurement.supplier.view')
  @ApiOperation({ summary: 'Get supplier details by ID' })
  async getSupplier(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<SupplierDto>> {
    const data = await this.procurementService.findSupplierById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('suppliers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement.supplier.manage')
  @ApiOperation({ summary: 'Create a new supplier' })
  async createSupplier(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateSupplierDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<SupplierDto>> {
    const data = await this.procurementService.createSupplier(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('procurement.supplier.manage')
  @ApiOperation({ summary: 'Update an existing supplier' })
  async updateSupplier(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<SupplierDto>> {
    const data = await this.procurementService.updateSupplier(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  @Delete('suppliers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('procurement.supplier.manage')
  @ApiOperation({ summary: 'Deactivate supplier' })
  async deleteSupplier(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.procurementService.deleteSupplier(propertyId, id);
  }

  // ============================================================================
  // INVENTORY ITEMS
  // ============================================================================

  @Get('items')
  @RequirePermissions('procurement.item.view')
  @ApiOperation({ summary: 'List inventory items for property' })
  async getItems(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<InventoryItemDto[]>> {
    const activeOnly = active !== undefined ? active === 'true' : undefined;
    const data = await this.procurementService.findItems(propertyId, category, activeOnly);
    return createApiResponse(data, req);
  }

  @Get('items/:id')
  @RequirePermissions('procurement.item.view')
  @ApiOperation({ summary: 'Get inventory item details by ID' })
  async getItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<InventoryItemDto>> {
    const data = await this.procurementService.findItemById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement.item.manage')
  @ApiOperation({ summary: 'Create an inventory item' })
  async createItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateInventoryItemDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<InventoryItemDto>> {
    const data = await this.procurementService.createItem(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Patch('items/:id')
  @RequirePermissions('procurement.item.manage')
  @ApiOperation({ summary: 'Update an inventory item' })
  async updateItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<InventoryItemDto>> {
    const data = await this.procurementService.updateItem(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('procurement.item.manage')
  @ApiOperation({ summary: 'Deactivate inventory item' })
  async deleteItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.procurementService.deleteItem(propertyId, id);
  }

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  @Get('purchase-orders')
  @RequirePermissions('procurement.po.view')
  @ApiOperation({ summary: 'List purchase orders' })
  async getPurchaseOrders(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('supplierId') supplierId?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PurchaseOrderDto[]>> {
    const data = await this.procurementService.findPurchaseOrders(propertyId, status, supplierId);
    return createApiResponse(data, req);
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('procurement.po.view')
  @ApiOperation({ summary: 'Get purchase order details' })
  async getPurchaseOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PurchaseOrderDto>> {
    const data = await this.procurementService.findPurchaseOrderById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement.po.create')
  @ApiOperation({ summary: 'Create purchase order with line items' })
  async createPurchaseOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentSecurityContext() sec?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PurchaseOrderDto>> {
    const data = await this.procurementService.createPurchaseOrder(propertyId, dto, sec?.userId);
    return createApiResponse(data, req);
  }

  @Patch('purchase-orders/:id/status')
  @RequirePermissions('procurement.po.approve')
  @ApiOperation({ summary: 'Transition purchase order lifecycle status' })
  async updatePurchaseOrderStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
    @CurrentSecurityContext() sec?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PurchaseOrderDto>> {
    const data = await this.procurementService.updatePurchaseOrderStatus(
      propertyId,
      id,
      dto.status,
      sec?.userId,
    );
    return createApiResponse(data, req);
  }

  // ============================================================================
  // GOODS RECEIPTS
  // ============================================================================

  @Get('goods-receipts')
  @RequirePermissions('procurement.receipt.view')
  @ApiOperation({ summary: 'List goods receipts' })
  async getGoodsReceipts(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<GoodsReceiptDto[]>> {
    const data = await this.procurementService.findGoodsReceipts(propertyId, purchaseOrderId);
    return createApiResponse(data, req);
  }

  @Get('goods-receipts/:id')
  @RequirePermissions('procurement.receipt.view')
  @ApiOperation({ summary: 'Get goods receipt details by ID' })
  async getGoodsReceipt(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<GoodsReceiptDto>> {
    const data = await this.procurementService.findGoodsReceiptById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('goods-receipts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement.receipt.create')
  @ApiOperation({ summary: 'Receive goods against purchase order and update stock balances' })
  async createGoodsReceipt(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentSecurityContext() sec?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<GoodsReceiptDto>> {
    const data = await this.procurementService.createGoodsReceipt(propertyId, dto, sec?.userId);
    return createApiResponse(data, req);
  }

  // ============================================================================
  // STOCK BALANCES
  // ============================================================================

  @Get('stock-balances')
  @RequirePermissions('procurement.stock.view')
  @ApiOperation({ summary: 'View all stock balances for property' })
  async getStockBalances(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<StockBalanceDto[]>> {
    const data = await this.procurementService.findStockBalances(propertyId);
    return createApiResponse(data, req);
  }

  @Get('stock-balances/:inventoryItemId')
  @RequirePermissions('procurement.stock.view')
  @ApiOperation({ summary: 'View stock balance for specific inventory item' })
  async getStockBalanceByItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('inventoryItemId', ParseUUIDPipe) inventoryItemId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<StockBalanceDto>> {
    const data = await this.procurementService.findStockBalanceByItemId(propertyId, inventoryItemId);
    return createApiResponse(data, req);
  }
}

