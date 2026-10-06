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

  async getGarageOwners(req: AuthRequest, res: Response): Promise<void> {
    const search = req.query.search as string | undefined;
    const items = await usersService.getGarageOwners(search);
    sendSuccess(res, 'Garage owners fetched successfully', { items });
  }
}

export const usersUserController = new UsersUserController();
