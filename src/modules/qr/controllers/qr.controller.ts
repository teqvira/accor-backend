import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { exportBatchQrCodes } from '../services/qr-export.service';
import { qrBatchService } from '../services/qr-batch.service';
import { parseQrExportFormat } from '../utils/parse-export-format';

export class QrController {
  async createBatch(req: AuthRequest, res: Response): Promise<void> {
    const batch = await qrBatchService.createBatch({
      ...req.body,
      createdBy: req.user?.sub,
    });
    sendSuccess(res, 'QR batch created successfully', { batch }, 201);
  }

  async listBatches(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await qrBatchService.listBatches(page, limit);
    sendSuccess(res, 'QR batches fetched successfully', result);
  }

  async getBatch(req: AuthRequest, res: Response): Promise<void> {
    const batch = await qrBatchService.getBatchById(getParam(req.params.id));
    sendSuccess(res, 'QR batch fetched successfully', { batch });
  }

  async generateBatch(req: AuthRequest, res: Response): Promise<void> {
    const result = await qrBatchService.generateBatch(getParam(req.params.id));
    sendSuccess(res, 'QR codes generated successfully', result);
  }

  async getBatchStats(req: AuthRequest, res: Response): Promise<void> {
    const result = await qrBatchService.getBatchStats(getParam(req.params.id));
    sendSuccess(res, 'Batch statistics fetched successfully', result);
  }

  async listCodes(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const redeemedParam = getOptionalQueryParam(req.query.redeemed);
    const redeemed =
      redeemedParam === 'true'
        ? true
        : redeemedParam === 'false'
          ? false
          : undefined;

    const result = await qrBatchService.listCodes(page, limit, {
      batchId: getOptionalQueryParam(req.query.batchId),
      redeemed,
    });
    sendSuccess(res, 'QR codes fetched successfully', result);
  }

  async exportBatch(req: AuthRequest, res: Response): Promise<void> {
    const batchId = getParam(req.params.id);
    const batch = await qrBatchService.getBatchById(batchId);
    const format = parseQrExportFormat(req.query.format);
    const limit = getQueryNumber(req.query.limit, 1000);

    await exportBatchQrCodes(res, {
      batchName: batch.batchName,
      batchId,
      productSku: batch.productSku,
      shape: batch.shape,
      color: batch.color,
      format,
      limit,
    });
  }
}

export const qrController = new QrController();
