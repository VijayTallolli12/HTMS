import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiSuccessResponse } from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { RequirePermissions, RequirePropertyContext } from '../../../identity/presentation/decorators/authz.decorators';
import { ChannelManagerService } from '../services/channel-manager.service';
import {
  ChannelConfigDto,
  ChannelSyncLogDto,
  ReconciliationReportDto,
  ChannelAvailabilityRateSyncResult,
  InboundChannelReservationResult,
} from '@hms/api-contracts';
import {
  CreateChannelConfigDto,
  UpdateChannelConfigDto,
  ChannelSyncLogQueryDto,
  GenerateReconciliationDto,
  SimulateInboundReservationDto,
  DemoAvailabilityRateSyncDto,
} from '../dto/channel-manager.dto';

@ApiTags('PMS - Channel Manager')
@ApiBearerAuth()
@Controller('properties/:propertyId/channels')
@UseGuards(ScopedRbacGuard)
@RequirePropertyContext()
export class ChannelManagerController {
  constructor(private readonly channelManagerService: ChannelManagerService) {}

  // ============================================================================
  // CHANNEL CONFIGURATION CRUD
  // ============================================================================

  @Get()
  @RequirePermissions('channel:read')
  @ApiOperation({ summary: 'List explicitly labelled DEMO channel configurations for a property' })
  @ApiQuery({ name: 'enabledOnly', required: false, type: Boolean })
  async findChannelConfigs(
    @Param('propertyId') propertyId: string,
    @Query('enabledOnly') enabledOnly?: boolean,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelConfigDto[]>> {
    return createApiResponse(await this.channelManagerService.findChannelConfigs(propertyId, enabledOnly), req);
  }

  @Get(':id')
  @RequirePermissions('channel:read')
  @ApiOperation({ summary: 'Get channel configuration by ID' })
  async findChannelConfigById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelConfigDto>> {
    return createApiResponse(await this.channelManagerService.findChannelConfigById(propertyId, id), req);
  }

  @Post()
  @RequirePermissions('channel:create')
  @ApiOperation({ summary: 'Create an explicitly labelled DEMO channel configuration' })
  async createChannelConfig(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateChannelConfigDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelConfigDto>> {
    return createApiResponse(await this.channelManagerService.createChannelConfig(propertyId, dto), req);
  }

  @Patch(':id')
  @RequirePermissions('channel:update')
  @ApiOperation({ summary: 'Update DEMO channel configuration' })
  async updateChannelConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelConfigDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelConfigDto>> {
    return createApiResponse(await this.channelManagerService.updateChannelConfig(propertyId, id, dto), req);
  }

  @Delete(':id')
  @RequirePermissions('channel:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove DEMO channel configuration' })
  async deleteChannelConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.channelManagerService.deleteChannelConfig(propertyId, id);
  }

  // ============================================================================
  // INBOUND RESERVATION PROCESSING (DEMO fixture → PMS)
  // ============================================================================

  @Post(':id/reservations/inbound')
  @RequirePermissions('channel:sync')
  @ApiOperation({ summary: 'Ingest a DEMO reservation fixture into the PMS' })
  async processInboundReservation(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Body() dto: SimulateInboundReservationDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<InboundChannelReservationResult>> {
    return createApiResponse(await this.channelManagerService.processInboundReservation(propertyId, channelConfigId, dto), req);
  }

  // ============================================================================
  // OUTBOUND AVAILABILITY / RATE SYNC (PMS → DEMO adapter)
  // ============================================================================

  @Post(':id/sync/availability-rates')
  @RequirePermissions('channel:sync')
  @ApiOperation({ summary: 'Build PMS-sourced availability and rate data for the DEMO adapter' })
  async syncAvailabilityRates(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Body() dto: DemoAvailabilityRateSyncDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelAvailabilityRateSyncResult>> {
    return createApiResponse(await this.channelManagerService.syncAvailabilityRates(propertyId, channelConfigId, dto), req);
  }

  @Post(':id/sync-logs/:syncLogId/retry')
  @RequirePermissions('channel:sync')
  @ApiOperation({ summary: 'Retry a failed DEMO availability or rate synchronization' })
  async retrySync(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Param('syncLogId') syncLogId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelSyncLogDto>> {
    return createApiResponse(await this.channelManagerService.retrySync(propertyId, channelConfigId, syncLogId), req);
  }

  // ============================================================================
  // SYNC LOGS
  // ============================================================================

  @Get(':id/sync-logs')
  @RequirePermissions('channel:read')
  @ApiOperation({ summary: 'Get sync logs for a channel' })
  async findSyncLogs(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Query() query: ChannelSyncLogQueryDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ChannelSyncLogDto[]>> {
    return createApiResponse(await this.channelManagerService.findSyncLogs(propertyId, { ...query, channelConfigId }), req);
  }

  // ============================================================================
  // RECONCILIATION
  // ============================================================================

  @Post(':id/reconciliation')
  @RequirePermissions('channel:reconcile')
  @ApiOperation({ summary: 'Generate reconciliation report' })
  async generateReconciliation(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Body() dto: GenerateReconciliationDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReconciliationReportDto>> {
    return createApiResponse(await this.channelManagerService.generateReconciliation(propertyId, channelConfigId, dto), req);
  }
}