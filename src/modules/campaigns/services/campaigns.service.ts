import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { Campaign, ICampaign } from '../models/campaign.model';
import { CreateCampaignInput, UpdateCampaignInput } from '../types/campaigns.types';

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
    const campaign = await Campaign.create({
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
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Campaign.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Campaign.countDocuments(),
    ]);
    return {
      items: items.map(sanitizeCampaign),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `getById: id=${id}`);
    }
    return sanitizeCampaign(campaign);
  }

  async update(id: string, input: UpdateCampaignInput) {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `update: id=${id}`);
    }

    if (input.name !== undefined) campaign.name = input.name;
    if (input.walletAmount !== undefined) campaign.walletAmount = input.walletAmount;
    if (input.rewardPoints !== undefined) campaign.rewardPoints = input.rewardPoints;
    if (input.startDate !== undefined) campaign.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) campaign.endDate = new Date(input.endDate);

    if (campaign.endDate < campaign.startDate) {
      throw new BadRequestError(
        'End date must be on or after start date',
        `update: invalid date range id=${id}`
      );
    }

    await campaign.save();
    return sanitizeCampaign(campaign);
  }

  async activate(id: string) {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `activate: id=${id}`);
    }
    campaign.active = true;
    await campaign.save();
    return sanitizeCampaign(campaign);
  }

  async deactivate(id: string) {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `deactivate: id=${id}`);
    }
    campaign.active = false;
    await campaign.save();
    return sanitizeCampaign(campaign);
  }

  async getActiveCampaignById(id: string) {
    const campaign = await Campaign.findById(id);
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
