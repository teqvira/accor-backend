import { Request, Response, Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.post(
  '/razorpay/payout',
  asyncHandler((req, res) => webhookController.razorpayPayout(req, res))
);

router.post(
  '/cashfree/payout',
  asyncHandler((req, res) => webhookController.cashfreePayout(req, res))
);

export default router;
