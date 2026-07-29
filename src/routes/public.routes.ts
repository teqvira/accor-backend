import { Express } from 'express';
import { authPublicRoutes } from '../modules/auth/index';
import { redemptionPublicRoutes } from '../modules/redemption/index';
import { uploadSharedRoutes } from '../modules/file-upload/index';

export function registerPublicRoutes(app: Express): void {
  app.use('/api/auth', authPublicRoutes);
  app.use('/api/redemption', redemptionPublicRoutes);
  app.use('/api/upload', uploadSharedRoutes);
}
