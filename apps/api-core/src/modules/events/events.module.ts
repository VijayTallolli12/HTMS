import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { FinanceModule } from '../pms/finance/finance.module';
import { EventsCatalogService } from './services/events-catalog.service';
import { EventsBookingService } from './services/events-booking.service';
import { EventsController } from './controllers/events.controller';

@Module({
  imports: [FinanceModule],
  controllers: [EventsController],
  providers: [PrismaService, EventsCatalogService, EventsBookingService],
  exports: [EventsCatalogService, EventsBookingService],
})
export class EventsModule {}

