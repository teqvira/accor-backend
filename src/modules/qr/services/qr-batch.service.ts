import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { campaignRepository } from '../../campaigns/repositories/campaign.repository';
import { ICampaign } from '../../campaigns/types/campaigns.types';
import { campaignsService } from '../../campaigns/services/campaigns.service';
import { productRepository } from '../../products/repositories/product.repository';
import { IProduct } from '../../products/types/products.types';
import { qrBatchRepository } from '../repositories/qr-batch.repository';
import { qrCodeRepository } from '../repositories/qr-code.repository';
import {
  CreateBatchInput,
  IQrBatch,
  QrBatchStatus,
  QrCodeListFilters,
} from '../types/qr.types';
import { generateCodesForBatch } from './qr-generation.service';
import { generateBatchName } from '../utils/generate-batch-name';

function sanitizeBatch(batch: IQrBatch) {
  return {
    id: batch._id,
    name: batch.name,
    totalQrs: batch.totalQrs,
    generatedCount: batch.generatedCount,
    productId: batch.productId,
    product: batch.product,
    campaignId: batch.campaignId,
    description: batch.description,
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
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError(
        'Campaign not found',
        `getCampaignForBatch: campaignId=${campaignId}`
      );
    }
    return campaign;
  }

  private async getProductForBatch(productId: string): Promise<IProduct> {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(
        'Product not found',
        `getProductForBatch: productId=${productId}`
      );
    }

    if (product.status !== 'active') {
      throw new BadRequestError(
        'Selected product is not active',
        `getProductForBatch: inactive productId=${productId}`
      );
    }

    return product;
  }

  private resolveCampaignId(
    inputCampaignId: string | undefined,
    product: IProduct
  ): string {
    const campaignId = inputCampaignId ?? product.campaignId;
    if (!campaignId) {
      throw new BadRequestError(
        'Campaign is required. Link a campaign to the product or pass campaignId',
        `resolveCampaignId: missing campaign for productId=${product._id}`
      );
    }
    return campaignId;
  }

  async createBatch(input: CreateBatchInput) {
    const product = await this.getProductForBatch(input.productId);
    const campaignId = this.resolveCampaignId(input.campaignId, product);
    const campaign = await this.getCampaignForBatch(campaignId);
    this.assertCampaignIsActiveForGeneration(campaign);

    const batchName =
      input.name?.trim() || generateBatchName(product.skuCode);

    const batch = await qrBatchRepository.create({
      name: batchName,
      totalQrs: input.totalQrs,
      productId: product._id,
      campaignId: campaign._id,
      description: input.description,
      generatedCount: 0,
      status: QrBatchStatus.DRAFT,
    });

    const batchWithProduct = await qrBatchRepository.findById(batch._id);
    return sanitizeBatch(batchWithProduct ?? batch);
  }

  async listBatches(page = 1, limit = 20) {
    const { items, total } = await qrBatchRepository.findAll(page, limit);
    return {
      items: items.map(sanitizeBatch),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBatchById(id: string) {
    const batch = await qrBatchRepository.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `getBatchById: id=${id}`);
    }
    return sanitizeBatch(batch);
  }

  async generateBatch(id: string) {
    const batch = await qrBatchRepository.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `generateBatch: id=${id}`);
    }

    if (!batch.productId) {
      throw new BadRequestError(
        'Assign a product to this batch before generating QR codes',
        `generateBatch: missing productId id=${id}`
      );
    }

    if (!batch.campaignId) {
      throw new BadRequestError(
        'Assign an active campaign to this batch before generating QR codes',
        `generateBatch: missing campaignId id=${id}`
      );
    }

    const campaign = await this.getCampaignForBatch(batch.campaignId);
    this.assertCampaignIsActiveForGeneration(campaign);

    if (batch.generatedCount >= batch.totalQrs) {
      throw new BadRequestError(
        'All QR codes for this batch have already been generated',
        `generateBatch: batch complete id=${id}`
      );
    }

    const created = await generateCodesForBatch(batch);
    const newGeneratedCount = batch.generatedCount + created;
    let newStatus = batch.status;
    if (newGeneratedCount >= batch.totalQrs) {
      newStatus = batch.campaignId
        ? QrBatchStatus.ASSIGNED
        : QrBatchStatus.GENERATED;
    } else if (newGeneratedCount > 0) {
      newStatus = batch.campaignId
        ? QrBatchStatus.ASSIGNED
        : QrBatchStatus.GENERATED;
    }

    const updatedBatch = await qrBatchRepository.updateAfterGeneration(
      batch._id,
      newGeneratedCount,
      newStatus
    );

    if (!updatedBatch) {
      throw new NotFoundError('QR batch not found', `generateBatch: id=${id}`);
    }

    const batchWithProduct = await qrBatchRepository.findById(updatedBatch._id);

    return {
      batch: sanitizeBatch(batchWithProduct ?? updatedBatch),
      newlyGenerated: created,
    };
  }

  async assignCampaign(batchId: string, campaignId: string) {
    const [batch, campaign] = await Promise.all([
      qrBatchRepository.findById(batchId),
      campaignRepository.findById(campaignId),
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

    const updatedBatch = await qrBatchRepository.assignCampaign(
      batchId,
      campaign._id
    );
    if (!updatedBatch) {
      throw new NotFoundError('QR batch not found', `assignCampaign: batchId=${batchId}`);
    }

    await qrCodeRepository.updateCampaignForUnredeemed(batchId, campaign._id);

    return sanitizeBatch(updatedBatch);
  }

  async getBatchStats(id: string) {
    const batch = await qrBatchRepository.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `getBatchStats: id=${id}`);
    }

    const { total, redeemed, unredeemed } =
      await qrCodeRepository.getBatchStats(batch._id);

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
    filters: QrCodeListFilters = {}
  ) {
    const { items, total } = await qrCodeRepository.findAll(page, limit, filters);

    return {
      items: items.map((q) => ({
        id: q._id,
        code: q.code,
        batchId: q.batchId,
        productId: q.productId,
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
