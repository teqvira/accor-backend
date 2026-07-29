import { Express } from 'express';
import { payoutWebhookRoutes } from '../modules/withdrawals/index';

export function registerWebhookRoutes(app: Express): void {
  app.use('/api/webhooks', payoutWebhookRoutes);
}
