import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { authRoutes } from '../modules/auth';
import { uploadRoutes } from '../modules/file-upload';

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

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many upload requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/upload routes (20 requests per 15 minutes)',
  },
});

export function registerRoutes(app: Express): void {
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/upload', uploadLimiter, uploadRoutes);
}
