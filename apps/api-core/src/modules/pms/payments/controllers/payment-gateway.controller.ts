import {
  BadRequestException,
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
  Headers,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { CurrentSecurityContext, Public, RequirePermissions, RequirePropertyContext } from '../../../identity/presentation/decorators/authz.decorators';
import { SecurityContext } from '@hms/api-contracts';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { PaymentGatewayService } from '../services/payment-gateway.service';
import { PaymentGatewayFrameworkService } from '../services/payment-gateway-framework.service';
import { SavePaymentGatewayConfigRequest, TestGatewayConnectionRequest, UpdatePaymentGatewayConfigRequest } from '../dto/payments.dto';
import { PaymentGatewayReconciliationService } from '../services/payment-gateway-reconciliation.service';
import {
  PaymentProviderConfigDto,
  PaymentIntentDto,
  PaymentGatewayTransactionDto,
  PaymentWebhookDto,
  PaymentReconciliationDto,
  PaymentProviderType,
  PaymentGatewayTransactionStatus,
  PaymentIntentStatus,
} from '@hms/api-contracts';
import {
  CreatePaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
  CreatePaymentIntentDto,
  AuthorizePaymentGatewayTransactionDto,
  CapturePaymentGatewayTransactionDto,
  RefundPaymentGatewayTransactionDto,
  CancelPaymentGatewayTransactionDto,
  SimulateWebhookDto,
  GeneratePaymentReconciliationDto,
} from '../dto/payments.dto';

@ApiTags('PMS - Payment Gateway')
@ApiBearerAuth()
@Controller('properties/:propertyId/payments')
@UseGuards(ScopedRbacGuard)
@RequirePropertyContext()
export class PaymentGatewayController {
  constructor(
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly reconciliation: PaymentGatewayReconciliationService,
    private readonly gatewayFramework: PaymentGatewayFrameworkService,
  ) {}

  // ============================================================================
  // PAYMENT PROVIDER CONFIGURATION CRUD
  // ============================================================================

  @Get('providers')
  @RequirePermissions('payment_gateway:view')
  @ApiOperation({ summary: 'List all payment provider configurations for a property' })
  @ApiQuery({ name: 'enabledOnly', required: false, type: Boolean })
  async findProviderConfigs(
    @Param('propertyId') propertyId: string,
    @Query('enabledOnly') enabledOnly?: boolean,
  ): Promise<PaymentProviderConfigDto[]> {
    return this.paymentGatewayService.findProviderConfigs(propertyId, enabledOnly);
  }

  @Get('providers/:id')
  @RequirePermissions('payment_gateway:view')
  @ApiOperation({ summary: 'Get payment provider configuration by ID' })
  async findProviderConfigById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.findProviderConfigById(propertyId, id);
  }

  @Post('providers')
  @RequirePermissions('payment_gateway:configure')
  @ApiOperation({ summary: 'Create a new payment provider configuration' })
  async createProviderConfig(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePaymentProviderConfigDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.createProviderConfig(propertyId, dto, actor.userId);
  }

  @Patch('providers/:id')
  @RequirePermissions('payment_gateway:configure')
  @ApiOperation({ summary: 'Update payment provider configuration' })
  async updateProviderConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProviderConfigDto,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.updateProviderConfig(propertyId, id, dto);
  }

  @Delete('providers/:id')
  @RequirePermissions('payment_gateway:disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment provider configuration' })
  async deleteProviderConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.paymentGatewayService.deleteProviderConfig(propertyId, id);
  }

  @Get('gateway-catalog')
  @RequirePermissions('payment_gateway:view')
  listGatewayCatalog(@Param('propertyId') propertyId: string) {
    return this.gatewayFramework.listCatalog(propertyId);
  }

  @Get('gateway-configurations')
  @RequirePermissions('payment_gateway:view')
  listGatewayConfigurations(@Param('propertyId') propertyId: string) {
    return this.gatewayFramework.listConfigs(propertyId);
  }

  @Post('gateway-configurations')
  @RequirePermissions('payment_gateway:configure')
  createGatewayConfiguration(@Param('propertyId') propertyId: string, @Body() dto: SavePaymentGatewayConfigRequest, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayFramework.createConfig(propertyId, dto, actor);
  }

  @Patch('gateway-configurations/:id')
  @RequirePermissions('payment_gateway:configure')
  updateGatewayConfiguration(@Param('propertyId') propertyId: string, @Param('id') id: string, @Body() dto: UpdatePaymentGatewayConfigRequest, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayFramework.updateConfig(propertyId, id, dto, actor);
  }

  @Post('gateway-configurations/:id/test')
  @RequirePermissions('payment_gateway:test')
  testGatewayConfiguration(@Param('propertyId') propertyId: string, @Param('id') id: string, @Body() dto: TestGatewayConnectionRequest, @CurrentSecurityContext() actor: SecurityContext) {
    if (dto.gatewayId !== id) throw new BadRequestException('Gateway ID does not match the route.');
    return this.gatewayFramework.testConnection(propertyId, id, actor);
  }

  @Post('gateway-configurations/:id/enable')
  @RequirePermissions('payment_gateway:enable')
  enableGateway(@Param('propertyId') propertyId: string, @Param('id') id: string, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayFramework.setEnabled(propertyId, id, true, actor);
  }

  @Post('gateway-configurations/:id/disable')
  @RequirePermissions('payment_gateway:disable')
  disableGateway(@Param('propertyId') propertyId: string, @Param('id') id: string, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayFramework.setEnabled(propertyId, id, false, actor);
  }

  // ============================================================================
  // PAYMENT INTENT
  // ============================================================================

  @Post('intents')
  @RequirePermissions('payment:intent:create')
  @ApiOperation({ summary: 'Create a payment intent' })
  async createPaymentIntent(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePaymentIntentDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentIntentDto> {
    return this.paymentGatewayService.createPaymentIntent(propertyId, dto, actor);
  }

  @Get('intents/:id')
  @RequirePermissions('payment:read')
  @ApiOperation({ summary: 'Get payment intent by ID' })
  async findPaymentIntent(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<PaymentIntentDto> {
    return this.paymentGatewayService.findPaymentIntent(propertyId, id);
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  @Post('authorize')
  @RequirePermissions('payment:authorize')
  @ApiOperation({ summary: 'Authorize a payment' })
  async authorizePayment(
    @Param('propertyId') propertyId: string,
    @Body() dto: AuthorizePaymentGatewayTransactionDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.authorizePayment(propertyId, dto, actor);
  }

  @Post('capture')
  @RequirePermissions('payment:capture')
  @ApiOperation({ summary: 'Capture an authorized payment' })
  async capturePayment(
    @Param('propertyId') propertyId: string,
    @Body() dto: CapturePaymentGatewayTransactionDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.capturePayment(propertyId, dto, actor);
  }

  @Post('refund')
  @RequirePermissions('payment:refund')
  @ApiOperation({ summary: 'Refund a captured payment' })
  async refundPayment(
    @Param('propertyId') propertyId: string,
    @Body() dto: RefundPaymentGatewayTransactionDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.refundPayment(propertyId, dto, actor);
  }

  @Post('cancel')
  @RequirePermissions('payment:cancel')
  @ApiOperation({ summary: 'Cancel a payment intent' })
  async cancelPaymentIntent(
    @Param('propertyId') propertyId: string,
    @Body() dto: CancelPaymentGatewayTransactionDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<PaymentIntentDto> {
    return this.paymentGatewayService.cancelPaymentIntent(propertyId, dto, actor);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Process an authenticated DEMO provider callback using its raw-body signature' })
  async processWebhook(
    @Param('propertyId') propertyId: string,
    @Body() dto: SimulateWebhookDto,
    @Headers('x-provider-signature') signature?: string,
    @Req() req?: RawBodyRequest<Request>,
  ): Promise<PaymentWebhookDto> {
    return this.paymentGatewayService.processWebhook(
      propertyId,
      dto,
      signature,
      req?.headers['x-correlation-id'] as string | undefined,
      req?.rawBody,
    );
  }

  // ============================================================================
  // RECONCILIATION
  // ============================================================================

  @Post('reconciliation')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'Generate payment reconciliation report' })
  async generateReconciliation(
    @Param('propertyId') propertyId: string,
    @Body() dto: GeneratePaymentReconciliationDto,
  ): Promise<PaymentReconciliationDto> {
    return this.paymentGatewayService.generateReconciliation(propertyId, dto);
  }

  @Get('operations/reconciliation')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'List settlement-pending gateway operations' })
  listRecoverableOperations(@Param('propertyId') propertyId: string) {
    return this.reconciliation.listRecoverable(propertyId);
  }

  @Post('operations/:operationId/reconcile')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'Reconcile one durable gateway operation' })
  reconcileOperation(@Param('propertyId') propertyId: string, @Param('operationId') operationId: string) {
    return this.reconciliation.reconcile(propertyId, operationId);
  }

  @Post('operations/:operationId/settle-confirmed')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'Resume local settlement from saved provider confirmation' })
  settleConfirmed(@Param('propertyId') propertyId: string, @Param('operationId') operationId: string) {
    return this.reconciliation.settleConfirmed(propertyId, operationId);
  }
}