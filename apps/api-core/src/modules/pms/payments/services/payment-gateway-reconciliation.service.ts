import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PaymentGatewayFinancialOperationsService } from './payment-gateway-financial-operations.service';

@Injectable()
export class PaymentGatewayReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: PaymentGatewayFinancialOperationsService,
  ) {}

  async listRecoverable(propertyId: string, paymentProviderConfigId?: string): Promise<any[]> {
    return this.prisma.paymentGatewayOperation.findMany({
      where: { propertyId, ...(paymentProviderConfigId ? { paymentProviderConfigId } : {}), state: { in: ['PROVIDER_CONFIRMED', 'SETTLEMENT_PENDING', 'REQUIRES_RECONCILIATION'] } },
      include: { gatewayTransaction: true, folio: true, reservation: true, adjustment: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reconcile(propertyId: string, operationId: string): Promise<any> {
    const operation = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId, id: operationId } });
    if (!operation) throw new NotFoundException('Payment operation not found for property.');
    return this.operations.reconcileOperation(propertyId, operationId);
  }

  async settleConfirmed(propertyId: string, operationId: string): Promise<any> {
    const operation = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId, id: operationId } });
    if (!operation) throw new NotFoundException('Payment operation not found for property.');
    return this.operations.settleProviderConfirmed(propertyId, operationId);
  }
}
