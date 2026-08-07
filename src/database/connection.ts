import { Pool } from 'pg';
import { env } from '../config/env';

const isLocalDb =
  env.DB_HOST === 'localhost' ||
  env.DB_HOST === '127.0.0.1' ||
  env.DB_HOST === 'postgres';

// Render / remote DBs often need longer than 2s to hand out a connection
// (cold start, SSL, network). 2s caused mobile redeem/notifications 500s.
const pool = new Pool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  max: isLocalDb ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: isLocalDb ? 5000 : 20000,
  keepAlive: true,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  // Idle client errors are recoverable; do not crash the whole process.
  console.error('PostgreSQL pool error:', err);
});

export default pool;
