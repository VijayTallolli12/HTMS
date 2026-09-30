import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { PaymentGatewayController } from './controllers/payment-gateway.controller';
import { PaymentGatewayReconciliationController } from './controllers/payment-gateway-reconciliation.controller';
import { PaymentGatewayFinancialOperationsService } from './services/payment-gateway-financial-operations.service';
import { PaymentGatewayReconciliationService } from './services/payment-gateway-reconciliation.service';
import { AuditModule } from '../audit/audit.module';
import { PaymentGatewayFrameworkController } from './controllers/payment-gateway-framework.controller';
import { PaymentGatewayFrameworkService } from './services/payment-gateway-framework.service';
import { PaymentGatewayCredentialVault } from './services/payment-gateway-credential-vault';
import { PaymentGatewayProviderRegistry } from './services/payment-gateway-registry';
import { DemoPaymentGatewayAdapter } from './services/demo-payment-gateway.adapter';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AuditModule, FinanceModule],
  controllers: [PaymentGatewayController, PaymentGatewayFrameworkController, PaymentGatewayReconciliationController],
  providers: [
    PrismaService,
    PaymentGatewayService,
    PaymentGatewayFinancialOperationsService,
    PaymentGatewayReconciliationService,
    PaymentGatewayFrameworkService,
    { provide: PaymentGatewayProviderRegistry, useFactory: () => new PaymentGatewayProviderRegistry() },
    PaymentGatewayCredentialVault,
    DemoPaymentGatewayAdapter,
  ],
  exports: [PaymentGatewayService, PaymentGatewayFrameworkService, PaymentGatewayFinancialOperationsService, PaymentGatewayReconciliationService, PaymentGatewayProviderRegistry],
})
export class PaymentGatewayModule {}