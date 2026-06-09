import { Response } from 'express';
import { getParam } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { redemptionService } from '../services/redemption.service';

export class RedemptionController {
  async validate(req: AuthRequest, res: Response): Promise<void> {
    const result = await redemptionService.validateCode(getParam(req.params.code));
    sendSuccess(res, 'QR code is valid for redemption', result);
  }

  async redeem(req: AuthRequest, res: Response): Promise<void> {
    const result = await redemptionService.redeem(req.user!.sub, req.body.code);
    sendSuccess(res, 'QR code redeemed successfully', result);
  }
}

export const redemptionController = new RedemptionController();
