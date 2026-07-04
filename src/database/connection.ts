import { Pool } from 'pg';
import { env } from '../config/env';

const isLocalDb = env.DB_HOST === 'localhost' || env.DB_HOST === '127.0.0.1' || env.DB_HOST === 'postgres';

const pool = new Pool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
  process.exit(1);
});

export default pool;
