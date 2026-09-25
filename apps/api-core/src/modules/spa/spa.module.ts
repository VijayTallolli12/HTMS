import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { FinanceModule } from '../pms/finance/finance.module';
import { SpaCatalogService } from './services/spa-catalog.service';
import { SpaAppointmentService } from './services/spa-appointment.service';
import { SpaController } from './controllers/spa.controller';

@Module({
  imports: [FinanceModule],
  controllers: [SpaController],
  providers: [PrismaService, SpaCatalogService, SpaAppointmentService],
  exports: [SpaCatalogService, SpaAppointmentService],
})
export class SpaModule {}

