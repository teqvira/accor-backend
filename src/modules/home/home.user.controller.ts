import { Response } from 'express';
import { getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { homeService } from './home.service';

function resolveLimit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return getQueryNumber(value, fallback);
}

export class HomeUserController {
  async getHome(req: AuthRequest, res: Response): Promise<void> {
    const limit = resolveLimit(req.query.limit, 10);
    const result = await homeService.getHome(req.user!.sub, limit);
    sendSuccess(res, 'Home fetched successfully', result);
  }
}

export const homeUserController = new HomeUserController();
