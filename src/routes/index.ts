import { Express } from 'express';
import {
  authLimiter,
  redemptionLimiter,
  uploadLimiter,
} from '../shared/middleware/rate-limiters';
import { registerAdminRoutes } from './admin.routes';
import { registerPublicRoutes } from './public.routes';
import { registerUserRoutes } from './user.routes';
import { registerWebhookRoutes } from './webhook.routes';

export function registerRoutes(app: Express): void {
  // Prefix limiters run once per request. Attaching them to each audience mount
  // would count a single request multiple times, since Express runs middleware
  // for every mount whose prefix matches.
  app.use('/api/auth', authLimiter);
  app.use('/api/redemption', redemptionLimiter);
  app.use('/api/upload', uploadLimiter);

  // Public first, then user routes so literal paths such as /me and /balance
  // are matched before admin parameter routes such as /:id.
  registerPublicRoutes(app);
  registerUserRoutes(app);
  registerAdminRoutes(app);
  registerWebhookRoutes(app);
}
