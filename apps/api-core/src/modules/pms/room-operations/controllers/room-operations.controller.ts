import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { RoomStatusService } from '../services/room-status.service';
import { RoomMaintenanceService } from '../services/room-maintenance.service';
import { UpdateRoomStatusDto } from '../dto/update-room-status.dto';
import { CreateMaintenanceBlockDto } from '../dto/create-maintenance-block.dto';
import { CancelMaintenanceBlockDto } from '../dto/cancel-maintenance-block.dto';
import { ReplaceMaintenanceBlockDto } from '../dto/replace-maintenance-block.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  MaintenanceBlockDto,
  MaintenanceBlockResponseDto,
  QueryMaintenanceBlocksDto,
  QueryRoomStatusDto,
  RoomStatusDto,
  RoomStatusLogDto,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Room Operations')
@Controller('properties/:propertyId/pms/room-operations')
@RequirePropertyContext()
export class RoomOperationsController {
  constructor(
    private readonly roomStatusService: RoomStatusService,
    private readonly roomMaintenanceService: RoomMaintenanceService,
  ) {}

  @Get('rooms')
  @RequirePermissions('room_operations.status.read')
  @ApiOperation({ summary: 'List all rooms with effective status for property' })
  @ApiResponse({ status: 200, description: 'Rooms returned successfully' })
  async findAllRooms(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryRoomStatusDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomStatusDto[]>> {
    const data = await this.roomStatusService.findAll(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get('rooms/:roomId')
  @RequirePermissions('room_operations.status.read')
  @ApiOperation({ summary: 'Get single room with effective status' })
  @ApiResponse({ status: 200, description: 'Room status returned successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findRoomById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomStatusDto>> {
    const data = await this.roomStatusService.findById(propertyId, roomId);
    return createApiResponse(data, req);
  }

  @Patch('rooms/:roomId/status')
  @RequirePermissions('room_operations.status.update')
  @ApiOperation({ summary: 'Update housekeeping status with state machine enforcement' })
  @ApiResponse({ status: 200, description: 'Room status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid state machine transition' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Optimistic concurrency conflict' })
  async updateHousekeepingStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomStatusDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomStatusDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.roomStatusService.updateHousekeepingStatus(
      propertyId,
      roomId,
      dto,
      userId,
    );
    return createApiResponse(data, req);
  }

  @Get('rooms/:roomId/history')
  @RequirePermissions('room_operations.status.read')
  @ApiOperation({ summary: 'Get room status transition history audit log' })
  @ApiResponse({ status: 200, description: 'Audit logs returned successfully' })
  async getRoomStatusHistory(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ): Promise<
    ApiSuccessResponse<{ items: RoomStatusLogDto[]; total: number; page: number; limit: number }>
  > {
    const data = await this.roomStatusService.getStatusHistory(
      propertyId,
      roomId,
      Number(page) || 1,
      Number(limit) || 20,
    );
    return createApiResponse(data, req);
  }

  @Post('maintenance-blocks')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('room_operations.maintenance.create')
  @ApiOperation({ summary: 'Create Out-of-Order or Out-of-Service maintenance block' })
  @ApiResponse({ status: 201, description: 'Maintenance block created successfully' })
  @ApiResponse({ status: 400, description: 'Validation or date range error' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Overlap conflict with existing active block' })
  async createMaintenanceBlock(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateMaintenanceBlockDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MaintenanceBlockResponseDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.roomMaintenanceService.create(propertyId, dto, userId);
    return createApiResponse(data, req);
  }

  @Get('maintenance-blocks')
  @RequirePermissions('room_operations.status.read')
  @ApiOperation({ summary: 'List maintenance blocks with property-scoped filters' })
  @ApiResponse({ status: 200, description: 'Maintenance blocks returned successfully' })
  async findAllMaintenanceBlocks(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryMaintenanceBlocksDto,
    @Req() req?: Request,
  ): Promise<
    ApiSuccessResponse<{ items: MaintenanceBlockDto[]; total: number; page: number; limit: number }>
  > {
    const data = await this.roomMaintenanceService.findAll(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get('maintenance-blocks/:id')
  @RequirePermissions('room_operations.status.read')
  @ApiOperation({ summary: 'Get single maintenance block by ID' })
  @ApiResponse({ status: 200, description: 'Maintenance block returned successfully' })
  @ApiResponse({ status: 404, description: 'Maintenance block not found' })
  async findMaintenanceBlockById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MaintenanceBlockDto>> {
    const data = await this.roomMaintenanceService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('maintenance-blocks/:id/cancel')
  @RequirePermissions('room_operations.maintenance.cancel')
  @ApiOperation({ summary: 'Cancel/end an active maintenance block' })
  @ApiResponse({ status: 200, description: 'Maintenance block cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Maintenance block not found' })
  @ApiResponse({ status: 409, description: 'Block is not in ACTIVE status' })
  async cancelMaintenanceBlock(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMaintenanceBlockDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MaintenanceBlockDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.roomMaintenanceService.cancel(propertyId, id, dto, userId);
    return createApiResponse(data, req);
  }

  @Post('maintenance-blocks/:id/replace')
  @RequirePermissions('room_operations.maintenance.create')
  @ApiOperation({ summary: 'Atomic OOO <-> OOS replacement of an active maintenance block' })
  @ApiResponse({ status: 200, description: 'Maintenance block replaced successfully' })
  @ApiResponse({ status: 400, description: 'Same type or validation error' })
  @ApiResponse({ status: 404, description: 'Maintenance block not found' })
  @ApiResponse({ status: 409, description: 'Block not active or concurrency conflict' })
  async replaceMaintenanceBlock(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceMaintenanceBlockDto,
    @CurrentSecurityContext() securityContext?: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<MaintenanceBlockResponseDto>> {
    const userId = securityContext?.userId || (req as any)?.user?.id || 'SYSTEM';
    const data = await this.roomMaintenanceService.replace(propertyId, id, dto, userId);
    return createApiResponse(data, req);
  }
}
