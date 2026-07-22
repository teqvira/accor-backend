import QRCode from 'qrcode';
import { buildQrPayload } from '../services/qr-generation.service';
import {
  DEFAULT_QR_LABEL_COLOR,
  DEFAULT_QR_LABEL_SHAPE,
  QR_LABEL_COLOR_HEX,
  QR_LABEL_DIMENSIONS,
  QrLabelColor,
  QrLabelShape,
} from '../constants/qr-label.constants';
import { qrLabelAssetPaths } from './qr-label.paths';

const TEXT_WHITE = '#FFFFFF';
const QR_DARK = '#000000';
const QR_LIGHT = '#FFFFFF';
/** Square (1.5"×1") corner radius — reduced for sleeker, modern rounded corners. */
const SQUARE_CORNER_RATIO = 0.07;

export interface QrLabelMetadata {
  batchId: string;
  batchName: string;
  productSku?: string;
  shape?: QrLabelShape;
  color?: QrLabelColor;
}

export function getLabelSize(shape: QrLabelShape): {
  width: number;
  height: number;
} {
  return QR_LABEL_DIMENSIONS[shape];
}

async function createQrImageBuffer(code: string, size: number): Promise<Buffer> {
  const payload = buildQrPayload(code);
  // Render at 4× then scale down in PDF for a sharp, non-faded QR
  const px = Math.max(128, Math.round(size * 4));
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: px,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: QR_DARK,
      light: QR_LIGHT,
    },
  });
}

function drawText(
  doc: PDFKit.PDFDocument,
  text: string,
  leftX: number,
  topY: number,
  width: number,
  options: {
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    color?: string;
    fontSize?: number;
    lineGap?: number;
  } = {}
): void {
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.fontSize ?? 4)
    .fillColor(options.color ?? TEXT_WHITE)
    .text(text, leftX, topY, {
      width,
      align: options.align ?? 'center',
      lineGap: options.lineGap ?? 0,
    });
}

function fillCapBackground(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number,
  colorHex: string
): void {
  doc.circle(cx, cy, radius).fill(colorHex);
}

function fillSquareBackground(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  colorHex: string
): void {
  const radius = Math.min(width, height) * SQUARE_CORNER_RATIO;
  doc.roundedRect(x, y, width, height, radius).fill(colorHex);
}

function drawWhiteQrPlate(
  doc: PDFKit.PDFDocument,
  qrX: number,
  qrY: number,
  qrSize: number,
  pad: number
): void {
  const bg = qrSize + pad * 2;
  doc.roundedRect(qrX - pad, qrY - pad, bg, bg, Math.max(1.5, pad * 0.6)).fill('#FFFFFF');
}

async function drawCapLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  code: string,
  metadata: QrLabelMetadata,
  colorHex: string
): Promise<void> {
  const { width: size } = getLabelSize('cap');
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  fillCapBackground(doc, cx, cy, radius, colorHex);

  doc.save();
  doc.circle(cx, cy, radius).clip();

  // Full ACCOR brand lockup at the top of the cap
  const brandW = size * 0.32;
  const brandH = size * 0.20;
  const brandY = y + size * 0.035;
  doc.image(qrLabelAssetPaths.rectangleBrandLockup, cx - brandW / 2, brandY, {
    fit: [brandW, brandH],
    align: 'center',
    valign: 'center',
  });

  const qrSize = Math.round(size * 0.38);
  const qrPad = 1.5;
  const plateW = qrSize + qrPad * 2;
  const plateX = cx - plateW / 2;
  const qrX = cx - qrSize / 2;

  // Batch + SKU side-by-side above QR
  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  // Margin bottom below logo lockup
  const metaY = brandY + brandH + size * 0.05;
  const metaFont = 2.8;
  const metaW = plateW / 2 + 5; // Extra width to prevent wrapping long SKU text (e.g. ACC-20W80)

  drawText(doc, batchLabel, plateX - 2, metaY, metaW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'left',
  });
  drawText(doc, skuLabel, plateX + plateW / 2 - 3, metaY, metaW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'right',
  });

  // Vertical gap between header text and top of white QR plate
  const qrY = metaY + metaFont + size * 0.045;

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // Side badges (100% Genuine on left, Trusted Quality on right)
  const gutterW = plateX - x - 1;
  const leftCx = x + (plateX - x) / 2;
  const rightCx = (plateX + plateW) + (x + size - (plateX + plateW)) / 2;
  const iconSize = size * 0.095;
  const sideIconY = qrY + qrSize * 0.18;
  const sideTextY = sideIconY + iconSize + 0.8;
  const sideFont = 2.5;

  doc.image(
    qrLabelAssetPaths.shieldIcon,
    leftCx - iconSize / 2,
    sideIconY,
    { width: iconSize, height: iconSize }
  );
  doc.image(
    qrLabelAssetPaths.trustIcon,
    rightCx - iconSize / 2,
    sideIconY,
    { width: iconSize, height: iconSize }
  );

  drawText(doc, '100%\nGENUINE', leftCx - gutterW / 2, sideTextY, gutterW, {
    bold: true,
    fontSize: sideFont,
    color: TEXT_WHITE,
    lineGap: -0.5,
  });
  drawText(doc, 'TRUSTED\nQUALITY', rightCx - gutterW / 2, sideTextY, gutterW, {
    bold: true,
    fontSize: sideFont,
    color: TEXT_WHITE,
    lineGap: -0.5,
  });

  // Bottom CTA text with generous gap below QR plate matching Figma
  const ctaY = qrY + qrSize + qrPad + size * 0.055;
  drawText(doc, 'Scan To Redeem', x + 4, ctaY, size - 8, {
    bold: true,
    fontSize: 3.5,
    color: TEXT_WHITE,
    align: 'center',
  });
  drawText(doc, 'T&C Applied*', x + 4, ctaY + 4.2, size - 8, {
    fontSize: 2.2,
    color: TEXT_WHITE,
    align: 'center',
  });

  doc.restore();
}

async function drawSquareLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  code: string,
  metadata: QrLabelMetadata,
  colorHex: string
): Promise<void> {
  const { width, height } = getLabelSize('square');

  fillSquareBackground(doc, x, y, width, height, colorHex);

  doc.save();
  const clipR = Math.min(width, height) * SQUARE_CORNER_RATIO;
  doc.roundedRect(x, y, width, height, clipR).clip();

  // Left brand (~46%), right QR (~54%) — matches Square QR Design mock
  const leftW = width * 0.46;
  const rightX = x + leftW;
  const rightW = width - leftW;
  const leftCx = x + leftW / 2;

  // Full lockup from rectnagle-img-logo.png (logo + ACCOR + tagline already in image)
  const brandH = height * 0.78;
  const brandW = leftW * 0.72;
  const brandTop = y + (height - brandH) / 2;
  doc.image(qrLabelAssetPaths.rectangleBrandLockup, leftCx - brandW / 2, brandTop, {
    fit: [brandW, brandH],
    align: 'center',
    valign: 'center',
  });

  const qrSize = Math.round(Math.min(rightW * 0.58, height * 0.5));
  const qrPad = 2;
  const plateW = qrSize + qrPad * 2;
  const plateX = rightX + (rightW - plateW) / 2;
  const qrX = plateX + qrPad;

  // Batch + SKU side-by-side above QR (aligned with QR plate left & right edges)
  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  const metaY = y + height * 0.06;
  const metaFont = 3.4;
  const halfMetaW = plateW / 2;

  drawText(doc, batchLabel, plateX, metaY, halfMetaW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'left',
  });
  drawText(doc, skuLabel, plateX + halfMetaW, metaY, halfMetaW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'right',
  });

  // Gap between text and top of QR plate
  const qrY = metaY + metaFont + height * 0.08;

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // Gap between bottom of QR plate and CTA text
  const ctaY = qrY + qrSize + qrPad + height * 0.05;
  drawText(doc, 'Scan To Redeem', rightX, ctaY, rightW, {
    bold: true,
    fontSize: 3.4,
    color: TEXT_WHITE,
    align: 'center',
  });
  drawText(doc, 'T&C Applied*', rightX, ctaY + 4.2, rightW, {
    fontSize: 2.2,
    color: TEXT_WHITE,
    align: 'center',
  });

  doc.restore();
}

export async function drawQrLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  code: string,
  metadata: QrLabelMetadata
): Promise<void> {
  const shape = metadata.shape ?? DEFAULT_QR_LABEL_SHAPE;
  const colorKey = metadata.color ?? DEFAULT_QR_LABEL_COLOR;
  const colorHex = QR_LABEL_COLOR_HEX[colorKey];

  if (shape === 'square') {
    await drawSquareLabel(doc, x, y, code, metadata, colorHex);
    return;
  }

  await drawCapLabel(doc, x, y, code, metadata, colorHex);
}

/** @deprecated Use getLabelSize('cap').width — kept for any external imports */
export const QR_LABEL_SIZE = QR_LABEL_DIMENSIONS.cap.width;
export const QR_CODE_SIZE = Math.round(QR_LABEL_DIMENSIONS.cap.width * 0.38);
