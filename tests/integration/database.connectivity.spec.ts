import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('PostgreSQL Connectivity Integration Test', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      database: process.env.POSTGRES_DB || 'enterprise_hms_db',
      user: process.env.POSTGRES_USER || 'hms_user',
      password: process.env.POSTGRES_PASSWORD || 'hms_secure_dev_pass_2026',
      ssl: false,
      connectionTimeoutMillis: 5000,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should successfully connect and run SELECT 1', async () => {
    const res = await pool.query('SELECT 1 as result');
    expect(res.rows[0].result).toBe(1);
  });

  it('should have all 8 domain schemas initialized', async () => {
    const res = await pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name IN (
         'platform_schema', 
         'pms_schema', 
         'operations_schema', 
         'finance_schema', 
         'crm_schema', 
         'integration_schema', 
         'audit_schema', 
         'analytics_schema'
       ) ORDER BY schema_name`,
    );

    const schemaNames = res.rows.map((r) => r.schema_name);
    expect(schemaNames).toEqual([
      'analytics_schema',
      'audit_schema',
      'crm_schema',
      'finance_schema',
      'integration_schema',
      'operations_schema',
      'platform_schema',
      'pms_schema',
    ]);
  });
});
