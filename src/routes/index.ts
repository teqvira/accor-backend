import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { authRoutes } from '../modules/auth/index';
import { uploadRoutes } from '../modules/file-upload/index';
import { qrRoutes } from '../modules/qr/index';
import { redemptionRoutes } from '../modules/redemption/index';
import { rewardsRoutes } from '../modules/rewards/index';
import { transactionsRoutes } from '../modules/transactions/index';
import { productsRoutes } from '../modules/products/index';
import { usersRoutes } from '../modules/users/index';
import { dashboardRoutes } from '../modules/dashboard/index';
import { payoutWebhookRoutes, withdrawalRoutes } from '../modules/withdrawals/index';
import { walletRoutes } from '../modules/wallet/index';

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
  app.use('/api/dashboard', dashboardRoutes);
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
