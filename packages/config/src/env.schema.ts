import { SecurityConfig, parseSecurityConfig } from './security.schema';

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  API_PORT: number;
  WEB_PORT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  // Database
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_SSL: boolean;
  DATABASE_URL: string;
  // RabbitMQ
  RABBITMQ_HOST: string;
  RABBITMQ_PORT: number;
  RABBITMQ_MGMT_PORT: number;
  RABBITMQ_USER: string;
  RABBITMQ_PASSWORD?: string;
  RABBITMQ_VHOST: string;
  RABBITMQ_URL: string;
  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_URL?: string;
  // Mailpit
  MAILPIT_HOST: string;
  MAILPIT_SMTP_PORT: number;
  MAILPIT_HTTP_PORT: number;
  // API Security
  CORS_ORIGIN: string;
  API_PREFIX: string;
  // W1-T03 Security Architecture Configuration
  security: SecurityConfig;
}

export function parseEnvironment(env: Record<string, string | undefined>): EnvironmentConfig {
  const host = env.POSTGRES_HOST || 'localhost';
  const port = parseInt(env.POSTGRES_PORT || '5433', 10);
  const db = env.POSTGRES_DB || 'enterprise_hms_db';
  const user = env.POSTGRES_USER || 'hms_user';
  const pass = env.POSTGRES_PASSWORD || '';

  const rabbitHost = env.RABBITMQ_HOST || 'localhost';
  const rabbitPort = parseInt(env.RABBITMQ_PORT || '5672', 10);
  const rabbitUser = env.RABBITMQ_USER || 'hms_rabbit';
  const rabbitPass = env.RABBITMQ_PASSWORD || '';
  const rabbitVhost = env.RABBITMQ_VHOST || '/';

  return {
    NODE_ENV: (env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
    API_PORT: parseInt(env.API_PORT || '3000', 10),
    WEB_PORT: parseInt(env.WEB_PORT || '4200', 10),
    LOG_LEVEL: (env.LOG_LEVEL as EnvironmentConfig['LOG_LEVEL']) || 'info',
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_DB: db,
    POSTGRES_USER: user,
    POSTGRES_PASSWORD: pass,
    POSTGRES_SSL: env.POSTGRES_SSL === 'true',
    DATABASE_URL:
      env.DATABASE_URL ||
      `postgresql://${user}:${pass}@${host}:${port}/${db}?schema=platform_schema`,
    RABBITMQ_HOST: rabbitHost,
    RABBITMQ_PORT: rabbitPort,
    RABBITMQ_MGMT_PORT: parseInt(env.RABBITMQ_MGMT_PORT || '15672', 10),
    RABBITMQ_USER: rabbitUser,
    RABBITMQ_PASSWORD: rabbitPass,
    RABBITMQ_VHOST: rabbitVhost,
    RABBITMQ_URL:
      env.RABBITMQ_URL ||
      `amqp://${rabbitUser}:${rabbitPass}@${rabbitHost}:${rabbitPort}${rabbitVhost === '/' ? '/' : '/' + rabbitVhost}`,
    REDIS_HOST: env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: env.REDIS_PASSWORD,
    REDIS_URL: env.REDIS_URL || env.KV_URL,
    MAILPIT_HOST: env.MAILPIT_HOST || 'localhost',
    MAILPIT_SMTP_PORT: parseInt(env.MAILPIT_SMTP_PORT || '1025', 10),
    MAILPIT_HTTP_PORT: parseInt(env.MAILPIT_HTTP_PORT || '8025', 10),
    CORS_ORIGIN: env.CORS_ORIGIN || 'http://localhost:4200',
    API_PREFIX: env.API_PREFIX || '/api/v1',
    security: parseSecurityConfig(
      env,
      (env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
    ),
  };
}
