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
import { FnbOutletService } from '../services/fnb-outlet.service';
import { FnbMenuService } from '../services/fnb-menu.service';
import { FnbOrderService } from '../services/fnb-order.service';
import { createApiResponse } from '../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  MenuCategoryDto,
  MenuItemDto,
  OutletDto,
  RestaurantTableDto,
  FnbOrderDto,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../identity/presentation/decorators/authz.decorators';
import {
  CreateOutletDto,
  CreateTableDto,
  UpdateTableStatusDto,
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  CreateOrderDto,
  AddOrderItemDto,
  UpdateOrderStatusDto,
  CloseOrderDto,
  QueryFnbOrdersDto,
} from '../dto/fnb.dto';

@ApiTags('F&B - Restaurant & Outlets')
@Controller('properties/:propertyId/fnb')
@RequirePropertyContext()
export class FnbController {
  constructor(
    private readonly outletService: FnbOutletService,
    private readonly menuService: FnbMenuService,
    private readonly orderService: FnbOrderService,
  ) {}

  // ----------------------------------------------------------------------
  // Outlets
  // ----------------------------------------------------------------------
  @Get('outlets')
  @RequirePermissions('fnb.outlet.view')
  @ApiOperation({ summary: 'List all F&B outlets for property' })
  async getOutlets(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<OutletDto[]>> {
    const data = await this.outletService.findAllOutlets(propertyId);
    return createApiResponse(data, req);
  }

  @Post('outlets')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.outlet.view')
  @ApiOperation({ summary: 'Create a new F&B outlet' })
  async createOutlet(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateOutletDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<OutletDto>> {
    const data = await this.outletService.createOutlet(propertyId, dto);
    return createApiResponse(data, req);
  }

  // ----------------------------------------------------------------------
  // Tables
  // ----------------------------------------------------------------------
  @Get('outlets/:outletId/tables')
  @RequirePermissions('fnb.table.view')
  @ApiOperation({ summary: 'List all tables with active orders for outlet' })
  async getTables(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RestaurantTableDto[]>> {
    const data = await this.outletService.findAllTables(propertyId, outletId);
    return createApiResponse(data, req);
  }

  @Post('outlets/:outletId/tables')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.table.view')
  @ApiOperation({ summary: 'Add a dining table to outlet floor plan' })
  async createTable(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Body() dto: CreateTableDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RestaurantTableDto>> {
    const data = await this.outletService.createTable(propertyId, outletId, dto);
    return createApiResponse(data, req);
  }

  @Patch('outlets/:outletId/tables/:tableId/status')
  @RequirePermissions('fnb.table.view')
  @ApiOperation({ summary: 'Update table service status' })
  async updateTableStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableStatusDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RestaurantTableDto>> {
    const data = await this.outletService.updateTableStatus(
      propertyId,
      outletId,
      tableId,
      dto,
    );
    return createApiResponse(data, req);
  }

  // ----------------------------------------------------------------------
  // Menu Categories & Items
  // ----------------------------------------------------------------------
  @Get('outlets/:outletId/menu/categories')
  @RequirePermissions('fnb.menu.view')
  @ApiOperation({ summary: 'List menu categories for outlet' })
  async getMenuCategories(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MenuCategoryDto[]>> {
    const data = await this.menuService.findAllCategories(propertyId, outletId);
    return createApiResponse(data, req);
  }

  @Post('outlets/:outletId/menu/categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.menu.manage')
  @ApiOperation({ summary: 'Create a menu category' })
  async createMenuCategory(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Body() dto: CreateMenuCategoryDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MenuCategoryDto>> {
    const data = await this.menuService.createCategory(propertyId, outletId, dto);
    return createApiResponse(data, req);
  }

  @Get('outlets/:outletId/menu/items')
  @RequirePermissions('fnb.menu.view')
  @ApiOperation({ summary: 'List menu items for outlet' })
  async getMenuItems(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Query('categoryId') categoryId?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MenuItemDto[]>> {
    const data = await this.menuService.findAllMenuItems(propertyId, outletId, categoryId);
    return createApiResponse(data, req);
  }

  @Post('outlets/:outletId/menu/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.menu.manage')
  @ApiOperation({ summary: 'Create a new menu item' })
  async createMenuItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('outletId') outletId: string,
    @Body() dto: CreateMenuItemDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MenuItemDto>> {
    const data = await this.menuService.createMenuItem(propertyId, outletId, dto);
    return createApiResponse(data, req);
  }

  // ----------------------------------------------------------------------
  // Orders & Lifecycle
  // ----------------------------------------------------------------------
  @Get('orders')
  @RequirePermissions('fnb.order.view')
  @ApiOperation({ summary: 'List F&B orders with property-scoped filters' })
  async getOrders(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryFnbOrdersDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto[]>> {
    const data = await this.orderService.findOrders(propertyId, query);
    return createApiResponse(data, req);
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.order.create')
  @ApiOperation({ summary: 'Open a new F&B table order' })
  async createOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateOrderDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.orderService.createOrder(propertyId, dto, userId);
    return createApiResponse(data, req);
  }

  @Get('orders/:orderId')
  @RequirePermissions('fnb.order.view')
  @ApiOperation({ summary: 'Get single F&B order details' })
  async getOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const data = await this.orderService.findOrderById(propertyId, orderId);
    return createApiResponse(data, req);
  }

  @Post('orders/:orderId/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fnb.order.create')
  @ApiOperation({ summary: 'Add an item to an active order' })
  async addOrderItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Body() dto: AddOrderItemDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const data = await this.orderService.addOrderItem(propertyId, orderId, dto);
    return createApiResponse(data, req);
  }

  @Delete('orders/:orderId/items/:itemId')
  @RequirePermissions('fnb.order.create')
  @ApiOperation({ summary: 'Remove an item from an open order' })
  async removeOrderItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const data = await this.orderService.removeOrderItem(propertyId, orderId, itemId);
    return createApiResponse(data, req);
  }

  @Post('orders/:orderId/submit')
  @RequirePermissions('fnb.order.manage')
  @ApiOperation({ summary: 'Submit order to kitchen (OPEN -> ORDERED)' })
  async submitOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const data = await this.orderService.submitOrder(propertyId, orderId);
    return createApiResponse(data, req);
  }

  @Patch('orders/:orderId/status')
  @RequirePermissions('fnb.order.manage')
  @ApiOperation({ summary: 'Progress order lifecycle status' })
  async updateOrderStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.orderService.updateOrderStatus(
      propertyId,
      orderId,
      dto,
      userId,
    );
    return createApiResponse(data, req);
  }

  @Post('orders/:orderId/close')
  @RequirePermissions('fnb.order.close')
  @ApiOperation({ summary: 'Close order and settle via Folio Room Charge or Direct Payment' })
  async closeOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CloseOrderDto,
    @CurrentSecurityContext() securityContext: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FnbOrderDto>> {
    const actor = securityContext || {
      userId: (req as any)?.user?.id || 'SYSTEM',
      hotelGroupId: (req as any)?.user?.activeContext?.hotelGroupId || '',
      propertyId,
    };
    const data = await this.orderService.closeOrder(propertyId, orderId, dto, actor);
    return createApiResponse(data, req);
  }

  // ----------------------------------------------------------------------
  // In-House Guest Lookup Helper for Quick Folio Posting
  // ----------------------------------------------------------------------
  @Get('in-house-guests')
  @RequirePermissions('fnb.order.create')
  @ApiOperation({ summary: 'List checked-in guests and room numbers for instant room charge selection' })
  async getInHouseGuests(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<Array<{
    reservationId: string;
    confirmationNumber: string;
    roomNumber: string;
    guestName: string;
    folioId: string | null;
  }>>> {
    const data = await this.orderService.getInHouseGuests(propertyId);
    return createApiResponse(data, req);
  }
}

