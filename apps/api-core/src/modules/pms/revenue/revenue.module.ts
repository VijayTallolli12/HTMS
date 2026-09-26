import { Module } from '@nestjs/common';
import { RevenueService } from './services/revenue.service';
import { RevenueController } from './controllers/revenue.controller';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}