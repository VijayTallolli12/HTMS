import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../apps/api-core/src/app.module';
import { GlobalHttpExceptionFilter } from '../apps/api-core/src/common/filters/http-exception.filter';

let cachedServer: Express | null = null;
let cachedApp: INestApplication | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer && cachedApp) {
    return cachedServer;
  }

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });

  // Security & Cross-Origin Resource Sharing
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['X-Correlation-ID', 'X-Property-ID', 'X-Tenant-ID'],
  });

  // Global Prefix (excluding standard discovery endpoints like /.well-known/jwks.json)
  app.setGlobalPrefix('api', {
    exclude: ['/.well-known/jwks.json', '.well-known/jwks.json'],
  });

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

  await app.init();
  cachedApp = app;
  cachedServer = server;
  return cachedServer;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const matchedPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri']) as string;
  if (matchedPath && matchedPath !== '/api') {
    req.url = matchedPath;
  }
  const server = await bootstrapServer();
  server(req, res);
}

