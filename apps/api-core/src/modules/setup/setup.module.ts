import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { OrganizationModule } from '../organization/organization.module';
import { SetupController } from './presentation/controllers/setup.controller';
import { SetupService } from './application/services/setup.service';
import { SetupStateService } from './application/services/setup-state.service';
import { IamBaselineService } from './application/services/iam-baseline.service';
import { DemoDataService } from './application/services/demo-data.service';
import { SystemResetService } from './application/services/system-reset.service';
import { SecurityAuditSink } from './infrastructure/security-audit.sink';

/**
 * W2 First-Run Setup module.
 *
 * On application start the IAM baseline (system roles + permissions) is
 * ensured idempotently, so a virgin database can serve /v1/setup/* endpoints
 * without running any seed script.
 */
@Module({
  // OrganizationModule exports the hotel-group/region/country/property/
  // building/floor services that SetupService delegates to. IdentityModule is
  // @Global, so identity services resolve without an explicit import.
  imports: [OrganizationModule],
  controllers: [SetupController],
  providers: [
    PrismaService,
    SetupService,
    SetupStateService,
    IamBaselineService,
    DemoDataService,
    SystemResetService,
    SecurityAuditSink,
  ],
  exports: [SetupStateService],
})
export class SetupModule implements OnModuleInit {
  constructor(private readonly iamBaselineService: IamBaselineService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.iamBaselineService.ensureBaseline();
      // Never block startup: baseline errors surface in logs; setup endpoints
      // re-run ensureBaseline defensively on each call.
    } catch (err: any) {
      // Logging only — a transient DB issue must not crash the API.
      console.error(`[SetupModule] IAM baseline ensure failed: ${err?.message}`);
    }
  }
}
