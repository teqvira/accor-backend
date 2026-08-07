/**
 * Generates a max-packed multi-coupon QR PDF on one 12" × 18" white sheet.
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
const BORDER_W = 3;
const BORDER_INSET = 6;
const GAP_X = 10;
const GAP_Y = 10;

/** Max cols/rows that fit inside bleed + border on one sheet. */
function maxGridForLabel(
  labelW: number,
  labelH: number
): { cols: number; rows: number; marginX: number; marginY: number } {
  const safeMargin = Math.max(BLEED, BORDER_INSET + BORDER_W / 2);
  const usableW = PAGE_W - safeMargin * 2;
  const usableH = PAGE_H - safeMargin * 2;

  const cols = Math.max(
    1,
    Math.floor((usableW + GAP_X) / (labelW + GAP_X))
  );
  const rows = Math.max(
    1,
    Math.floor((usableH + GAP_Y) / (labelH + GAP_Y))
  );

  const gridW = cols * labelW + (cols - 1) * GAP_X;
  const gridH = rows * labelH + (rows - 1) * GAP_Y;
  const marginX = Math.max(safeMargin, (PAGE_W - gridW) / 2);
  const marginY = Math.max(safeMargin, (PAGE_H - gridH) / 2);

  return { cols, rows, marginX, marginY };
}

function makeDummyCodes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return `DmmyQr${n}Xx`;
  });
}

async function render(
  shape: QrLabelShape,
  outPath: string
): Promise<{ cols: number; rows: number; count: number }> {
  const { width: labelW, height: labelH } = getLabelSize(shape);
  const { cols, rows, marginX, marginY } = maxGridForLabel(labelW, labelH);
  const perPage = cols * rows;
  const codes = makeDummyCodes(perPage);
  const cellW = labelW + GAP_X;
  const cellH = labelH + GAP_Y;

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
      doc
        .rect(
          BORDER_INSET,
          BORDER_INSET,
          PAGE_W - BORDER_INSET * 2,
          PAGE_H - BORDER_INSET * 2
        )
        .lineWidth(BORDER_W)
        .strokeColor('#4A4A4A')
        .stroke();

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

  return { cols, rows, count: perPage };
}

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });

  const capPath = path.join(outDir, 'dummy-qr-cap.pdf');
  const squarePath = path.join(outDir, 'dummy-qr-square.pdf');

  const cap = await render('cap', capPath);
  const square = await render('square', squarePath);

  console.log('Max-packed dummy QR sheets (12" × 18", 3mm bleed, 10pt gap):');
  console.log(
    ` - ${capPath} → ${cap.cols}×${cap.rows} = ${cap.count} coupons`
  );
  console.log(
    ` - ${squarePath} → ${square.cols}×${square.rows} = ${square.count} coupons`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
