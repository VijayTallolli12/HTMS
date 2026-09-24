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
  CreateMaintenanceScheduleRequest,
  ScheduleDueStatus,
  SecurityContext,
  UpdateMaintenanceScheduleRequest,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { MaintenanceScheduleService } from '../services/maintenance-schedule.service';

@ApiTags('PMS - Preventive Maintenance Schedules')
@Controller('properties/:propertyId/pms/engineering/schedules')
@RequirePropertyContext()
export class MaintenanceScheduleController {
  constructor(private readonly scheduleService: MaintenanceScheduleService) {}

  @Get()
  @RequirePermissions('engineering.schedule.view')
  @ApiOperation({ summary: 'List preventive maintenance schedules' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('assetId') assetId?: string,
    @Query('isActive') isActive?: string,
    @Query('dueStatus') dueStatus?: ScheduleDueStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const data = await this.scheduleService.findAll(propertyId, {
      assetId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      dueStatus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return createApiResponse(data, req);
  }

  @Get(':scheduleId')
  @RequirePermissions('engineering.schedule.view')
  @ApiOperation({ summary: 'Get maintenance schedule detail' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'scheduleId', type: String })
  @ApiResponse({ status: 200, description: 'Schedule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Req() req?: Request,
  ) {
    const data = await this.scheduleService.findById(propertyId, scheduleId);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('engineering.schedule.manage')
  @ApiOperation({ summary: 'Create new preventive maintenance schedule' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() body: CreateMaintenanceScheduleRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.scheduleService.create(propertyId, body, actor.userId);
    return createApiResponse(data, req);
  }

  @Patch(':scheduleId')
  @RequirePermissions('engineering.schedule.manage')
  @ApiOperation({ summary: 'Update preventive maintenance schedule' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'scheduleId', type: String })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 409, description: 'OCC conflict' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() body: UpdateMaintenanceScheduleRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.scheduleService.update(propertyId, scheduleId, body, actor.userId);
    return createApiResponse(data, req);
  }
}

