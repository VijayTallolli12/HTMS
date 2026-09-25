import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CrmController } from './controllers/crm.controller';
import { CrmService } from './services/crm.service';
import { LoyaltyService } from './services/loyalty.service';

@Module({
  controllers: [CrmController],
  providers: [PrismaService, CrmService, LoyaltyService],
  exports: [CrmService, LoyaltyService],
})
export class CrmModule {}