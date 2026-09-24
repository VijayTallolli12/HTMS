import {
  Body,
  Controller,
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
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  RequirePermissions,
  RequirePropertyContext,
  CurrentSecurityContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import {
  AddWorkOrderNoteRequest,
  AssignWorkOrderRequest,
  CloseWorkOrderRequest,
  CreateWorkOrderRequest,
  SecurityContext,
  UpdateWorkOrderStatusRequest,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { WorkOrderService } from '../services/work-order.service';

@ApiTags('PMS - Engineering Work Orders')
@Controller('properties/:propertyId/pms/engineering/work-orders')
@RequirePropertyContext()
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get()
  @RequirePermissions('engineering.work_order.view')
  @ApiOperation({ summary: 'List maintenance work orders' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 200, description: 'Work orders retrieved successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('status') status?: WorkOrderStatus,
    @Query('priority') priority?: WorkOrderPriority,
    @Query('assignedTechnicianId') assignedTechnicianId?: string,
    @Query('roomId') roomId?: string,
    @Query('assetId') assetId?: string,
    @Query('overdue') overdue?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.findAll(propertyId, {
      status,
      priority,
      assignedTechnicianId,
      roomId,
      assetId,
      overdue: overdue === 'true',
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return createApiResponse(data, req);
  }

  @Get('summary')
  @RequirePermissions('engineering.work_order.view')
  @ApiOperation({ summary: 'Get operational summary counts for engineering dashboard' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 200, description: 'Summary counts retrieved successfully' })
  async getSummary(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.getSummary(propertyId);
    return createApiResponse(data, req);
  }

  @Get(':workOrderId')
  @RequirePermissions('engineering.work_order.view')
  @ApiOperation({ summary: 'Get work order detail with notes' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'workOrderId', type: String })
  @ApiResponse({ status: 200, description: 'Work order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.findById(propertyId, workOrderId);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('engineering.work_order.create')
  @ApiOperation({ summary: 'Create new maintenance work order' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 201, description: 'Work order created successfully' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() body: CreateWorkOrderRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.create(propertyId, body, actor.userId);
    return createApiResponse(data, req);
  }

  @Post(':workOrderId/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('engineering.work_order.assign')
  @ApiOperation({ summary: 'Assign technician to work order' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'workOrderId', type: String })
  @ApiResponse({ status: 200, description: 'Work order assigned successfully' })
  @ApiResponse({ status: 404, description: 'Work order or technician not found' })
  async assign(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Body() body: AssignWorkOrderRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.assign(
      propertyId,
      workOrderId,
      body,
      actor.userId,
    );
    return createApiResponse(data, req);
  }

  @Patch(':workOrderId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('engineering.work_order.status_update')
  @ApiOperation({ summary: 'Update work order status (IN_PROGRESS or COMPLETED)' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'workOrderId', type: String })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  async updateStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Body() body: UpdateWorkOrderStatusRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.updateStatus(
      propertyId,
      workOrderId,
      body,
      actor.userId,
    );
    return createApiResponse(data, req);
  }

  @Post(':workOrderId/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('engineering.work_order.close')
  @ApiOperation({ summary: 'Close a completed work order' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'workOrderId', type: String })
  @ApiResponse({ status: 200, description: 'Work order closed successfully' })
  @ApiResponse({ status: 400, description: 'Work order is not completed' })
  async close(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Body() body: CloseWorkOrderRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.close(
      propertyId,
      workOrderId,
      body,
      actor.userId,
    );
    return createApiResponse(data, req);
  }

  @Post(':workOrderId/notes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('engineering.work_order.note')
  @ApiOperation({ summary: 'Add progress note to work order' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'workOrderId', type: String })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  async addNote(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Body() body: AddWorkOrderNoteRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.workOrderService.addNote(
      propertyId,
      workOrderId,
      body,
      actor.userId,
    );
    return createApiResponse(data, req);
  }
}

