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
import { PaymentGatewayService } from '../services/payment-gateway.service';
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
export class PaymentGatewayController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  // ============================================================================
  // PAYMENT PROVIDER CONFIGURATION CRUD
  // ============================================================================

  @Get('providers')
  @RequirePermissions('payment:read')
  @ApiOperation({ summary: 'List all payment provider configurations for a property' })
  @ApiQuery({ name: 'enabledOnly', required: false, type: Boolean })
  async findProviderConfigs(
    @Param('propertyId') propertyId: string,
    @Query('enabledOnly') enabledOnly?: boolean,
  ): Promise<PaymentProviderConfigDto[]> {
    return this.paymentGatewayService.findProviderConfigs(propertyId, enabledOnly);
  }

  @Get('providers/:id')
  @RequirePermissions('payment:read')
  @ApiOperation({ summary: 'Get payment provider configuration by ID' })
  async findProviderConfigById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.findProviderConfigById(propertyId, id);
  }

  @Post('providers')
  @RequirePermissions('payment:create')
  @ApiOperation({ summary: 'Create a new payment provider configuration' })
  async createProviderConfig(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePaymentProviderConfigDto,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.createProviderConfig(propertyId, dto);
  }

  @Patch('providers/:id')
  @RequirePermissions('payment:update')
  @ApiOperation({ summary: 'Update payment provider configuration' })
  async updateProviderConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProviderConfigDto,
  ): Promise<PaymentProviderConfigDto> {
    return this.paymentGatewayService.updateProviderConfig(propertyId, id, dto);
  }

  @Delete('providers/:id')
  @RequirePermissions('payment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment provider configuration' })
  async deleteProviderConfig(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.paymentGatewayService.deleteProviderConfig(propertyId, id);
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
  ): Promise<PaymentIntentDto> {
    return this.paymentGatewayService.createPaymentIntent(propertyId, dto);
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
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.authorizePayment(propertyId, dto);
  }

  @Post('capture')
  @RequirePermissions('payment:capture')
  @ApiOperation({ summary: 'Capture an authorized payment' })
  async capturePayment(
    @Param('propertyId') propertyId: string,
    @Body() dto: CapturePaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.capturePayment(propertyId, dto);
  }

  @Post('refund')
  @RequirePermissions('payment:refund')
  @ApiOperation({ summary: 'Refund a captured payment' })
  async refundPayment(
    @Param('propertyId') propertyId: string,
    @Body() dto: RefundPaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransactionDto> {
    return this.paymentGatewayService.refundPayment(propertyId, dto);
  }

  @Post('cancel')
  @RequirePermissions('payment:cancel')
  @ApiOperation({ summary: 'Cancel a payment intent' })
  async cancelPaymentIntent(
    @Param('propertyId') propertyId: string,
    @Body() dto: CancelPaymentGatewayTransactionDto,
  ): Promise<PaymentIntentDto> {
    return this.paymentGatewayService.cancelPaymentIntent(propertyId, dto);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  @Post('webhook')
  @RequirePermissions('payment:webhook')
  @ApiOperation({ summary: 'Process payment webhook (demo simulation)' })
  async processWebhook(
    @Param('propertyId') propertyId: string,
    @Body() dto: SimulateWebhookDto,
  ): Promise<PaymentWebhookDto> {
    return this.paymentGatewayService.processWebhook(dto);
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
}