import { customAlphabet } from 'nanoid';
import { Types } from 'mongoose';
import { env } from '../../../config/env';
import {
  getInsertedDocsCount,
  isMongoDuplicateKeyError,
} from '../../../shared/utils/mongo';
import { QrCode } from '../models/qr-code.model';
import { IQrBatch } from '../models/qr-batch.model';

interface QrCodeInsertDoc {
  code: string;
  batchId: Types.ObjectId;
  campaignId?: Types.ObjectId;
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateCode = customAlphabet(ALPHABET, env.QR_CODE_LENGTH);

export function buildQrPayload(code: string): string {
  return `${env.REDEMPTION_BASE_URL}/redeem/${code}`;
}

export async function generateCodesForBatch(batch: IQrBatch): Promise<number> {
  const remaining = batch.totalQrs - batch.generatedCount;
  if (remaining <= 0) return 0;

  let created = 0;
  const chunkSize = env.QR_GENERATION_CHUNK_SIZE;

  while (created < remaining) {
    const batchSize = Math.min(chunkSize, remaining - created);
    const docs: QrCodeInsertDoc[] = [];
    const codes = new Set<string>();

    while (docs.length < batchSize) {
      const code = generateCode();
      if (codes.has(code)) continue;
      codes.add(code);
      docs.push({
        code,
        batchId: batch._id,
        ...(batch.campaignId ? { campaignId: batch.campaignId } : {}),
      });
    }

    try {
      const inserted = await QrCode.insertMany(docs, { ordered: false });
      created += inserted.length;
    } catch (err: unknown) {
      if (isMongoDuplicateKeyError(err)) {
        const insertedCount = getInsertedDocsCount(err);
        if (insertedCount > 0) {
          created += insertedCount;
        }
        continue;
      }
      throw err;
    }
  }

  return created;
}
