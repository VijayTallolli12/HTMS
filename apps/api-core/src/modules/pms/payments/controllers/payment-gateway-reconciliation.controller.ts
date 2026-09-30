import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, RequirePropertyContext } from '../../../identity/presentation/decorators/authz.decorators';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { PaymentGatewayReconciliationService } from '../services/payment-gateway-reconciliation.service';

@ApiTags('PMS - Payment Gateway Reconciliation')
@ApiBearerAuth()
@Controller('properties/:propertyId/payment-gateway-operations')
@UseGuards(ScopedRbacGuard)
@RequirePropertyContext()
export class PaymentGatewayReconciliationController {
  constructor(private readonly reconciliation: PaymentGatewayReconciliationService) {}

  @Get('reconciliation')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'List payment operations awaiting settlement or reconciliation' })
  listRecoverable(@Param('propertyId') propertyId: string) {
    return this.reconciliation.listRecoverable(propertyId);
  }

  @Post(':operationId/reconcile')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'Check provider status where authoritative and safely resume settlement' })
  reconcile(@Param('propertyId') propertyId: string, @Param('operationId') operationId: string) {
    return this.reconciliation.reconcile(propertyId, operationId);
  }

  @Post(':operationId/settle-confirmed')
  @RequirePermissions('payment:reconcile')
  @ApiOperation({ summary: 'Resume local settlement using durable provider confirmation' })
  settleConfirmed(@Param('propertyId') propertyId: string, @Param('operationId') operationId: string) {
    return this.reconciliation.settleConfirmed(propertyId, operationId);
  }
}
