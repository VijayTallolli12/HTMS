import { Pool, PoolConfig } from 'pg';

export interface HmsDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

let activePool: Pool | null = null;

export function createDatabasePool(config: HmsDatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl:
      config.ssl === true || (config.ssl as any) === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    max: config.max ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
  };

  activePool = new Pool(poolConfig);
  return activePool;
}

export function getDatabasePool(): Pool {
  if (!activePool) {
    throw new Error('Database pool not initialized. Call createDatabasePool first.');
  }
  return activePool;
}

export async function closeDatabasePool(): Promise<void> {
  if (activePool) {
    await activePool.end();
    activePool = null;
  }
}
