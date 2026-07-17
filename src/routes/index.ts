import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { authRoutes } from '../modules/auth';
import { uploadRoutes } from '../modules/file-upload';
import { qrRoutes } from '../modules/qr';
import { redemptionRoutes } from '../modules/redemption';
import { rewardsRoutes } from '../modules/rewards';
import { transactionsRoutes } from '../modules/transactions';
import { productsRoutes } from '../modules/products';
import { usersRoutes } from '../modules/users';
import { payoutWebhookRoutes, withdrawalRoutes } from '../modules/withdrawals';
import { walletRoutes } from '../modules/wallet';

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

const redemptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many redemption attempts. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/redemption routes (30 requests per 15 minutes)',
  },
});

const withdrawLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many withdrawal requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on wallet withdrawal routes (10 requests per 15 minutes)',
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
  app.use('/api/users', usersRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/wallet', withdrawLimiter, withdrawalRoutes);
  app.use('/api/webhooks', payoutWebhookRoutes);
  app.use('/api/rewards', rewardsRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/redemption', redemptionLimiter, redemptionRoutes);
  app.use('/api/upload', uploadLimiter, uploadRoutes);
}
