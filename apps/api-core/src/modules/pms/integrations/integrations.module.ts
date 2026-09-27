import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { IntegrationService } from './services/integration.service';
import { IntegrationController } from './controllers/integration.controller';

@Module({
  controllers: [IntegrationController],
  providers: [PrismaService, IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}