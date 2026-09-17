import { HealthService } from '../../apps/api-core/src/modules/health/health.service';
import { ConfigService } from '@nestjs/config';

describe('HealthService Unit Tests', () => {
  let service: HealthService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultVal: any) => {
        const map: Record<string, any> = {
          NODE_ENV: 'test',
          POSTGRES_HOST: 'localhost',
          POSTGRES_PORT: 5433,
          POSTGRES_DB: 'enterprise_hms_db',
          POSTGRES_USER: 'hms_user',
          POSTGRES_PASSWORD: 'test_password',
          RABBITMQ_URL: 'amqp://localhost',
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          MAILPIT_HOST: 'localhost',
          MAILPIT_SMTP_PORT: 1025,
        };
        return map[key] !== undefined ? map[key] : defaultVal;
      }),
    } as unknown as ConfigService;

    service = new HealthService(configService);
  });

  it('should return liveness response with status ok', () => {
    const liveness = service.getLiveness();
    expect(liveness.status).toBe('ok');
    expect(liveness.timestamp).toBeDefined();
    expect(typeof liveness.uptimeSeconds).toBe('number');
  });

  it('should calculate status ok when all dependencies are up', async () => {
    jest.spyOn(service, 'checkDatabase').mockResolvedValue({ status: 'up', latencyMs: 2 });
    jest.spyOn(service, 'checkRabbitMQ').mockResolvedValue({ status: 'up', latencyMs: 3 });
    jest.spyOn(service, 'checkRedis').mockResolvedValue({ status: 'up', latencyMs: 1 });
    jest.spyOn(service, 'checkMailpit').mockResolvedValue({ status: 'up', latencyMs: 4 });

    const res = await service.checkAggregatedHealth();

    expect(res.status).toBe('ok');
    expect(res.services.database.status).toBe('up');
    expect(res.services.rabbitmq.status).toBe('up');
    expect(res.services.redis.status).toBe('up');
    expect(res.services.mailpit.status).toBe('up');
  });

  it('should calculate status degraded when a non-critical dependency (e.g. mailpit) is down', async () => {
    jest.spyOn(service, 'checkDatabase').mockResolvedValue({ status: 'up', latencyMs: 2 });
    jest.spyOn(service, 'checkRabbitMQ').mockResolvedValue({ status: 'up', latencyMs: 3 });
    jest.spyOn(service, 'checkRedis').mockResolvedValue({ status: 'up', latencyMs: 1 });
    jest.spyOn(service, 'checkMailpit').mockResolvedValue({
      status: 'down',
      latencyMs: 10,
      error: 'SMTP connection refused',
    });

    const res = await service.checkAggregatedHealth();

    expect(res.status).toBe('degraded');
    expect(res.services.mailpit.status).toBe('down');
  });

  it('should calculate status down when database is down', async () => {
    jest.spyOn(service, 'checkDatabase').mockResolvedValue({
      status: 'down',
      latencyMs: 50,
      error: 'Connection terminated',
    });
    jest.spyOn(service, 'checkRabbitMQ').mockResolvedValue({ status: 'up', latencyMs: 3 });
    jest.spyOn(service, 'checkRedis').mockResolvedValue({ status: 'up', latencyMs: 1 });
    jest.spyOn(service, 'checkMailpit').mockResolvedValue({ status: 'up', latencyMs: 4 });

    const res = await service.checkAggregatedHealth();

    expect(res.status).toBe('down');
    expect(res.services.database.status).toBe('down');
  });
});
