/**
 * Enterprise HMS — Infrastructure Verification Script
 * Validates connectivity to PostgreSQL, RabbitMQ, Redis, and Mailpit
 */
const { Pool } = require('pg');
const amqp = require('amqplib');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verifyAll() {
  console.log('====================================================');
  console.log(' Enterprise HMS — Infrastructure Verification (W1-T01)');
  console.log('====================================================\n');

  let hasError = false;

  // 1. PostgreSQL
  try {
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      database: process.env.POSTGRES_DB || 'enterprise_hms_db',
      user: process.env.POSTGRES_USER || 'hms_user',
      password: process.env.POSTGRES_PASSWORD || 'hms_secure_dev_pass_2026',
      connectionTimeoutMillis: 4000,
    });
    const start = Date.now();
    const res = await pool.query('SELECT 1 as ping');
    const schemas = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%_schema'",
    );
    const elapsed = Date.now() - start;
    await pool.end();
    console.log(
      `[PASS] PostgreSQL: Connected (${elapsed}ms) - Found ${schemas.rows.length} domain schemas`,
    );
  } catch (err) {
    console.error(`[FAIL] PostgreSQL: ${err.message}`);
    hasError = true;
  }

  // 2. RabbitMQ
  try {
    const start = Date.now();
    const url =
      process.env.RABBITMQ_URL || 'amqp://hms_rabbit:hms_rabbit_dev_pass_2026@localhost:5672/';
    const conn = await amqp.connect(url);
    const ch = await conn.createChannel();
    await ch.close();
    await conn.close();
    const elapsed = Date.now() - start;
    console.log(`[PASS] RabbitMQ:   Connected via AMQP (${elapsed}ms)`);
  } catch (err) {
    console.error(`[FAIL] RabbitMQ:   ${err.message}`);
    hasError = true;
  }

  // 3. Redis
  try {
    const start = Date.now();
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || 'hms_redis_dev_pass_2026',
      connectTimeout: 4000,
    });
    const pong = await redis.ping();
    await redis.quit();
    const elapsed = Date.now() - start;
    console.log(`[PASS] Redis:      Connected (${elapsed}ms, reply: ${pong})`);
  } catch (err) {
    console.error(`[FAIL] Redis:      ${err.message}`);
    hasError = true;
  }

  // 4. Mailpit
  try {
    const start = Date.now();
    const transporter = nodemailer.createTransport({
      host: process.env.MAILPIT_HOST || 'localhost',
      port: parseInt(process.env.MAILPIT_SMTP_PORT || '1025', 10),
      secure: false,
    });
    await transporter.verify();
    const elapsed = Date.now() - start;
    console.log(`[PASS] Mailpit:    SMTP Server Ready (${elapsed}ms)`);
  } catch (err) {
    console.error(`[FAIL] Mailpit:    ${err.message}`);
    hasError = true;
  }

  console.log('\n----------------------------------------------------');
  if (hasError) {
    console.error('RESULT: Infrastructure verification FAILED.');
    process.exit(1);
  } else {
    console.log('RESULT: All infrastructure dependencies are 100% OPERATIONAL.');
    process.exit(0);
  }
}

verifyAll();
