import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RoomOperationsController } from './controllers/room-operations.controller';
import { RoomStatusService } from './services/room-status.service';
import { RoomStatusReconciliationService } from './services/room-status-reconciliation.service';
import { RoomMaintenanceService } from './services/room-maintenance.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { AtsCalculatorService } from '../inventory/services/ats-calculator.service';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { SystemClock } from '../common/services/system-clock.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';

@Module({
  controllers: [RoomOperationsController],
  providers: [
    PrismaService,
    RoomStatusService,
    RoomStatusReconciliationService,
    RoomMaintenanceService,
    InventoryService,
    AtsCalculatorService,
    PropertyBusinessDateService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
  ],
  exports: [RoomStatusService, RoomStatusReconciliationService, RoomMaintenanceService],
})
export class RoomOperationsModule {}
