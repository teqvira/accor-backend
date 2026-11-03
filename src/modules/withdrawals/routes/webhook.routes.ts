import { Request, Router } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

router.post(
  '/razorpay/payout',
  asyncHandler<Request>((req, res) =>
    webhookController.razorpayPayout(req, res)
  )
);

router.post(
  '/cashfree/payout',
  asyncHandler<Request>((req, res) =>
    webhookController.cashfreePayout(req, res)
  )
);

router.post(
  '/bulkpe/payout',
  asyncHandler<Request>((req, res) =>
    webhookController.bulkpePayout(req, res)
  )
);

export default router;
