import QRCode from 'qrcode';
import {
  DEFAULT_QR_LABEL_COLOR,
  DEFAULT_QR_LABEL_SHAPE,
  QR_LABEL_COLOR_HEX,
  QR_LABEL_DIMENSIONS,
  QrLabelColor,
  QrLabelShape
} from '../constants/qr-label.constants';
import { buildQrPayload } from '../services/qr-generation.service';
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
  height: number
): void {
  const radius = Math.min(width, height) * SQUARE_CORNER_RATIO;
  // Static 180deg linear gradient (#0A7A74 -> #0B4D4A) matching Figma for all square coupons
  const grad = doc.linearGradient(x, y, x, y + height);
  grad.stop(0, '#0A7A74');
  grad.stop(1, '#0B4D4A');
  doc.roundedRect(x, y, width, height, radius).fill(grad as unknown as string);
}

function drawWhiteQrPlate(
  doc: PDFKit.PDFDocument,
  qrX: number,
  qrY: number,
  qrSize: number,
  pad: number
): void {
  const bg = qrSize + pad * 2;
  const radius = Math.max(2.5, bg * 0.08);
  doc.roundedRect(qrX - pad, qrY - pad, bg, bg, radius).fill('#FFFFFF');
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
  const brandW = size * 0.36;
  const brandH = size * 0.20;
  const brandY = y + size * 0.035;
  doc.image(qrLabelAssetPaths.rectangleBrandLockup, cx - brandW / 2, brandY, {
    fit: [brandW, brandH],
    align: 'center',
    valign: 'center',
  });

  const qrSize = Math.round(size * 0.42);
  const qrPad = 1.5;
  const plateW = qrSize + qrPad * 2;
  const plateX = cx - plateW / 2;
  const qrX = cx - qrSize / 2;

  // Batch + SKU side-by-side above QR (aligned flush with QR plate left & right edges)
  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  
  const metaY = brandY + brandH + size * 0.025;
  const metaFont = 2.5;
  const textW = plateW * 0.55;

  // Batch ID left-aligned flush with QR plate left edge
  drawText(doc, batchLabel, plateX, metaY, textW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'left',
  });
  // SKU right-aligned flush with QR plate right edge
  drawText(doc, skuLabel, plateX + plateW - textW, metaY, textW, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'right',
  });

  // Vertical gap between header text and top of white QR plate
  const qrY = metaY + metaFont + size * 0.040 + qrPad;

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // Side badges (100% Genuine on left, Trusted Quality on right)
  const gutterW = plateX - x - 1;
  const leftCx = x + (plateX - x) / 2;
  const rightCx = (plateX + plateW) + (x + size - (plateX + plateW)) / 2;
  const iconSize = size * 0.095;
  const sideIconY = qrY + qrSize * 0.12;
  const iconTextGap = 2.5;
  const sideTextY = sideIconY + iconSize + iconTextGap;
  const sideFont = 2.5;

  doc.image(
    qrLabelAssetPaths.trustIcon,
    leftCx - iconSize / 2,
    sideIconY,
    { width: iconSize, height: iconSize }
  );
  doc.image(
    qrLabelAssetPaths.shieldIcon,
    rightCx - iconSize / 2,
    sideIconY,
    { width: iconSize, height: iconSize }
  );

  drawText(doc, '100%\nGENUINE', leftCx - gutterW / 2, sideTextY, gutterW, {
    bold: true,
    fontSize: sideFont,
    color: TEXT_WHITE,
    lineGap: -0.1,
  });
  drawText(doc, 'TRUSTED\nQUALITY', rightCx - gutterW / 2, sideTextY, gutterW, {
    bold: true,
    fontSize: sideFont,
    color: TEXT_WHITE,
    lineGap: -0.1,
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
  metadata: QrLabelMetadata
): Promise<void> {
  const { width, height } = getLabelSize('square');

  fillSquareBackground(doc, x, y, width, height);

  doc.save();
  const clipR = Math.min(width, height) * SQUARE_CORNER_RATIO;
  doc.roundedRect(x, y, width, height, clipR).clip();

  // Left brand (~52%), right QR (~48%) — matches Square QR Design mock
  const leftMargin = 4; // Left padding/gap for brand logo
  const leftW = width * 0.52;
  const rightX = x + leftW;
  const rightW = width - leftW;
  const leftCx = x + leftMargin + (leftW - leftMargin) / 2;

  // Brand lockup image - positioned with left margin
  const brandH = height * 1.1;
  const brandW = (leftW - leftMargin) * 1.1;
  const brandTop = y + (height - brandH) / 2;
  doc.image(qrLabelAssetPaths.rectangleBrandLockup, leftCx - brandW / 2, brandTop, {
    fit: [brandW, brandH],
    align: 'center',
    valign: 'center',
  });

  const qrSize = Math.round(Math.min(rightW * 0.70, height * 0.60));
  const qrPad = 2;
  const plateW = qrSize + qrPad * 2;
  const plateX = rightX + (rightW - plateW) / 2;
  const qrX = plateX + qrPad;

  // Clean Batch & SKU labels matching mockup
  const batchLabel = metadata.batchName || metadata.batchId;
  const rawSku = metadata.productSku ?? 'N/A';
  const skuLabel = rawSku.replace(/^ACC-/i, '');

  const metaFont = 3.4;
  const ctaFont = 3.4;
  const tcFont = 2.2;
  const textWidth = plateW * 0.6; // Prevents text line-wrapping

  // Spacing gaps
  const headerQrGap = 3.0; // Gap between header text bottom and QR plate top
  const qrCtaGap = 4.0;    // Gap between QR plate bottom and Scan To Redeem top
  const ctaTcGap = 2.5;    // Gap between Scan To Redeem text bottom and T&C Applied* top

  // Total height of the right-side content from top of header text to bottom of T&C text
  const contentHeight =
    metaFont +
    headerQrGap +
    plateW +
    qrCtaGap +
    ctaFont +
    ctaTcGap +
    tcFont;

  // Center the right block vertically so top margin above Batch ID == bottom margin below T&C
  const rightBlockTop = y + (height - contentHeight) / 2;

  const metaY = rightBlockTop;
  const qrY = metaY + metaFont + headerQrGap + qrPad;

  // Batch ID left-aligned with QR plate
  drawText(doc, batchLabel, plateX, metaY, textWidth, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'left',
  });
  // SKU right-aligned with QR plate
  drawText(doc, skuLabel, plateX + plateW - textWidth, metaY, textWidth, {
    bold: true,
    fontSize: metaFont,
    color: TEXT_WHITE,
    align: 'right',
  });

  drawWhiteQrPlate(doc, qrX, qrY, qrSize, qrPad);
  const qrBuffer = await createQrImageBuffer(code, qrSize);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // CTA Text ("Scan To Redeem")
  const ctaY = qrY + qrSize + qrPad + qrCtaGap;
  drawText(doc, 'Scan To Redeem', rightX, ctaY, rightW, {
    bold: true,
    fontSize: ctaFont,
    color: TEXT_WHITE,
    align: 'center',
  });

  // T&C Text ("T&C Applied*") - placed right below Scan To Redeem + ctaTcGap
  const tcY = ctaY + ctaFont + ctaTcGap;
  drawText(doc, 'T&C Applied*', rightX, tcY, rightW, {
    fontSize: tcFont,
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
    await drawSquareLabel(doc, x, y, code, metadata);
    return;
  }

  await drawCapLabel(doc, x, y, code, metadata, colorHex);
}

/** @deprecated Use getLabelSize('cap').width — kept for any external imports */
export const QR_LABEL_SIZE = QR_LABEL_DIMENSIONS.cap.width;
export const QR_CODE_SIZE = Math.round(QR_LABEL_DIMENSIONS.cap.width * 0.38);
