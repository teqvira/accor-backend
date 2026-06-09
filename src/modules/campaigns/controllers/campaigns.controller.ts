import { Response } from 'express';
import { getParam, getQueryNumber } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { campaignsService } from '../services/campaigns.service';

export class CampaignsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.create(req.body);
    sendSuccess(res, 'Campaign created successfully', { campaign }, 201);
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await campaignsService.list(page, limit);
    sendSuccess(res, 'Campaigns fetched successfully', result);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.getById(getParam(req.params.id));
    sendSuccess(res, 'Campaign fetched successfully', { campaign });
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.update(getParam(req.params.id), req.body);
    sendSuccess(res, 'Campaign updated successfully', { campaign });
  }

  async activate(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.activate(getParam(req.params.id));
    sendSuccess(res, 'Campaign activated successfully', { campaign });
  }

  async deactivate(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.deactivate(getParam(req.params.id));
    sendSuccess(res, 'Campaign deactivated successfully', { campaign });
  }
}

export const campaignsController = new CampaignsController();
