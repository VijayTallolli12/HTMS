export type HealthStatus = 'ok' | 'degraded' | 'down';
export type ServiceHealthStatus = 'up' | 'down';

export interface ServiceHealth {
  status: ServiceHealthStatus;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface HealthServices {
  database: ServiceHealth;
  rabbitmq: ServiceHealth;
  redis: ServiceHealth;
  mailpit: ServiceHealth;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  services: HealthServices;
}

export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok' | 'down';
  timestamp: string;
  services: {
    database: ServiceHealth;
    rabbitmq: ServiceHealth;
    redis: ServiceHealth;
  };
}
