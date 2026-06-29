import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './shared/middleware/errorHandler';
import { registerRoutes } from './routes';

const app = express();

// Render sits behind a reverse proxy and sets X-Forwarded-For.
// Required so express-rate-limit can identify clients correctly.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

registerRoutes(app);
app.use(errorHandler);

export default app;
