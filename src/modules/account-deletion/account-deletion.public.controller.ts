import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/response';
import { accountDeletionService } from './account-deletion.service';

export class AccountDeletionPublicController {
  async sendOtp(req: Request, res: Response): Promise<void> {
    const result = await accountDeletionService.sendWebsiteOtp(
      req.body.mobileNumber
    );
    sendSuccess(res, 'OTP sent successfully', result);
  }

  async confirm(req: Request, res: Response): Promise<void> {
    const result = await accountDeletionService.confirmWebsiteDeletion(
      req.body.mobileNumber,
      req.body.otp,
      req.body.reason
    );
    sendSuccess(res, 'Account deletion scheduled successfully', result);
  }
}

export const accountDeletionPublicController =
  new AccountDeletionPublicController();
