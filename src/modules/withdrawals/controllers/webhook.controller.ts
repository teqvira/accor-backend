import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { withdrawalService } from '../services/withdrawal.service';

export class WebhookController {
  async razorpayPayout(req: Request, res: Response): Promise<void> {
    const signature = req.header('x-razorpay-signature') ?? '';
    await withdrawalService.handleRazorpayWebhook(
      req.body as Record<string, unknown>,
      signature
    );
    sendSuccess(res, 'Webhook processed');
  }

  async cashfreePayout(req: Request, res: Response): Promise<void> {
    await withdrawalService.handleCashfreeWebhook(
      req.body as Record<string, unknown>
    );
    sendSuccess(res, 'Webhook processed');
  }
}

export const webhookController = new WebhookController();
