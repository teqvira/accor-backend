import { Express } from 'express';
import { authAdminRoutes } from '../modules/auth/index';
import { usersAdminRoutes } from '../modules/users/index';
import { walletAdminRoutes } from '../modules/wallet/index';
import { rewardsAdminRoutes } from '../modules/rewards/index';
import { uploadAdminRoutes } from '../modules/file-upload/index';
import { productsRoutes } from '../modules/products/index';
import { qrRoutes } from '../modules/qr/index';
import { dashboardRoutes } from '../modules/dashboard/index';
import { transactionsRoutes } from '../modules/transactions/index';

export function registerAdminRoutes(app: Express): void {
  app.use('/api/auth', authAdminRoutes);
  app.use('/api/users', usersAdminRoutes);
  app.use('/api/wallet', walletAdminRoutes);
  app.use('/api/rewards', rewardsAdminRoutes);
  app.use('/api/upload', uploadAdminRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/transactions', transactionsRoutes);
}
