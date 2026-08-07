import { Express } from 'express';
import { homeUserRoutes } from '../modules/home/index';
import { usersUserRoutes } from '../modules/users/index';
import { walletUserRoutes } from '../modules/wallet/index';
import { rewardsUserRoutes } from '../modules/rewards/index';
import { redemptionUserRoutes } from '../modules/redemption/index';
import { uploadUserRoutes } from '../modules/file-upload/index';
import { withdrawalRoutes } from '../modules/withdrawals/index';
import { notificationsUserRoutes } from '../modules/notifications/index';

export function registerUserRoutes(app: Express): void {
  app.use('/api/home', homeUserRoutes);
  app.use('/api/users', usersUserRoutes);
  app.use('/api/wallet', walletUserRoutes);
  app.use('/api/wallet', withdrawalRoutes);
  app.use('/api/rewards', rewardsUserRoutes);
  app.use('/api/redemption', redemptionUserRoutes);
  app.use('/api/upload', uploadUserRoutes);
  app.use('/api/notifications', notificationsUserRoutes);
}
