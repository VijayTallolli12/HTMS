import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('EnterpriseHMS-Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');

  // Security & Cross-Origin Resource Sharing
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['X-Correlation-ID', 'X-Property-ID', 'X-Tenant-ID'],
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global RFC 7807 Exception Filter
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise HMS API Core')
    .setDescription(
      'Enterprise Hospitality Operating Platform — Core Monolith API. Provides multi-property PMS, Front Office, Housekeeping, and Platform services.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Operational health, readiness, and liveness endpoints')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Property-ID', in: 'header' }, 'X-Property-ID')
    .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'X-Tenant-ID')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`=======================================================`);
  logger.log(`🚀 Enterprise HMS API Core running on http://localhost:${port}/api`);
  logger.log(`📋 Health Check endpoint: http://localhost:${port}/api/v1/health`);
  logger.log(`📚 Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during API bootstrap:', err);
  process.exit(1);
});
