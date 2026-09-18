import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

// Common services
import { CLOCK_TOKEN } from './common/contracts/clock.interface';
import { SystemClock } from './common/services/system-clock.service';
import { PropertyBusinessDateService } from './common/services/property-business-date.service';

// Room Types
import { ROOM_TYPE_DELETION_VALIDATOR } from './room-types/contracts/room-type-deletion-validator.interface';
import { DefaultRoomTypeDeletionValidator } from './room-types/services/default-room-type-deletion-validator.service';
import { RoomTypeService } from './room-types/services/room-type.service';
import { RoomTypeController } from './room-types/controllers/room-type.controller';

// Rooms
import { ROOM_DEACTIVATION_VALIDATOR } from './rooms/contracts/room-deactivation-validator.interface';
import { DefaultRoomDeactivationValidator } from './rooms/services/default-room-deactivation-validator.service';
import { RoomService } from './rooms/services/room.service';
import { RoomController } from './rooms/controllers/room.controller';

// Rate Plans
import { RATE_PLAN_DELETION_VALIDATOR } from './rate-plans/contracts/rate-plan-deletion-validator.interface';
import { DefaultRatePlanDeletionValidator } from './rate-plans/services/default-rate-plan-deletion-validator.service';
import { RatePlanService } from './rate-plans/services/rate-plan.service';
import {
  RatePlanController,
  DailyRateController,
} from './rate-plans/controllers/rate-plan.controller';

// Inventory & ATS
import { AtsCalculatorService } from './inventory/services/ats-calculator.service';
import { InventoryService } from './inventory/services/inventory.service';
import { InventoryController } from './inventory/controllers/inventory.controller';

// Reservations
import { ReservationsModule } from './reservations/reservations.module';

// Room Operations
import { RoomOperationsModule } from './room-operations/room-operations.module';

@Module({
  imports: [ReservationsModule, RoomOperationsModule],
  controllers: [
    RoomTypeController,
    RoomController,
    RatePlanController,
    DailyRateController,
    InventoryController,
  ],
  providers: [
    PrismaService,
    // Clock
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
    PropertyBusinessDateService,
    // Room Types
    DefaultRoomTypeDeletionValidator,
    {
      provide: ROOM_TYPE_DELETION_VALIDATOR,
      useClass: DefaultRoomTypeDeletionValidator,
    },
    RoomTypeService,
    // Rooms
    DefaultRoomDeactivationValidator,
    {
      provide: ROOM_DEACTIVATION_VALIDATOR,
      useClass: DefaultRoomDeactivationValidator,
    },
    RoomService,
    // Rate Plans
    DefaultRatePlanDeletionValidator,
    {
      provide: RATE_PLAN_DELETION_VALIDATOR,
      useClass: DefaultRatePlanDeletionValidator,
    },
    RatePlanService,
    // Inventory
    AtsCalculatorService,
    InventoryService,
  ],
  exports: [
    RoomTypeService,
    RoomService,
    RatePlanService,
    InventoryService,
    AtsCalculatorService,
    PropertyBusinessDateService,
    CLOCK_TOKEN,
    ROOM_TYPE_DELETION_VALIDATOR,
    ROOM_DEACTIVATION_VALIDATOR,
    RATE_PLAN_DELETION_VALIDATOR,
    ReservationsModule,
    RoomOperationsModule,
  ],
})
export class PmsModule {}
