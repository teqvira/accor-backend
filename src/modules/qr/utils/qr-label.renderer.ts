import QRCode from 'qrcode';
import { buildQrPayload } from '../services/qr-generation.service';
import { qrLabelAssetPaths } from './qr-label.paths';

export const QR_LABEL_SIZE = 280;
export const QR_CODE_SIZE = 118;

const GRADIENT_TOP = '#FFFF20';
const GRADIENT_BOTTOM = '#50CC74';
const TEXT_GREEN = '#004D00';

const LOGO_SIZE = 30;
const SIDE_ICON_SIZE = 22;

export interface QrLabelMetadata {
  batchId: string;
  batchName: string;
  productSku?: string;
}

async function createQrImageBuffer(code: string): Promise<Buffer> {
  const payload = buildQrPayload(code);
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: QR_CODE_SIZE,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

function drawGradientCircle(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number
): void {
  doc.save();
  doc.circle(cx, cy, radius).clip();

  const gradient = doc.linearGradient(cx, cy - radius, cx, cy + radius);
  gradient.stop(0, GRADIENT_TOP);
  gradient.stop(1, GRADIENT_BOTTOM);
  doc.circle(cx, cy, radius).fill(gradient);

  doc.restore();
}

export async function drawQrLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  code: string,
  metadata: QrLabelMetadata
): Promise<void> {
  const radius = QR_LABEL_SIZE / 2;
  const cx = x + radius;
  const cy = y + radius;

  drawGradientCircle(doc, cx, cy, radius);

  doc.save();
  doc.circle(cx, cy, radius).clip();

  const logoY = y + 10;
  doc.image(qrLabelAssetPaths.appIcon, cx - LOGO_SIZE / 2, logoY, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });

  doc
    .font('Times-Bold')
    .fontSize(13)
    .fillColor(TEXT_GREEN)
    .text('ACCOR', x, logoY + LOGO_SIZE + 2, { width: QR_LABEL_SIZE, align: 'center' });

  doc
    .font('Helvetica')
    .fontSize(4.5)
    .fillColor(TEXT_GREEN)
    .text('THE COLOR OF INDIA', x, logoY + LOGO_SIZE + 16, {
      width: QR_LABEL_SIZE,
      align: 'center',
    });

  const qrBgPad = 5;
  const qrY = logoY + LOGO_SIZE + 28;
  const qrX = cx - QR_CODE_SIZE / 2;
  const qrBgSize = QR_CODE_SIZE + qrBgPad * 2;

  doc
    .roundedRect(qrX - qrBgPad, qrY - qrBgPad, qrBgSize, qrBgSize, 8)
    .fill('#FFFFFF');

  const qrBuffer = await createQrImageBuffer(code);
  doc.image(qrBuffer, qrX, qrY, { width: QR_CODE_SIZE, height: QR_CODE_SIZE });

  const sideIconY = qrY + 24;
  const sideIconXOffset = QR_CODE_SIZE / 2 + 14;

  doc.image(qrLabelAssetPaths.shieldIcon, cx - sideIconXOffset - SIDE_ICON_SIZE, sideIconY, {
    width: SIDE_ICON_SIZE,
    height: SIDE_ICON_SIZE,
  });
  doc.image(qrLabelAssetPaths.trustIcon, cx + sideIconXOffset, sideIconY, {
    width: SIDE_ICON_SIZE,
    height: SIDE_ICON_SIZE,
  });

  const sideTextWidth = 34;
  const sideTextXLeft = cx - sideIconXOffset - SIDE_ICON_SIZE / 2 - sideTextWidth / 2;
  const sideTextXRight = cx + sideIconXOffset + SIDE_ICON_SIZE / 2 - sideTextWidth / 2;

  doc
    .font('Helvetica-Bold')
    .fontSize(4.5)
    .fillColor(TEXT_GREEN)
    .text('100%', sideTextXLeft, sideIconY + SIDE_ICON_SIZE + 2, {
      width: sideTextWidth,
      align: 'center',
    })
    .text('GENUINE', sideTextXLeft, sideIconY + SIDE_ICON_SIZE + 8, {
      width: sideTextWidth,
      align: 'center',
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(4.5)
    .fillColor(TEXT_GREEN)
    .text('TRUSTED', sideTextXRight, sideIconY + SIDE_ICON_SIZE + 2, {
      width: sideTextWidth,
      align: 'center',
    })
    .text('QUALITY', sideTextXRight, sideIconY + SIDE_ICON_SIZE + 8, {
      width: sideTextWidth,
      align: 'center',
    });

  const bottomY = qrY + QR_CODE_SIZE + 10;

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#000000')
    .text('Scan To Redeem', x, bottomY, { width: QR_LABEL_SIZE, align: 'center' });

  doc
    .font('Helvetica')
    .fontSize(4.5)
    .fillColor('#000000')
    .text('*T&C Applied*', x, bottomY + 10, { width: QR_LABEL_SIZE, align: 'center' });

  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';

  doc
    .font('Helvetica-Bold')
    .fontSize(4)
    .fillColor(TEXT_GREEN)
    .text(`Batch: ${batchLabel}`, x, bottomY + 18, { width: QR_LABEL_SIZE, align: 'center' })
    .text(`SKU: ${skuLabel}`, x, bottomY + 24, { width: QR_LABEL_SIZE, align: 'center' });

  doc.restore();
}
