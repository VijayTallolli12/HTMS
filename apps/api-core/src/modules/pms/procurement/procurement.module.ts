import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { ProcurementController } from './controllers/procurement.controller';
import { ProcurementService } from './services/procurement.service';

@Module({
  imports: [],
  controllers: [ProcurementController],
  providers: [PrismaService, ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}

