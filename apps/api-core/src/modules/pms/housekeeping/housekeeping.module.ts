import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { HousekeepingTaskController } from './controllers/housekeeping-task.controller';
import { HousekeepingTaskService } from './services/housekeeping-task.service';
import { RoomOperationsModule } from '../room-operations/room-operations.module';

@Module({
  imports: [RoomOperationsModule],
  controllers: [HousekeepingTaskController],
  providers: [PrismaService, HousekeepingTaskService],
  exports: [HousekeepingTaskService],
})
export class HousekeepingModule {}
