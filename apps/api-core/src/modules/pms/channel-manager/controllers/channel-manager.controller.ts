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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { RequirePermissions } from '../../../identity/presentation/decorators/authz.decorators';
import { ChannelManagerService } from '../services/channel-manager.service';
import {
  ChannelConfigDto,
  ChannelSyncLogDto,
  ChannelProvider,
  ChannelSyncType,
  ChannelSyncStatus,
  ReconciliationReportDto,
} from '@hms/api-contracts';
import {
  CreateChannelConfigDto,
  UpdateChannelConfigDto,
  ChannelSyncLogQueryDto,
  GenerateReconciliationDto,
  SimulateInboundReservationDto,
} from '../dto/channel-manager.dto';

@ApiTags('PMS - Channel Manager')
@ApiBearerAuth()
@Controller('properties/:propertyId/channels')
@UseGuards(ScopedRbacGuard)
export class ChannelManagerController {
  constructor(private readonly channelManagerService: ChannelManagerService) {}

  // ============================================================================
  // CHANNEL CONFIGURATION CRUD
  // ============================================================================

  @Get()
  @RequirePermissions('channel:read')
  @ApiOperation({ summary: 'List all channel configurations for a property' })
  @ApiQuery({ name: 'enabledOnly', required: false, type: Boolean })
  async findChannelConfigs(
    @Param('propertyId') propertyId: string,
    @Query('enabledOnly') enabledOnly?: boolean,
  ): Promise<ChannelConfigDto[]> {
    return this.channelManagerService.findChannelConfigs(propertyId, enabledOnly);
  }

  @Get(':id')
  @RequirePermissions('channel:read')
  @ApiOperation({ summary: 'Get channel configuration by ID' })
  async findChannelConfigById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ChannelConfigDto> {
    return this.channelManagerService.findChannelConfigById(propertyId, id);
  }

  @Post()
  @RequirePermissions('channel:create')
  @ApiOperation({ summary: 'Create a new channel configuration' })
  async createChannelConfig(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateChannelConfigDto,
  ): Promise<ChannelConfigDto> {
    return this.channelManagerService.createChannelConfig(propertyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('channel:update')
  @ApiOperation({ summary: 'Update channel configuration' })
  async updateChannelConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelConfigDto,
  ): Promise<ChannelConfigDto> {
    return this.channelManagerService.updateChannelConfig(propertyId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('channel:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete channel configuration' })
  async deleteChannelConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.channelManagerService.deleteChannelConfig(propertyId, id);
  }

  // ============================================================================
  // INBOUND RESERVATION PROCESSING (OTA → PMS)
  // ============================================================================

  @Post(':id/reservations/inbound')
  @RequirePermissions('channel:sync')
  @ApiOperation({ summary: 'Process inbound reservation from OTA (demo/webhook simulation)' })
  async processInboundReservation(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Body() dto: SimulateInboundReservationDto,
  ): Promise<{ reservationId: string; isNew: boolean; pmsReservationId?: string }> {
    return this.channelManagerService.processInboundReservation(propertyId, channelConfigId, dto);
  }

  // ============================================================================
  // OUTBOUND AVAILABILITY / RATE SYNC (PMS → OTA)
  // ============================================================================

  @Post(':id/sync/availability-rates')
  @RequirePermissions('channel:sync')
  @ApiOperation({ summary: 'Push availability and rates to OTA (demo simulation)' })
  async syncAvailabilityRates(
    @Param('propertyId') propertyId: string,
    @Param('id') channelConfigId: string,
    @Body() dto: { availability: any[]; rates: any[] },
  ): Promise<{ processed: number; failed: number }> {
    return this.channelManagerService.syncAvailabilityRates(propertyId, channelConfigId, dto.availability, dto.rates);
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
  ): Promise<ChannelSyncLogDto[]> {
    return this.channelManagerService.findSyncLogs(propertyId, { ...query, channelConfigId });
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
  ): Promise<ReconciliationReportDto> {
    return this.channelManagerService.generateReconciliation(propertyId, channelConfigId, dto);
  }
}