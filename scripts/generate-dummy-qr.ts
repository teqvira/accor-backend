/**
 * Generates sample QR label PDFs so you can verify batch code + SKU rendering.
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

const DUMMY_CODE = 'Ab12Cd34Ef56';
const metadata = {
  batchId: '00000000-0000-0000-0000-000000000001',
  batchName: 'BATCH-001',
  productSku: 'SKU-ENG-001',
};

async function render(shape: QrLabelShape, outPath: string): Promise<void> {
  const { width, height } = getLabelSize(shape);
  const margin = 18;
  const pageW = width + margin * 2;
  const pageH = height + margin * 2 + 40;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: [pageW, pageH], margin: 0 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    doc.on('error', reject);
    stream.on('error', reject);
    stream.on('finish', resolve);

    doc
      .fontSize(9)
      .fillColor('#111')
      .text(
        `Dummy coupon — shape=${shape} | batch=${metadata.batchName} | sku=${metadata.productSku} | code=${DUMMY_CODE}`,
        margin,
        8,
        { width: pageW - margin * 2, align: 'center' }
      );

    drawQrLabel(doc, margin, 28, DUMMY_CODE, {
      ...metadata,
      shape,
      color: 'performance_green',
    })
      .then(() => doc.end())
      .catch(reject);
  });
}

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });

  const capPath = path.join(outDir, 'dummy-qr-cap.pdf');
  const squarePath = path.join(outDir, 'dummy-qr-square.pdf');

  await render('cap', capPath);
  await render('square', squarePath);

  console.log('Generated dummy coupons:');
  console.log(' -', capPath);
  console.log(' -', squarePath);
  console.log('Label shows: BATCH-001 + SKU-ENG-001');
  console.log('QR encodes: REDEMPTION_BASE_URL/redeem/' + DUMMY_CODE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
