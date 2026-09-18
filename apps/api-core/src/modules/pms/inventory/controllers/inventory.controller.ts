import { Controller, Get, Param, Query, Req, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { InventoryService } from '../services/inventory.service';
import { QueryInventoryCalendarDto } from '../dto/query-inventory-calendar.dto';
import { QueryAvailabilityDto } from '../dto/query-availability.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { DailyInventoryDto, StayQuoteResponse, ApiSuccessResponse } from '@hms/api-contracts';
import {
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Inventory & Availability')
@Controller('properties/:propertyId/pms')
@RequirePropertyContext()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory/calendar')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get daily inventory and ATS calendar matrix' })
  @ApiResponse({ status: 200, description: 'Inventory calendar retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid date range' })
  async getCalendar(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryInventoryCalendarDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<DailyInventoryDto[]>> {
    const data = await this.inventoryService.getInventoryCalendar(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get('availability/quote')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Quote stay availability and pricing across rate plans' })
  @ApiResponse({ status: 200, description: 'Stay quote generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stay dates or occupancy' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getQuote(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryAvailabilityDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<StayQuoteResponse>> {
    const data = await this.inventoryService.getStayQuote(propertyId, query);
    return createApiResponse(data, req);
  }
}
