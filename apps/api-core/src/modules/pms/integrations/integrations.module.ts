import { Module } from '@nestjs/common';
import { IntegrationService } from './services/integration.service';
import { IntegrationController } from './controllers/integration.controller';

@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}