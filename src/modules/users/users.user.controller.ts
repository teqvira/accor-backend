import { Response } from 'express';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { usersService } from './users.service';

export class UsersUserController {
  async getMe(req: AuthRequest, res: Response): Promise<void> {
    const result = await usersService.getMe(req.user!.sub);
    sendSuccess(res, 'Profile fetched successfully', result);
  }

  async completeProfile(req: AuthRequest, res: Response): Promise<void> {
    const result = await usersService.completeProfile(req.user!.sub, req.body);
    sendSuccess(res, 'Profile saved successfully', result);
  }
}

export const usersUserController = new UsersUserController();
