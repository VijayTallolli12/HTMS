import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSecurityContext, RequirePropertyContext, RequirePermissions } from '../../../identity/presentation/decorators/authz.decorators';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { SecurityContext } from '@hms/api-contracts';
import { PaymentGatewayFrameworkService } from '../services/payment-gateway-framework.service';
import { SavePaymentGatewayConfigRequest, TestGatewayConnectionRequest, UpdatePaymentGatewayConfigRequest } from '../dto/payments.dto';

@ApiTags('Administration - Payment Gateways')
@ApiBearerAuth()
@Controller('properties/:propertyId/payment-gateways')
@UseGuards(ScopedRbacGuard)
@RequirePropertyContext()
export class PaymentGatewayFrameworkController {
  constructor(private readonly gatewayService: PaymentGatewayFrameworkService) {}

  @Get('catalog')
  @RequirePermissions('payment_gateway:view')
  @ApiOperation({ summary: 'List gateway catalog entries supported for this property country and currency' })
  listCatalog(@Param('propertyId') propertyId: string) {
    return this.gatewayService.listCatalog(propertyId);
  }

  @Get()
  @RequirePermissions('payment_gateway:view')
  @ApiOperation({ summary: 'List property-scoped gateway configurations without credential values' })
  listConfigs(@Param('propertyId') propertyId: string) {
    return this.gatewayService.listConfigs(propertyId);
  }

  @Post()
  @RequirePermissions('payment_gateway:configure')
  @ApiOperation({ summary: 'Configure a gateway for this property' })
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: SavePaymentGatewayConfigRequest,
    @CurrentSecurityContext() actor: SecurityContext,
  ) {
    return this.gatewayService.createConfig(propertyId, dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('payment_gateway:configure')
  @ApiOperation({ summary: 'Update a property gateway configuration' })
  update(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentGatewayConfigRequest,
    @CurrentSecurityContext() actor: SecurityContext,
  ) {
    return this.gatewayService.updateConfig(propertyId, id, dto, actor);
  }

  @Post(':id/test-connection')
  @RequirePermissions('payment_gateway:test')
  @ApiOperation({ summary: 'Test with the registered adapter; catalog-only providers never make outbound calls' })
  testConnection(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() _dto: TestGatewayConnectionRequest,
    @CurrentSecurityContext() actor: SecurityContext,
  ) {
    return this.gatewayService.testConnection(propertyId, id, actor);
  }

  @Post(':id/enable')
  @RequirePermissions('payment_gateway:enable')
  @ApiOperation({ summary: 'Enable a verified adapter for this property' })
  enable(@Param('propertyId') propertyId: string, @Param('id') id: string, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayService.setEnabled(propertyId, id, true, actor);
  }

  @Post(':id/disable')
  @RequirePermissions('payment_gateway:disable')
  @ApiOperation({ summary: 'Disable this property gateway' })
  disable(@Param('propertyId') propertyId: string, @Param('id') id: string, @CurrentSecurityContext() actor: SecurityContext) {
    return this.gatewayService.setEnabled(propertyId, id, false, actor);
  }
}
