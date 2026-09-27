import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';
import { SystemClock } from '../common/services/system-clock.service';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { AtsCalculatorService } from '../inventory/services/ats-calculator.service';
import { RevenueService } from './services/revenue.service';
import { RevenueController } from './controllers/revenue.controller';

@Module({
  controllers: [RevenueController],
  providers: [
    PrismaService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
    PropertyBusinessDateService,
    InventoryService,
    AtsCalculatorService,
    RevenueService,
  ],
  exports: [RevenueService],
})
export class RevenueModule {}