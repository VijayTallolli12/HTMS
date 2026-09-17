import { Pool } from 'pg';

export interface DatabaseHealthResult {
  status: 'up' | 'down';
  latencyMs: number;
  schemas: string[];
  version?: string;
  error?: string;
}

export async function checkDatabaseHealth(pool: Pool): Promise<DatabaseHealthResult> {
  const startTime = Date.now();
  try {
    const client = await pool.connect();
    try {
      const resVersion = await client.query<{ version: string }>('SELECT version()');
      const resSchemas = await client.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata 
         WHERE schema_name LIKE '%_schema' ORDER BY schema_name`,
      );

      const latencyMs = Date.now() - startTime;
      return {
        status: 'up',
        latencyMs,
        schemas: resSchemas.rows.map((r) => r.schema_name),
        version: resVersion.rows[0]?.version,
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      status: 'down',
      latencyMs: Date.now() - startTime,
      schemas: [],
      error: err.message || 'Unknown database connection error',
    };
  }
}
