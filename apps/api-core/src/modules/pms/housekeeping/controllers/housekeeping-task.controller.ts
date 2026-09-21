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
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  InspectionResult,
  SecurityContext,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { HousekeepingTaskService } from '../services/housekeeping-task.service';

@ApiTags('PMS - Housekeeping Tasks')
@Controller('properties/:propertyId/pms/housekeeping/tasks')
@RequirePropertyContext()
export class HousekeepingTaskController {
  constructor(private readonly taskService: HousekeepingTaskService) {}

  @Get()
  @RequirePermissions('housekeeping.task.view')
  @ApiOperation({ summary: 'List housekeeping tasks' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 200, description: 'Tasks listed successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('status') status?: HousekeepingTaskStatus,
    @Query('taskType') taskType?: HousekeepingTaskType,
    @Query('assignedAttendantId') assignedAttendantId?: string,
    @Query('roomId') roomId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.findAll(propertyId, {
      status,
      taskType,
      assignedAttendantId,
      roomId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return createApiResponse(data, req);
  }

  @Get(':taskId')
  @RequirePermissions('housekeeping.task.view')
  @ApiOperation({ summary: 'Get housekeeping task detail' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.findById(propertyId, taskId);
    return createApiResponse(data, req);
  }

  @Post(':taskId/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('housekeeping.task.assign')
  @ApiOperation({ summary: 'Assign or reassign a housekeeping task' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Task assigned successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or OCC conflict' })
  async assign(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { assignedAttendantId: string },
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.assign(
      propertyId,
      taskId,
      body.assignedAttendantId,
      actor.userId,
    );
    return createApiResponse(data, req);
  }

  @Post(':taskId/claim')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('housekeeping.task.claim')
  @ApiOperation({ summary: 'Self-claim an unassigned housekeeping task' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Task claimed successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Task already assigned or OCC conflict' })
  async claim(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.claim(propertyId, taskId, actor.userId);
    return createApiResponse(data, req);
  }

  @Patch(':taskId/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('housekeeping.task.start')
  @ApiOperation({ summary: 'Start cleaning (attendant begins work)' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Cleaning started' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or not assigned' })
  async startCleaning(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.startCleaning(propertyId, taskId, actor.userId);
    return createApiResponse(data, req);
  }

  @Patch(':taskId/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('housekeeping.task.complete')
  @ApiOperation({ summary: 'Complete cleaning (attendant marks room clean)' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Cleaning completed' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or not assigned' })
  async completeCleaning(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.completeCleaning(propertyId, taskId, actor.userId);
    return createApiResponse(data, req);
  }

  @Post(':taskId/inspect')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('housekeeping.task.inspect')
  @ApiOperation({ summary: 'Inspect a cleaned room (supervisor pass/fail)' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'taskId', type: String })
  @ApiResponse({ status: 200, description: 'Inspection recorded' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or OCC conflict' })
  async inspect(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { result: InspectionResult; notes?: string },
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.taskService.inspect(
      propertyId,
      taskId,
      body.result,
      body.notes,
      actor.userId,
    );
    return createApiResponse(data, req);
  }
}
