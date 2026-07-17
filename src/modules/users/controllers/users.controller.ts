import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { UserRole } from '../../auth/types/user.types';
import { usersService } from '../services/users.service';

function parseRole(value: string | undefined): UserRole | undefined {
  if (!value) return undefined;
  return value as UserRole;
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export class UsersController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await usersService.list(page, limit, {
      role: parseRole(getOptionalQueryParam(req.query.role)),
      isActive: parseBooleanQuery(req.query.isActive),
      isVerified: parseBooleanQuery(req.query.isVerified),
      search: getOptionalQueryParam(req.query.search),
    });
    sendSuccess(res, 'Users fetched successfully', result);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const user = await usersService.getById(getParam(req.params.id));
    sendSuccess(res, 'User fetched successfully', { user });
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new Error('Authenticated user missing on request');
    }
    const user = await usersService.update(
      req.user,
      getParam(req.params.id),
      req.body
    );
    sendSuccess(res, 'User updated successfully', { user });
  }
}

export const usersController = new UsersController();
