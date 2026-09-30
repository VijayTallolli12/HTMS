import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { ChannelManagerService } from './services/channel-manager.service';
import { ChannelManagerController } from './controllers/channel-manager.controller';
import { DemoChannelAdapter } from './services/demo-channel.adapter';
import { ReservationService } from '../reservations/services/reservation.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { AtsCalculatorService } from '../inventory/services/ats-calculator.service';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { SystemClock } from '../common/services/system-clock.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';

@Module({
  controllers: [ChannelManagerController],
  providers: [
    PrismaService,
    ChannelManagerService,
    DemoChannelAdapter,
    ReservationService,
    InventoryService,
    AtsCalculatorService,
    PropertyBusinessDateService,
    SystemClock,
    { provide: CLOCK_TOKEN, useClass: SystemClock },
  ],
  exports: [ChannelManagerService],
})
export class ChannelManagerModule {}