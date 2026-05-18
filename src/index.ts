import app from './app';
import { env } from './config/env';
import { connectDatabase } from './db/connection';
import { bootstrapAdmin } from './utils/bootstrap';

async function main() {
  await connectDatabase();
  await bootstrapAdmin();

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Auth API: http://localhost:${env.PORT}/api/auth`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
