import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthResponse,
  HealthStatus,
  LivenessResponse,
  ReadinessResponse,
  ServiceHealth,
} from '@hms/api-contracts';
import { checkDatabaseHealth, createDatabasePool, HmsDatabaseConfig } from '@hms/database';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as amqp from 'amqplib';
import * as nodemailer from 'nodemailer';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private dbPool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getPool(): Pool {
    if (!this.dbPool) {
      const dbConfig: HmsDatabaseConfig = {
        host: this.configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: parseInt(String(this.configService.get('POSTGRES_PORT', '5433')), 10),
        database: this.configService.get<string>('POSTGRES_DB', 'enterprise_hms_db'),
        user: this.configService.get<string>('POSTGRES_USER', 'hms_user'),
        password: this.configService.get<string>('POSTGRES_PASSWORD', ''),
        ssl: String(this.configService.get('POSTGRES_SSL', 'false')).toLowerCase() === 'true',
      };
      this.dbPool = createDatabasePool(dbConfig);
    }
    return this.dbPool!;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dbPool) {
      await this.dbPool.end();
      this.dbPool = null;
    }
  }

  async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const pool = this.getPool();
      const result = await checkDatabaseHealth(pool);
      if (result.status === 'up') {
        return {
          status: 'up',
          latencyMs: result.latencyMs,
          details: {
            version: result.version?.split(' ')[0] + ' ' + (result.version?.split(' ')[1] || ''),
            schemas: result.schemas,
          },
        };
      } else {
        return {
          status: 'down',
          latencyMs: result.latencyMs,
          error: result.error,
        };
      }
    } catch (err: any) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async checkRabbitMQ(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const rabbitUrl = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://hms_rabbit:hms_rabbit_dev_pass_2026@localhost:5672/',
    );
    try {
      const conn = await Promise.race([
        amqp.connect(rabbitUrl),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RabbitMQ connection timeout (3000ms)')), 3000),
        ),
      ]);
      const ch = await conn.createChannel();
      await ch.close();
      await conn.close();
      return {
        status: 'up',
        latencyMs: Date.now() - startTime,
        details: { connection: 'active', protocol: 'AMQP 0-9-1' },
      };
    } catch (err: any) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    const redis = new Redis({
      host,
      port,
      password: password || undefined,
      connectTimeout: 3000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();
      return {
        status: pong === 'PONG' ? 'up' : 'down',
        latencyMs: Date.now() - startTime,
        details: { response: pong },
      };
    } catch (err: any) {
      try {
        redis.disconnect();
      } catch {
        // ignore disconnect error
      }
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async checkMailpit(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const host = this.configService.get<string>('MAILPIT_HOST', 'localhost');
    const port = this.configService.get<number>('MAILPIT_SMTP_PORT', 1025);

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        connectionTimeout: 3000,
      });

      await transporter.verify();
      return {
        status: 'up',
        latencyMs: Date.now() - startTime,
        details: { smtp: 'ready', host, port },
      };
    } catch (err: any) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async checkAggregatedHealth(): Promise<HealthResponse> {
    const [database, rabbitmq, redis, mailpit] = await Promise.all([
      this.checkDatabase(),
      this.checkRabbitMQ(),
      this.checkRedis(),
      this.checkMailpit(),
    ]);

    const allServices = [database, rabbitmq, redis, mailpit];
    const upCount = allServices.filter((s) => s.status === 'up').length;

    let overallStatus: HealthStatus = 'ok';
    if (database.status === 'down') {
      overallStatus = 'down';
    } else if (upCount < allServices.length) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      uptimeSeconds: Math.floor(process.uptime()),
      services: {
        database,
        rabbitmq,
        redis,
        mailpit,
      },
    };
  }

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, rabbitmq, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRabbitMQ(),
      this.checkRedis(),
    ]);

    const isReady = database.status === 'up' && rabbitmq.status === 'up' && redis.status === 'up';

    return {
      status: isReady ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
      services: {
        database,
        rabbitmq,
        redis,
      },
    };
  }
}
