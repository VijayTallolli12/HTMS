import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { FrontOfficeController } from './controllers/front-office.controller';
import { RoomAssignmentService } from './services/room-assignment.service';
import { CheckInService } from './services/check-in.service';
import { RoomOperationsModule } from '../room-operations/room-operations.module';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { SystemClock } from '../common/services/system-clock.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';

@Module({
  imports: [RoomOperationsModule],
  controllers: [FrontOfficeController],
  providers: [
    PrismaService,
    RoomAssignmentService,
    CheckInService,
    PropertyBusinessDateService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
  ],
  exports: [RoomAssignmentService, CheckInService],
})
export class FrontOfficeModule {}
