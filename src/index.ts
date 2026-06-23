import app from './app';
import { env } from './config/env';
import pool from './database/connection';
import { bootstrapAdmin } from './modules/auth';

const startServer = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected: accor_db');
    await bootstrapAdmin();
    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
      console.log(`Auth API: http://localhost:${env.PORT}/api/auth`);
    });
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
};

startServer();
