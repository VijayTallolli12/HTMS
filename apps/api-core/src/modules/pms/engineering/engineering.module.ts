import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RoomOperationsModule } from '../room-operations/room-operations.module';
import { AssetController } from './controllers/asset.controller';
import { WorkOrderController } from './controllers/work-order.controller';
import { MaintenanceScheduleController } from './controllers/maintenance-schedule.controller';
import { AssetService } from './services/asset.service';
import { WorkOrderService } from './services/work-order.service';
import { MaintenanceScheduleService } from './services/maintenance-schedule.service';

@Module({
  imports: [RoomOperationsModule],
  controllers: [
    AssetController,
    WorkOrderController,
    MaintenanceScheduleController,
  ],
  providers: [
    PrismaService,
    AssetService,
    WorkOrderService,
    MaintenanceScheduleService,
  ],
  exports: [
    AssetService,
    WorkOrderService,
    MaintenanceScheduleService,
  ],
})
export class EngineeringModule {}

