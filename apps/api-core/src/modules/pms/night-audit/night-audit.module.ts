import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CLOCK_TOKEN } from '../common/contracts/clock.interface';
import { SystemClock } from '../common/services/system-clock.service';
import { PropertyBusinessDateService } from '../common/services/property-business-date.service';
import { NightAuditController } from './controllers/night-audit.controller';
import { NightAuditService } from './services/night-audit.service';

@Module({
  controllers: [NightAuditController],
  providers: [
    PrismaService,
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
    PropertyBusinessDateService,
    NightAuditService,
  ],
  exports: [NightAuditService, PropertyBusinessDateService],
})
export class NightAuditModule {}

