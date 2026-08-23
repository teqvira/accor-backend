import { Response } from 'express';
import { BadRequestError } from '../../shared/utils/errors';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { campaignsService } from './campaigns.service';
import { CampaignStatus } from './campaigns.types';

function parseCampaignStatus(value: string | undefined): CampaignStatus | undefined {
  if (!value) return undefined;
  return value as CampaignStatus;
}

export class CampaignsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await campaignsService.createCampaign(
      req.body,
      req.user?.sub
    );
    sendSuccess(res, 'Campaign created successfully', { campaign }, 201);
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const productId = getOptionalQueryParam(req.query.productId);
    const status = parseCampaignStatus(getOptionalQueryParam(req.query.status));
    const search = getOptionalQueryParam(req.query.search);

    const result = await campaignsService.listCampaigns({
      page,
      limit,
      productId,
      status,
      search,
    });

    sendSuccess(res, 'Campaigns fetched successfully', result);
  }

  async listUserCampaigns(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.sub;
    if (!userId) {
      sendSuccess(res, 'Active campaigns fetched successfully', { items: [] });
      return;
    }
    const items = await campaignsService.getCampaignsForUser(userId);
    sendSuccess(res, 'Active campaigns fetched successfully', { items });
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const campaign = await campaignsService.getCampaignById(id);
    sendSuccess(res, 'Campaign fetched successfully', { campaign });
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const campaign = await campaignsService.updateCampaign(id, req.body);
    sendSuccess(res, 'Campaign updated successfully', { campaign });
  }

  async updateActive(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      throw new BadRequestError(
        'Field "active" must be a boolean (true or false)',
        `updateActive: active=${active}`
      );
    }
    const campaign = await campaignsService.updateCampaignActive(id, active);
    sendSuccess(res, 'Campaign active status updated successfully', { campaign });
  }

  async getStats(_req: AuthRequest, res: Response): Promise<void> {
    const stats = await campaignsService.getCampaignStats();
    sendSuccess(res, 'Campaign stats fetched successfully', { stats });
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const result = await campaignsService.deleteCampaign(id);
    sendSuccess(res, 'Campaign deleted successfully', result);
  }
}

export const campaignsController = new CampaignsController();
