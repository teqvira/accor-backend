import { withTransaction } from '../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { productsService } from '../products/products.service';
import { userRepository } from '../auth/repositories/user.repository';
import {
  campaignsRepository,
  parseEndDate,
  parseStartDate,
} from './campaigns.repository';
import {
  CampaignFilterParams,
  CreateCampaignInput,
  ICampaign,
  UpdateCampaignInput,
  ActiveCampaignMultiplier,
} from './campaigns.types';

function generateCampaignCode(): string {
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `CMP-${randomChars}`;
}

export class CampaignsService {
  async createCampaign(
    input: CreateCampaignInput,
    userId?: string
  ): Promise<ICampaign> {
    // 1. Verify product exists
    await productsService.getActiveProductById(input.productId);

    // 2. Verify batches exist and belong to the specified product
    if (input.batchIds && input.batchIds.length > 0) {
      const validBatches = await campaignsRepository.validateBatchesBelongToProduct(
        input.productId,
        input.batchIds
      );
      if (!validBatches) {
        throw new BadRequestError(
          'One or more selected batches do not exist or do not belong to the selected product',
          `createCampaign: productId=${input.productId}`
        );
      }
    }

    // 3. Generate or format campaign code
    const campaignCode = input.campaignCode
      ? input.campaignCode.trim().toUpperCase()
      : generateCampaignCode();

    // 4. Check code uniqueness
    const existing = await campaignsRepository.findByCode(campaignCode);
    if (existing) {
      throw new ConflictError(
        `Campaign code '${campaignCode}' already exists`,
        `createCampaign: code=${campaignCode}`
      );
    }

    return withTransaction(async (client) => {
      return campaignsRepository.create(
        {
          ...input,
          campaignCode,
          createdBy: userId,
        },
        client
      );
    });
  }

  async getCampaignById(id: string): Promise<ICampaign> {
    const campaign = await campaignsRepository.findById(id);
    if (!campaign) {
      throw new NotFoundError(
        'Campaign not found',
        `getCampaignById: id=${id}`
      );
    }
    return campaign;
  }

  async listCampaigns(params: CampaignFilterParams) {
    return campaignsRepository.findAll(params);
  }

  async getCampaignsForUser(userId: string): Promise<ICampaign[]> {
    const user = await userRepository.findById(userId);
    const userPincode = user?.pincode || null;
    return campaignsRepository.findActiveCampaignsForUser(userPincode);
  }

  async updateCampaign(
    id: string,
    input: UpdateCampaignInput
  ): Promise<ICampaign> {
    const campaign = await this.getCampaignById(id);

    const targetProductId = input.productId || campaign.productId;
    if (input.productId) {
      await productsService.getActiveProductById(input.productId);
    }

    if (input.batchIds && input.batchIds.length > 0) {
      const validBatches = await campaignsRepository.validateBatchesBelongToProduct(
        targetProductId,
        input.batchIds
      );
      if (!validBatches) {
        throw new BadRequestError(
          'One or more selected batches do not exist or do not belong to the selected product',
          `updateCampaign: productId=${targetProductId}`
        );
      }
    }

    const startDate = input.startDate ? parseStartDate(input.startDate) : campaign.startDate;
    const endDate = input.endDate ? parseEndDate(input.endDate) : campaign.endDate;
    if (endDate < startDate) {
      throw new BadRequestError(
        'End date must be on or after start date',
        `updateCampaign: startDate=${startDate}, endDate=${endDate}`
      );
    }

    if (input.campaignCode) {
      const formattedCode = input.campaignCode.trim().toUpperCase();
      if (formattedCode !== campaign.campaignCode) {
        const existing = await campaignsRepository.findByCode(formattedCode);
        if (existing) {
          throw new ConflictError(
            `Campaign code '${formattedCode}' already exists`,
            `updateCampaign: code=${formattedCode}`
          );
        }
        input.campaignCode = formattedCode;
      }
    }

    return withTransaction(async (client) => {
      const updated = await campaignsRepository.update(id, input, client);
      if (!updated) {
        throw new BadRequestError(
          'Failed to update campaign',
          `updateCampaign: id=${id}`
        );
      }
      return updated;
    });
  }

  async updateCampaignActive(
    id: string,
    active: boolean
  ): Promise<ICampaign> {
    return this.updateCampaign(id, { active });
  }

  async deleteCampaign(id: string): Promise<{ success: boolean }> {
    await this.getCampaignById(id);
    const deleted = await campaignsRepository.delete(id);
    return { success: deleted };
  }

  async getActiveMultiplierForBatch(batchId: string) {
    return campaignsRepository.findActiveCampaignForBatch(batchId);
  }

  /** Returns the active campaign only if the user's pincode is eligible. */
  isEligibleForPincode(
    campaign: ActiveCampaignMultiplier,
    userPincode?: string | null
  ): boolean {
    if (campaign.pincodeScope !== 'specific') return true;
    if (!userPincode) return false;
    const actual = userPincode.trim();

    if (campaign.pincodes && campaign.pincodes.length > 0) {
      return campaign.pincodes.some((p) => p.trim() === actual);
    }

    const targeted = campaign.pincode?.trim();
    if (!targeted) return false;
    return targeted === actual;
  }

  async getEligibleCampaignForBatch(
    batchId: string,
    userPincode?: string | null
  ) {
    const campaign = await this.getActiveMultiplierForBatch(batchId);
    if (!campaign) return null;
    if (!this.isEligibleForPincode(campaign, userPincode)) return null;
    return campaign;
  }

  async getCampaignStats() {
    return campaignsRepository.getStats();
  }
}

export const campaignsService = new CampaignsService();
