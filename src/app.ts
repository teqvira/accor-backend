import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { captureDeviceContext } from './shared/middleware/device-token';
import { errorHandler } from './shared/middleware/error-handler';
import { registerRoutes } from './routes';

const app = express();

// Render sits behind a reverse proxy and sets X-Forwarded-For.
// Required so express-rate-limit can identify clients correctly.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Device-Token',
      'X-Device-Platform',
      'X-Device-Id',
      'X-Device-Name',
      'X-App-Version',
    ],
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(captureDeviceContext);

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

registerRoutes(app);
app.use(errorHandler);

export default app;
