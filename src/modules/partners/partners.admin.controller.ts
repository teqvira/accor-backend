import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { ApprovalStatus, UserType } from '../auth/user.types';
import { partnersService } from './partners.service';

export class PartnersAdminController {
  async getStats(_req: AuthRequest, res: Response): Promise<void> {
    const stats = await partnersService.getStats();
    sendSuccess(res, 'Partner stats fetched successfully', { stats });
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    const result = await partnersService.list(
      getQueryNumber(req.query.page, 1),
      getQueryNumber(req.query.limit, 20),
      {
        userType: getOptionalQueryParam(req.query.userType) as
          | UserType
          | undefined,
        approvalStatus: getOptionalQueryParam(req.query.approvalStatus) as
          | ApprovalStatus
          | undefined,
        search: getOptionalQueryParam(req.query.search),
      }
    );
    sendSuccess(res, 'Partners fetched successfully', result);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const partner = await partnersService.getById(getParam(req.params.id));
    sendSuccess(res, 'Partner fetched successfully', { partner });
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    const partner = await partnersService.create(req.body);
    sendSuccess(res, 'Partner created successfully', { partner }, 201);
  }

  async approve(req: AuthRequest, res: Response): Promise<void> {
    const partner = await partnersService.approve(getParam(req.params.id));
    sendSuccess(res, 'Partner approved successfully', { partner });
  }

  async reject(req: AuthRequest, res: Response): Promise<void> {
    const partner = await partnersService.reject(
      getParam(req.params.id),
      req.body?.reason
    );
    sendSuccess(res, 'Partner rejected successfully', { partner });
  }

  async createDocumentPresignedUrl(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    const result = await partnersService.createDocumentPresignedUrl(
      getParam(req.params.id),
      req.body
    );
    sendSuccess(res, 'Presigned upload URL generated successfully', result);
  }

  async updateDocuments(req: AuthRequest, res: Response): Promise<void> {
    const partner = await partnersService.updateDocuments(
      getParam(req.params.id),
      req.body
    );
    sendSuccess(res, 'Partner documents updated successfully', { partner });
  }
}

export const partnersAdminController = new PartnersAdminController();
