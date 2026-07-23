import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { productsService } from '../../products/products.service';
import { productRepository } from '../../products/product.repository';
import { qrBatchRepository } from '../repositories/qr-batch.repository';
import { qrCodeRepository } from '../repositories/qr-code.repository';
import {
  DEFAULT_QR_LABEL_COLOR,
  DEFAULT_QR_LABEL_SHAPE,
  QrLabelColor,
} from '../constants/qr-label.constants';
import {
  CouponDisplayStatus,
  CreateBatchInput,
  IQrBatch,
  QrBatchListItem,
  QrBatchStatus,
  QrCodeListFilters,
} from '../qr.types';
import { generateCodesForBatch } from './qr-generation.service';
import { generateNextBatchLabel } from '../utils/generate-batch-name';

function buildPdfExportUrl(batchId: string): string {
  return `/api/qr/batches/${batchId}/export?format=pdf`;
}

function formatDate(date?: Date): string | undefined {
  return date ? date.toISOString() : undefined;
}

function resolveBatchColor(batch: IQrBatch): QrLabelColor {
  return batch.labelColor ?? DEFAULT_QR_LABEL_COLOR;
}

function resolveCouponStatus(batch: IQrBatch): CouponDisplayStatus {
  if (batch.status === QrBatchStatus.DRAFT || batch.generatedCount === 0) {
    return 'draft';
  }
  if (!batch.active) {
    return 'inactive';
  }
  const now = new Date();
  if (batch.endDate && now > batch.endDate) {
    return 'expired';
  }
  if (batch.startDate && now < batch.startDate) {
    return 'draft';
  }
  return 'active';
}

function toBatchListItem(batch: IQrBatch): QrBatchListItem {
  const stats = batch.stats ?? {
    generated: batch.generatedCount,
    redeemed: 0,
    pending: 0,
  };

  return {
    batchId: batch._id,
    batchName: batch.name,
    couponName: batch.couponName ?? '',
    productName: batch.product?.name ?? '',
    productSku: batch.product?.skuCode ?? '',
    productImageUrl: batch.product?.imageUrl,
    generated: stats.generated,
    redeemed: stats.redeemed,
    pending: stats.pending,
    pdfExportUrl: buildPdfExportUrl(batch._id),
    couponStatus: resolveCouponStatus(batch),
    totalQrs: batch.totalQrs,
    couponValue: batch.walletAmount,
    rewardPoints: batch.rewardPoints,
    shape: batch.labelShape,
    color: resolveBatchColor(batch),
    startDate: formatDate(batch.startDate),
    endDate: formatDate(batch.endDate),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export class QrBatchService {
  isBatchCurrentlyValid(batch: IQrBatch): boolean {
    if (!batch.active) return false;
    const now = new Date();
    if (batch.startDate && now < batch.startDate) return false;
    if (batch.endDate && now > batch.endDate) return false;
    return true;
  }

  isBatchRedeemable(batch: IQrBatch): boolean {
    return this.isBatchCurrentlyValid(batch) && batch.generatedCount > 0;
  }

  private async getActiveProductForBatch(productId: string) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(
        'Product not found',
        `getActiveProductForBatch: productId=${productId}`
      );
    }
    return productsService.getActiveProductById(productId);
  }

  async createBatch(input: CreateBatchInput) {
    await this.getActiveProductForBatch(input.productId);
    // Always auto-assign BATCH-001 style code for labels (UUID stays as batchId).
    const batchName = await generateNextBatchLabel();
    const labelColor = input.color ?? DEFAULT_QR_LABEL_COLOR;

    const batch = await qrBatchRepository.create({
      name: batchName,
      couponName: input.couponName?.trim(),
      totalQrs: input.totalQrs,
      productId: input.productId,
      walletAmount: input.couponValue,
      rewardPoints: input.rewardPoints,
      startDate: input.startDate,
      endDate: input.endDate,
      active: input.status !== 'inactive',
      generatedCount: 0,
      status: QrBatchStatus.DRAFT,
      labelShape: input.shape ?? DEFAULT_QR_LABEL_SHAPE,
      labelColor,
      createdBy: input.createdBy,
    });

    const batchWithProduct = await qrBatchRepository.findById(batch._id);
    return toBatchListItem(batchWithProduct ?? batch);
  }

  async listBatches(page = 1, limit = 20) {
    const { items, total } = await qrBatchRepository.findAll(page, limit);
    return {
      items: items.map(toBatchListItem),
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
    return toBatchListItem(batch);
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

    await this.getActiveProductForBatch(batch.productId);

    if (!this.isBatchCurrentlyValid(batch)) {
      throw new BadRequestError(
        'This coupon batch is inactive or outside its valid date range',
        `generateBatch: invalid batch id=${id}`
      );
    }

    if (batch.generatedCount >= batch.totalQrs) {
      throw new BadRequestError(
        'All QR codes for this batch have already been generated',
        `generateBatch: batch complete id=${id}`
      );
    }

    const created = await generateCodesForBatch(batch);
    const newGeneratedCount = batch.generatedCount + created;
    const newStatus =
      newGeneratedCount > 0 ? QrBatchStatus.GENERATED : batch.status;

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
      batch: toBatchListItem(batchWithProduct ?? updatedBatch),
      newlyGenerated: created,
    };
  }

  async getBatchStats(id: string) {
    const batch = await qrBatchRepository.findById(id);
    if (!batch) {
      throw new NotFoundError('QR batch not found', `getBatchStats: id=${id}`);
    }

    const { total, redeemed, unredeemed } =
      await qrCodeRepository.getBatchStats(batch._id);

    return {
      batch: toBatchListItem(batch),
      stats: {
        generated: batch.generatedCount,
        redeemed,
        pending: unredeemed,
        total,
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
