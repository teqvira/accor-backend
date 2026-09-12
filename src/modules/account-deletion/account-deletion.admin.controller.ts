import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { accountDeletionService } from './account-deletion.service';
import {
  AccountDeletionSource,
  AccountDeletionStatus,
} from './account-deletion.types';

export class AccountDeletionAdminController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const result = await accountDeletionService.listForAdmin({
      page: getQueryNumber(req.query.page, 1),
      limit: getQueryNumber(req.query.limit, 20),
      status: getOptionalQueryParam(req.query.status) as
        | AccountDeletionStatus
        | undefined,
      source: getOptionalQueryParam(req.query.source) as
        | AccountDeletionSource
        | undefined,
      search: getOptionalQueryParam(req.query.search),
    });
    sendSuccess(res, 'Account deletion requests fetched successfully', result);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const request = await accountDeletionService.getByIdForAdmin(
      getParam(req.params.id)
    );
    sendSuccess(res, 'Account deletion request fetched successfully', {
      request,
    });
  }

  async cancel(req: AuthRequest, res: Response): Promise<void> {
    const request = await accountDeletionService.cancelRequest(
      getParam(req.params.id),
      req.user!.sub
    );
    sendSuccess(res, 'Account deletion request cancelled successfully', {
      request,
    });
  }

  async process(req: AuthRequest, res: Response): Promise<void> {
    const request = await accountDeletionService.processRequestNow(
      getParam(req.params.id),
      req.user!.sub
    );
    sendSuccess(res, 'Account deleted successfully', { request });
  }
}

export const accountDeletionAdminController =
  new AccountDeletionAdminController();
