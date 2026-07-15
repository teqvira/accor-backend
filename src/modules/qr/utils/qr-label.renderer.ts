import QRCode from 'qrcode';
import { buildQrPayload } from '../services/qr-generation.service';
import {
  DEFAULT_QR_LABEL_COLOR,
  DEFAULT_QR_LABEL_SHAPE,
  QR_LABEL_COLOR_HEX,
  QR_LABEL_DIMENSIONS,
  QR_LABEL_TAGLINE,
  QrLabelColor,
  QrLabelShape,
} from '../constants/qr-label.constants';
import { qrLabelAssetPaths } from './qr-label.paths';

const TEXT_WHITE = '#FFFFFF';
const QR_DARK = '#000000';
const QR_LIGHT = '#FFFFFF';

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
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: size,
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
  const radius = Math.min(width, height) * 0.08;
  doc.roundedRect(x, y, width, height, radius).fill(colorHex);
}

function drawAccorMark(
  doc: PDFKit.PDFDocument,
  cx: number,
  topY: number,
  markHeight: number
): void {
  const iconSize = markHeight * 0.55;
  doc.image(qrLabelAssetPaths.appIcon, cx - iconSize / 2, topY, {
    width: iconSize,
    height: iconSize,
  });
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

  // Proportions tuned to the 1" Cap design mock
  const logoSize = size * 0.22;
  const logoY = y + size * 0.04;
  doc.image(qrLabelAssetPaths.appIcon, cx - logoSize / 2, logoY, {
    width: logoSize,
    height: logoSize,
  });

  const metaFont = 3.2;
  const metaY = logoY + logoSize + size * 0.01;
  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  drawText(doc, `${batchLabel}   ${skuLabel}`, x + 4, metaY, size - 8, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
  });

  const qrSize = Math.round(size * 0.38);
  const qrPad = size * 0.025;
  const qrX = cx - qrSize / 2;
  const qrY = metaY + metaFont + size * 0.02;

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  const gutterW = (qrX - x) * 0.9;
  const leftCx = x + (qrX - x) / 2;
  const rightCx = qrX + qrSize + (x + size - qrX - qrSize) / 2;
  const iconSize = size * 0.09;
  const sideIconY = qrY + qrSize * 0.22;
  const sideTextY = sideIconY + iconSize + 0.5;
  const sideFont = 2.8;

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

  const ctaY = qrY + qrSize + qrPad + size * 0.035;
  drawText(doc, 'Scan To Redeem', x + 6, ctaY, size - 12, {
    bold: true,
    fontSize: 3.6,
    color: TEXT_WHITE,
  });
  drawText(doc, 'T&C Applied*', x + 6, ctaY + 4.2, size - 12, {
    fontSize: 2.4,
    color: TEXT_WHITE,
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
  const clipR = Math.min(width, height) * 0.08;
  doc.roundedRect(x, y, width, height, clipR).clip();

  // Left brand column (~42%), right QR column (~58%) — matches Square QR Design
  const leftW = width * 0.42;
  const rightX = x + leftW;
  const rightW = width - leftW;

  const logoH = height * 0.55;
  const logoTop = y + height * 0.08;
  drawAccorMark(doc, x + leftW / 2, logoTop, logoH);

  const taglineY = logoTop + logoH + 1;
  drawText(doc, QR_LABEL_TAGLINE, x + 3, taglineY, leftW - 6, {
    bold: true,
    fontSize: 2.6,
    color: TEXT_WHITE,
  });

  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  const metaY = y + height * 0.06;
  drawText(doc, `${batchLabel}   ${skuLabel}`, rightX, metaY, rightW - 4, {
    bold: true,
    fontSize: 3.2,
    color: TEXT_WHITE,
    align: 'center',
  });

  const qrSize = Math.round(Math.min(rightW * 0.62, height * 0.52));
  const qrPad = 1.8;
  const qrX = rightX + (rightW - qrSize) / 2 - 1;
  const qrY = metaY + 5;

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  const ctaY = qrY + qrSize + qrPad + 2;
  drawText(doc, 'Scan To Redeem', rightX, ctaY, rightW - 4, {
    bold: true,
    fontSize: 3.4,
    color: TEXT_WHITE,
    align: 'center',
  });
  drawText(doc, 'T&C Applied*', rightX, ctaY + 4, rightW - 6, {
    fontSize: 2.2,
    color: TEXT_WHITE,
    align: 'right',
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
