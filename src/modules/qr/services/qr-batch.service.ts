import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { campaignsService } from '../../campaigns/services/campaigns.service';
import { Campaign, ICampaign } from '../../campaigns/models/campaign.model';
import { QrBatch, IQrBatch, QrBatchStatus } from '../models/qr-batch.model';
import { QrCode } from '../models/qr-code.model';
import { CreateBatchInput } from '../types/qr.types';
import { generateCodesForBatch } from './qr-generation.service';

function sanitizeBatch(batch: IQrBatch) {
  return {
    id: batch._id,
    name: batch.name,
    totalQrs: batch.totalQrs,
    generatedCount: batch.generatedCount,
    campaignId: batch.campaignId,
    status: batch.status,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export class QrBatchService {
  private assertCampaignIsActiveForGeneration(campaign: ICampaign): void {
    if (!campaign.active) {
      throw new BadRequestError(
        'Selected campaign is not active. Activate the campaign before generating QR codes',
        `assertCampaignIsActiveForGeneration: campaignId=${campaign._id}`
      );
    }

    if (!campaignsService.isCampaignCurrentlyValid(campaign)) {
      throw new BadRequestError(
        'Selected campaign is outside its valid date range',
        `assertCampaignIsActiveForGeneration: campaignId=${campaign._id}`
      );
    }
  }

  private async getCampaignForBatch(campaignId: string): Promise<ICampaign> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError(
        'Campaign not found',
        `getCampaignForBatch: campaignId=${campaignId}`
      );
    }
    return campaign;
  }

  async createBatch(input: CreateBatchInput) {
    const campaign = await this.getCampaignForBatch(input.campaignId);
    this.assertCampaignIsActiveForGeneration(campaign);

    const batch = await QrBatch.create({
      name: input.name,
      totalQrs: input.totalQrs,
      campaignId: campaign._id,
      generatedCount: 0,
      status: QrBatchStatus.DRAFT,
    });
    return sanitizeBatch(batch);
  }

  async listBatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      QrBatch.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      QrBatch.countDocuments(),
    ]);
    return {
      items: items.map(sanitizeBatch),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBatchById(id: string) {
    const batch = await QrBatch.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `getBatchById: id=${id}`);
    }
    return sanitizeBatch(batch);
  }

  async generateBatch(id: string) {
    const batch = await QrBatch.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `generateBatch: id=${id}`);
    }

    if (!batch.campaignId) {
      throw new BadRequestError(
        'Assign an active campaign to this batch before generating QR codes',
        `generateBatch: missing campaignId id=${id}`
      );
    }

    const campaign = await this.getCampaignForBatch(batch.campaignId.toString());
    this.assertCampaignIsActiveForGeneration(campaign);

    if (batch.generatedCount >= batch.totalQrs) {
      throw new BadRequestError(
        'All QR codes for this batch have already been generated',
        `generateBatch: batch complete id=${id}`
      );
    }

    const created = await generateCodesForBatch(batch);
    batch.generatedCount += created;
    if (batch.generatedCount >= batch.totalQrs) {
      batch.status =
        batch.campaignId ? QrBatchStatus.ASSIGNED : QrBatchStatus.GENERATED;
    } else if (batch.generatedCount > 0) {
      batch.status = batch.campaignId
        ? QrBatchStatus.ASSIGNED
        : QrBatchStatus.GENERATED;
    }
    await batch.save();

    return {
      batch: sanitizeBatch(batch),
      newlyGenerated: created,
    };
  }

  async assignCampaign(batchId: string, campaignId: string) {
    const [batch, campaign] = await Promise.all([
      QrBatch.findById(batchId),
      Campaign.findById(campaignId),
    ]);

    if (!batch) {
      throw new NotFoundError('QR batch not found', `assignCampaign: batchId=${batchId}`);
    }
    if (!campaign) {
      throw new NotFoundError('Campaign not found', `assignCampaign: campaignId=${campaignId}`);
    }

    this.assertCampaignIsActiveForGeneration(campaign);

    if (batch.generatedCount > 0) {
      throw new BadRequestError(
        'Campaign cannot be changed after QR codes have been generated',
        `assignCampaign: batch already generated id=${batchId}`
      );
    }

    batch.campaignId = campaign._id;
    batch.status = QrBatchStatus.ASSIGNED;
    await batch.save();

    await QrCode.updateMany(
      { batchId: batch._id, redeemed: false },
      { $set: { campaignId: campaign._id } }
    );

    return sanitizeBatch(batch);
  }

  async getBatchStats(id: string) {
    const batch = await QrBatch.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `getBatchStats: id=${id}`);
    }

    const [total, redeemed, unredeemed] = await Promise.all([
      QrCode.countDocuments({ batchId: batch._id }),
      QrCode.countDocuments({ batchId: batch._id, redeemed: true }),
      QrCode.countDocuments({ batchId: batch._id, redeemed: false }),
    ]);

    return {
      batch: sanitizeBatch(batch),
      stats: {
        total,
        redeemed,
        unredeemed,
        redemptionRate: total > 0 ? Number(((redeemed / total) * 100).toFixed(2)) : 0,
      },
    };
  }

  async listCodes(
    page = 1,
    limit = 20,
    filters: { batchId?: string; redeemed?: boolean } = {}
  ) {
    const query: {
      batchId?: string;
      redeemed?: boolean;
    } = {};
    if (filters.batchId) query.batchId = filters.batchId;
    if (filters.redeemed !== undefined) query.redeemed = filters.redeemed;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      QrCode.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      QrCode.countDocuments(query),
    ]);

    return {
      items: items.map((q) => ({
        id: q._id,
        code: q.code,
        batchId: q.batchId,
        campaignId: q.campaignId,
        redeemed: q.redeemed,
        redeemedBy: q.redeemedBy,
        redeemedAt: q.redeemedAt,
        createdAt: q.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const qrBatchService = new QrBatchService();
