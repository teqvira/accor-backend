import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { campaignRepository } from '../repositories/campaign.repository';
import {
  CreateCampaignInput,
  ICampaign,
  UpdateCampaignInput,
} from '../types/campaigns.types';

function sanitizeCampaign(campaign: ICampaign) {
  return {
    id: campaign._id,
    name: campaign.name,
    walletAmount: campaign.walletAmount,
    rewardPoints: campaign.rewardPoints,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    active: campaign.active,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

export class CampaignsService {
  async create(input: CreateCampaignInput) {
    const campaign = await campaignRepository.create({
      name: input.name,
      walletAmount: input.walletAmount,
      rewardPoints: input.rewardPoints,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      active: false,
    });
    return sanitizeCampaign(campaign);
  }

  async list(page = 1, limit = 20) {
    const { items, total } = await campaignRepository.findAll(page, limit);
    return {
      items: items.map(sanitizeCampaign),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const campaign = await campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `getById: id=${id}`);
    }
    return sanitizeCampaign(campaign);
  }

  async update(id: string, input: UpdateCampaignInput) {
    const campaign = await campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `update: id=${id}`);
    }

    const name = input.name !== undefined ? input.name : campaign.name;
    const walletAmount =
      input.walletAmount !== undefined ? input.walletAmount : campaign.walletAmount;
    const rewardPoints =
      input.rewardPoints !== undefined ? input.rewardPoints : campaign.rewardPoints;
    const startDate =
      input.startDate !== undefined
        ? new Date(input.startDate)
        : campaign.startDate;
    const endDate =
      input.endDate !== undefined ? new Date(input.endDate) : campaign.endDate;

    if (endDate < startDate) {
      throw new BadRequestError(
        'End date must be on or after start date',
        `update: invalid date range id=${id}`
      );
    }

    const updated = await campaignRepository.update(id, {
      name,
      walletAmount,
      rewardPoints,
      startDate,
      endDate,
    });

    if (!updated) {
      throw new NotFoundError('Campaign not found', `update: id=${id}`);
    }

    return sanitizeCampaign(updated);
  }

  async activate(id: string) {
    const campaign = await campaignRepository.setActive(id, true);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `activate: id=${id}`);
    }
    return sanitizeCampaign(campaign);
  }

  async deactivate(id: string) {
    const campaign = await campaignRepository.setActive(id, false);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `deactivate: id=${id}`);
    }
    return sanitizeCampaign(campaign);
  }

  async getActiveCampaignById(id: string) {
    const campaign = await campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `getActiveCampaignById: id=${id}`);
    }
    return campaign;
  }

  isCampaignCurrentlyValid(campaign: ICampaign): boolean {
    if (!campaign.active) return false;
    const now = new Date();
    return now >= campaign.startDate && now <= campaign.endDate;
  }
}

export const campaignsService = new CampaignsService();
