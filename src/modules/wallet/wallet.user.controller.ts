import { Response } from 'express';
import { getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { walletService } from './wallet.service';

function resolveLimit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return getQueryNumber(value, fallback);
}

export class WalletUserController {
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getBalance(req.user!.sub);
    sendSuccess(res, 'Wallet balance fetched successfully', result);
  }

  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await walletService.getTransactions(
      req.user!.sub,
      page,
      limit
    );
    sendSuccess(res, 'Wallet transactions fetched successfully', result);
  }

  async getSummary(req: AuthRequest, res: Response): Promise<void> {
    const recentLimit = resolveLimit(req.query.recentLimit, 10);
    const result = await walletService.getSummary(req.user!.sub, recentLimit);
    sendSuccess(res, 'Wallet summary fetched successfully', result);
  }
}

export const walletUserController = new WalletUserController();
