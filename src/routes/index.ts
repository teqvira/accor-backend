import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { authRoutes } from '../modules/auth';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/auth routes (50 requests per 15 minutes)',
  },
});

export function registerRoutes(app: Express): void {
  app.use('/api/auth', authLimiter, authRoutes);
}
