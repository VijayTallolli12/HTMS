import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { FinanceModule } from '../pms/finance/finance.module';
import { FnbController } from './controllers/fnb.controller';
import { FnbOutletService } from './services/fnb-outlet.service';
import { FnbMenuService } from './services/fnb-menu.service';
import { FnbOrderService } from './services/fnb-order.service';

@Module({
  imports: [FinanceModule],
  controllers: [FnbController],
  providers: [
    PrismaService,
    FnbOutletService,
    FnbMenuService,
    FnbOrderService,
  ],
  exports: [FnbOutletService, FnbMenuService, FnbOrderService],
})
export class FnbModule {}

