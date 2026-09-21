import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { FinanceController } from './controllers/finance.controller';
import { FolioService } from './services/folio.service';
import { CheckoutService } from './services/checkout.service';
import { RoomOperationsModule } from '../room-operations/room-operations.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { SystemClock } from '../common/services/system-clock.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';

@Module({
  imports: [RoomOperationsModule, HousekeepingModule],
  controllers: [FinanceController],
  providers: [
    PrismaService,
    FolioService,
    CheckoutService,
    PropertyBusinessDateService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
  ],
  exports: [FolioService, CheckoutService],
})
export class FinanceModule {}
