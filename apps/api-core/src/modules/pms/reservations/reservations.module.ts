import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { ReservationController } from './controllers/reservation.controller';
import { ReservationService } from './services/reservation.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { AtsCalculatorService } from '../inventory/services/ats-calculator.service';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { SystemClock } from '../common/services/system-clock.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';

@Module({
  controllers: [ReservationController],
  providers: [
    PrismaService,
    ReservationService,
    InventoryService,
    AtsCalculatorService,
    PropertyBusinessDateService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
  ],
  exports: [ReservationService],
})
export class ReservationsModule {}
