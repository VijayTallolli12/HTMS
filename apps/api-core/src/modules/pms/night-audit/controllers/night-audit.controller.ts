import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiSuccessResponse,
  NightAuditRecoveryRequest,
  NightAuditRunDto,
  NightAuditStatusDto,
  NightAuditValidationReportDto,
  PropertyBusinessDateDto,
  SecurityContext,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import { NightAuditService } from '../services/night-audit.service';
import { RunNightAuditDto } from '../dto/run-night-audit.dto';
import { NightAuditRecoveryDto } from '../dto/night-audit-recovery.dto';

@ApiTags('PMS - Night Audit & Hotel Business Date')
@Controller('properties/:propertyId/pms/night-audit')
@RequirePropertyContext()
export class NightAuditController {
  constructor(private readonly nightAuditService: NightAuditService) {}

  @Get('status')
  @RequirePermissions('night_audit:view')
  @ApiOperation({ summary: 'Get current hotel business date, timezone context, and night audit status' })
  @ApiResponse({ status: 200, description: 'Hotel business date and audit status' })
  public async getStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<ApiSuccessResponse<NightAuditStatusDto>> {
    const status = await this.nightAuditService.getBusinessDateStatus(propertyId);
    return createApiResponse(status);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('night_audit:view')
  @ApiOperation({ summary: 'Run pre-audit validation checks against arrivals, departures, and rooms' })
  @ApiResponse({ status: 200, description: 'Pre-audit operational validation report' })
  public async validatePreAudit(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<ApiSuccessResponse<NightAuditValidationReportDto>> {
    const report = await this.nightAuditService.validatePreAudit(propertyId);
    return createApiResponse(report);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('night_audit:run')
  @ApiOperation({
    summary: 'Execute night audit rollover: OCC locking, room charges, no-shows, and date advancement',
  })
  @ApiResponse({ status: 200, description: 'Night audit executed successfully' })
  public async runNightAudit(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: RunNightAuditDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<NightAuditRunDto>> {
    const run = await this.nightAuditService.runNightAudit(propertyId, dto, actor);
    return createApiResponse(run);
  }

  @Post('recover')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('night_audit:recover')
  @ApiOperation({ summary: 'Forcibly unlock stuck night audit or reset lock state' })
  @ApiResponse({ status: 200, description: 'Night audit lock forcibly recovered' })
  public async recoverStuckAudit(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: NightAuditRecoveryDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<PropertyBusinessDateDto>> {
    const result = await this.nightAuditService.recoverStuckAudit(propertyId, dto, actor);
    return createApiResponse(result);
  }

  @Get('history')
  @RequirePermissions('night_audit:view')
  @ApiOperation({ summary: 'Retrieve historical night audit runs for the property' })
  @ApiResponse({ status: 200, description: 'List of historical audit runs' })
  public async getAuditHistory(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('limit') limit?: string,
  ): Promise<ApiSuccessResponse<NightAuditRunDto[]>> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const history = await this.nightAuditService.getAuditHistory(propertyId, parsedLimit);
    return createApiResponse(history);
  }

  @Get('runs/:runId')
  @RequirePermissions('night_audit:view')
  @ApiOperation({ summary: 'Retrieve specific night audit run details with steps' })
  @ApiResponse({ status: 200, description: 'Detailed night audit run with steps' })
  public async getAuditRunById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<ApiSuccessResponse<NightAuditRunDto>> {
    const run = await this.nightAuditService.getAuditRunById(propertyId, runId);
    return createApiResponse(run);
  }
}

