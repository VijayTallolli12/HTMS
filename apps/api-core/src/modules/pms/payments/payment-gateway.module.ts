import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { PaymentGatewayController } from './controllers/payment-gateway.controller';

@Module({
  controllers: [PaymentGatewayController],
  providers: [PrismaService, PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}