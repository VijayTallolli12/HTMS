import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { PaymentGatewayController } from './controllers/payment-gateway.controller';

@Module({
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}