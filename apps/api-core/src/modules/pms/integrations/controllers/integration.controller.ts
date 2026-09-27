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
import { IntegrationService } from '../services/integration.service';
import {
  IntegrationDto,
  IntegrationSyncLogDto,
  IntegrationType,
  IntegrationStatus,
  SyncType,
} from '@hms/api-contracts';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  UpdateIntegrationStatusDto,
  TestIntegrationConnectionDto,
  IntegrationSyncLogQueryDto,
} from '../dto/integrations.dto';

@ApiTags('PMS - Integrations')
@ApiBearerAuth()
@Controller('properties/:propertyId/integrations')
@UseGuards(ScopedRbacGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  // ============================================================================
  // INTEGRATIONS CRUD
  // ============================================================================

  @Get()
  @RequirePermissions('integration:read')
  @ApiOperation({ summary: 'List all integrations for a property' })
  @ApiQuery({ name: 'type', enum: ['OTA', 'PAYMENT', 'EMAIL', 'WHATSAPP'], required: false })
  async findIntegrations(
    @Param('propertyId') propertyId: string,
    @Query('type') type?: IntegrationType,
  ): Promise<IntegrationDto[]> {
    return this.integrationService.findIntegrations(propertyId, type);
  }

  @Get(':id')
  @RequirePermissions('integration:read')
  @ApiOperation({ summary: 'Get integration by ID' })
  async findIntegrationById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<IntegrationDto> {
    return this.integrationService.findIntegrationById(propertyId, id);
  }

  @Post()
  @RequirePermissions('integration:create')
  @ApiOperation({ summary: 'Create a new integration' })
  async createIntegration(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateIntegrationDto,
  ): Promise<IntegrationDto> {
    return this.integrationService.createIntegration(propertyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('integration:update')
  @ApiOperation({ summary: 'Update integration' })
  async updateIntegration(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ): Promise<IntegrationDto> {
    return this.integrationService.updateIntegration(propertyId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('integration:update')
  @ApiOperation({ summary: 'Update integration status' })
  async updateIntegrationStatus(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationStatusDto,
  ): Promise<IntegrationDto> {
    return this.integrationService.updateIntegrationStatus(propertyId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('integration:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete integration' })
  async deleteIntegration(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.integrationService.deleteIntegration(propertyId, id);
  }

  // ============================================================================
  // CONNECTION TESTING
  // ============================================================================

  @Post('test/:type/:provider')
  @RequirePermissions('integration:test')
  @ApiOperation({ summary: 'Test connection to a provider' })
  @ApiParam({ name: 'type', enum: ['OTA', 'PAYMENT', 'EMAIL', 'WHATSAPP'] })
  @ApiParam({ name: 'provider', description: 'Provider identifier (e.g., booking_com, stripe, sendgrid)' })
  async testConnection(
    @Param('propertyId') propertyId: string,
    @Param('type') type: IntegrationType,
    @Param('provider') provider: string,
    @Body() dto: TestIntegrationConnectionDto,
  ): Promise<{ healthy: boolean; details?: any; error?: string }> {
    return this.integrationService.testConnection(dto, type, provider);
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  @Post(':id/sync')
  @RequirePermissions('integration:sync')
  @ApiOperation({ summary: 'Trigger manual sync' })
  @ApiQuery({ name: 'syncType', enum: ['MANUAL', 'SCHEDULED', 'WEBHOOK'], required: false })
  async triggerSync(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Query('syncType') syncType: SyncType = 'MANUAL',
  ): Promise<IntegrationSyncLogDto> {
    return this.integrationService.triggerSync(propertyId, id, syncType);
  }

  @Get(':id/sync-logs')
  @RequirePermissions('integration:read')
  @ApiOperation({ summary: 'Get sync logs for an integration' })
  async findSyncLogs(
    @Param('propertyId') propertyId: string,
    @Param('id') integrationId: string,
    @Query() query: IntegrationSyncLogQueryDto,
  ): Promise<IntegrationSyncLogDto[]> {
    return this.integrationService.findSyncLogs(propertyId, { ...query, integrationId });
  }
}