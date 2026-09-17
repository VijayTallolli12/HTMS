import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnvironment } from '@hms/config';
import { HealthModule } from './modules/health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => parseEnvironment(process.env)],
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    OrganizationModule,
    IdentityModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
