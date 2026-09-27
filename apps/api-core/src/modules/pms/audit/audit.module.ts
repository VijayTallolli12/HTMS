import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';

@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService],
  exports: [AuditService],
})
export class AuditModule {}