import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './shared/middleware/errorHandler';
import { registerRoutes } from './routes';

const app = express();

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
