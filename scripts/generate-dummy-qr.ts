/**
 * Generates a sample multi-coupon QR PDF on the 12" × 18" white sheet (with 3mm bleed).
 * Usage: npx tsx scripts/generate-dummy-qr.ts
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import {
  drawQrLabel,
  getLabelSize,
} from '../src/modules/qr/utils/qr-label.renderer';
import { QrLabelShape } from '../src/modules/qr/constants/qr-label.constants';

const metadata = {
  batchId: '00000000-0000-0000-0000-000000000001',
  batchName: 'BATCH-001',
  couponName: 'Launch Offer',
};

// White sheet: 12" × 18" (1200×1800 px @ 100 DPI) → PDF points @ 72 DPI
const PAGE_W = 12 * 72; // 864
const PAGE_H = 18 * 72; // 1296
// Bleed: 3mm ≈ 12px @ 100 DPI on every side
const BLEED = (12 / 100) * 72; // 8.64 pt

function gridForShape(shape: QrLabelShape): {
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
} {
  if (shape === 'square') {
    return { cols: 4, rows: 8, gapX: 10, gapY: 10 };
  }
  return { cols: 6, rows: 8, gapX: 10, gapY: 10 };
}

function makeDummyCodes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return `DmmyQr${n}Xx`;
  });
}

async function render(shape: QrLabelShape, outPath: string): Promise<void> {
  const { width: labelW, height: labelH } = getLabelSize(shape);
  const { cols, rows, gapX, gapY } = gridForShape(shape);
  const perPage = cols * rows;
  const codes = makeDummyCodes(perPage);

  const gridW = cols * labelW + (cols - 1) * gapX;
  const gridH = rows * labelH + (rows - 1) * gapY;
  const marginX = Math.max(BLEED, (PAGE_W - gridW) / 2);
  const marginY = Math.max(BLEED, (PAGE_H - gridH) / 2);
  const cellW = labelW + gapX;
  const cellH = labelH + gapY;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      size: [PAGE_W, PAGE_H],
    });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    doc.on('error', reject);
    stream.on('error', reject);
    stream.on('finish', resolve);

    (async () => {
      doc.addPage();
      for (let i = 0; i < codes.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * cellW;
        const y = marginY + row * cellH;
        await drawQrLabel(doc, x, y, codes[i], {
          ...metadata,
          shape,
          color: 'performance_green',
        });
      }
      doc.info.Title = `Dummy QR sheet — ${shape} (${perPage} coupons)`;
      doc.end();
    })().catch(reject);
  });
}

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });

  const capPath = path.join(outDir, 'dummy-qr-cap.pdf');
  const squarePath = path.join(outDir, 'dummy-qr-square.pdf');

  await render('cap', capPath);
  await render('square', squarePath);

  console.log('Generated multi-coupon dummy QR sheets (12" × 18", 3mm bleed):');
  console.log(' -', capPath, '(6×8 = 48 coupons)');
  console.log(' -', squarePath, '(4×8 = 32 coupons)');
  console.log('Label shows: BATCH-001 + Launch Offer');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
