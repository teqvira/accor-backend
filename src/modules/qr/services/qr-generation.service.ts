import { customAlphabet } from 'nanoid';
import { env } from '../../../config/env';
import { qrCodeRepository } from '../repositories/qr-code.repository';
import { IQrBatch } from '../qr.types';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateCode = customAlphabet(ALPHABET, env.QR_CODE_LENGTH);

export function buildQrPayload(code: string): string {
  return `${env.REDEMPTION_BASE_URL}/redeem/${code}`;
}

export async function generateCodesForBatch(batch: IQrBatch): Promise<number> {
  if (!batch.productId) {
    throw new Error(`Batch ${batch._id} is missing product_id`);
  }

  const remaining = batch.totalQrs - batch.generatedCount;
  if (remaining <= 0) return 0;

  let created = 0;
  const chunkSize = env.QR_GENERATION_CHUNK_SIZE;

  while (created < remaining) {
    const batchSize = Math.min(chunkSize, remaining - created);
    const docs: Array<{
      code: string;
      batchId: string;
      productId: string;
    }> = [];
    const codes = new Set<string>();

    while (docs.length < batchSize) {
      const code = generateCode();
      if (codes.has(code)) continue;
      codes.add(code);
      docs.push({
        code,
        batchId: batch._id,
        productId: batch.productId,
      });
    }

    const inserted = await qrCodeRepository.bulkCreate(docs);
    if (inserted > 0) {
      created += inserted;
    }
  }

  return created;
}
