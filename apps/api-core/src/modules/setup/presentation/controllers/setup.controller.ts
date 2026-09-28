import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  SetupStatusDto,
  BootstrapAdminResponse,
  SetupOrganizationResponse,
  SetupPropertyResponse,
  SetupCompleteResponse,
  SetupDemoOperationResponse,
} from '@hms/api-contracts';
import { Public, Authenticated } from '../../../identity/presentation/decorators/authz.decorators';
import { CurrentSecurityContext } from '../../../identity/presentation/decorators/authz.decorators';
import { SecurityContext } from '@hms/api-contracts';
import { SetupService } from '../../application/services/setup.service';
import { SetupStateService } from '../../application/services/setup-state.service';
import { DemoDataService } from '../../application/services/demo-data.service';
import { BootstrapAdminDto, SetupOrganizationDto, SetupPropertyDto } from '../dto/setup.dto';

function extractIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
}

/**
 * W2 First-Run Setup API.
 *
 * Transport-level @Public marks on the virgin-database endpoints are backed by
 * a server-side virgin-window guard (zero ACTIVE credentialed users) — see
 * SetupService. Once setup completes, every mutation requires authentication.
 */
@ApiTags('Setup — First-Run')
@Controller('v1/setup')
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly setupStateService: SetupStateService,
    private readonly demoDataService: DemoDataService,
  ) {}

  @Public()
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'First-run setup status (public read; no secrets)' })
  async getStatus(@Req() req: Request): Promise<ApiSuccessResponse<SetupStatusDto>> {
    const data = await this.setupStateService.getStatus();
    return createApiResponse(data, req);
  }

  @Public()
  @Post('bootstrap-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create the first administrator (only while the database is virgin)',
  })
  @ApiResponse({ status: 201, description: 'First administrator created' })
  @ApiResponse({ status: 403, description: 'Setup already completed' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 429, description: 'Throttled' })
  async bootstrapAdmin(
    @Body() dto: BootstrapAdminDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<BootstrapAdminResponse>> {
    const data = await this.setupService.bootstrapAdmin(dto, {
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Public()
  @Post('organization')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the organization hierarchy (virgin window)' })
  async setupOrganization(
    @Body() dto: SetupOrganizationDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupOrganizationResponse>> {
    const data = await this.setupService.setupOrganization(dto, {
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Public()
  @Post('property')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the first property + MAIN building + ground floor (virgin window)' })
  async setupProperty(
    @Body() dto: SetupPropertyDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupPropertyResponse>> {
    const data = await this.setupService.setupProperty(dto, {
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Authenticated()
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete setup (requires completed milestones)' })
  async complete(
    @CurrentSecurityContext() securityContext: SecurityContext,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupCompleteResponse>> {
    const data = await this.setupService.complete({
      userId: securityContext.userId,
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Authenticated()
  @Post('demo/load')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import canonical demo data (admin only, audited)' })
  async demoLoad(
    @CurrentSecurityContext() securityContext: SecurityContext,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupDemoOperationResponse>> {
    await this.assertAdmin(securityContext);
    const data = await this.demoDataService.load({
      userId: securityContext.userId,
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Authenticated()
  @Post('demo/reset')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-run the idempotent demo seed (admin only, audited)' })
  async demoReset(
    @CurrentSecurityContext() securityContext: SecurityContext,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupDemoOperationResponse>> {
    await this.assertAdmin(securityContext);
    const data = await this.demoDataService.reset({
      userId: securityContext.userId,
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  @Authenticated()
  @Post('demo/remove')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove canonical demo data via strict allowlist (admin only, audited)' })
  async demoRemove(
    @CurrentSecurityContext() securityContext: SecurityContext,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<SetupDemoOperationResponse>> {
    await this.assertAdmin(securityContext);
    const data = await this.demoDataService.remove({
      userId: securityContext.userId,
      ip: extractIp(req),
      correlationId: (req as any).correlationId,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return createApiResponse(data, req);
  }

  private async assertAdmin(securityContext: SecurityContext): Promise<void> {
    const isAdmin =
      securityContext.isGlobalAdmin ||
      securityContext.roles?.some((r) => r.code === 'CORP_ADMIN' || r.code === 'PROPERTY_GM');
    if (!isAdmin) {
      throw new ForbiddenException('Administrator role required.');
    }
  }
}
