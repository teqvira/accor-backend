import { customAlphabet } from 'nanoid';

const generateSuffix = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

function slugify(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .slice(0, 24);
}

export function generateBatchName(campaignName?: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = campaignName ? slugify(campaignName) : 'BATCH';
  return `${prefix}-${date}-${generateSuffix()}`;
}
