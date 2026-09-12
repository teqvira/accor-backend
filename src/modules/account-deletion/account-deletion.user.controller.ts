import { Response } from 'express';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { accountDeletionService } from './account-deletion.service';

export class AccountDeletionUserController {
  async deleteMe(req: AuthRequest, res: Response): Promise<void> {
    const result = await accountDeletionService.deleteFromApp(
      req.user!.sub,
      req.body?.reason
    );
    sendSuccess(res, 'Account deleted successfully', result);
  }
}

export const accountDeletionUserController =
  new AccountDeletionUserController();
