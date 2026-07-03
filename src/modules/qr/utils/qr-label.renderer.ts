import QRCode from 'qrcode';
import { buildQrPayload } from '../services/qr-generation.service';
import { qrLabelAssetPaths } from './qr-label.paths';

export const QR_LABEL_SIZE = 136;
export const QR_CODE_SIZE = 60;

const GRADIENT_TOP = '#FFFF20';
const GRADIENT_BOTTOM = '#50CC74';
const TEXT_GREEN = '#004D00';

const LOGO_SIZE = 35;
const SIDE_ICON_SIZE = 12;
const META_FONT_SIZE = 4;
const BODY_FONT_SIZE = 5;
const BODY_LINE = 5;
const QR_BG_PAD = 3;
const QR_TO_SCAN_GAP = 9;

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
  } = {}
): void {
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.fontSize ?? BODY_FONT_SIZE)
    .fillColor(options.color ?? TEXT_GREEN)
    .text(text, leftX, topY, { width, align: options.align ?? 'center' });
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
  const circleCy = y + radius;

  drawGradientCircle(doc, cx, circleCy, radius);

  doc.save();
  doc.circle(cx, circleCy, radius).clip();

  const qrX = cx - QR_CODE_SIZE / 2;
  const leftGutterCx = x + (qrX - x) / 2;
  const rightGutterCx = qrX + QR_CODE_SIZE + (x + QR_LABEL_SIZE - qrX - QR_CODE_SIZE) / 2;
  const gutterWidth = 28;

  // ── Logo (35×35) ──────────────────────────────────────────────────────────
  const logoY = y + 3;
  doc.image(qrLabelAssetPaths.appIcon, cx - LOGO_SIZE / 2, logoY, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });

  // ── QR (60×60) — main anchor, placed right below logo ─────────────────────
  const qrY = logoY + LOGO_SIZE + 2;
  const qrBgSize = QR_CODE_SIZE + QR_BG_PAD * 2;

  doc
    .roundedRect(qrX - QR_BG_PAD, qrY - QR_BG_PAD, qrBgSize, qrBgSize, 4)
    .fill('#FFFFFF');

  const qrBuffer = await createQrImageBuffer(code);
  doc.image(qrBuffer, qrX, qrY, { width: QR_CODE_SIZE, height: QR_CODE_SIZE });

  // ── Batch / SKU — smaller text, flanking top of QR in side gutters ────────
  const batchLabel = metadata.batchName || metadata.batchId;
  const skuLabel = metadata.productSku ?? 'N/A';
  const metaY = qrY + 2;

  drawText(doc, batchLabel, leftGutterCx - gutterWidth / 2, metaY, gutterWidth, {
    bold: true,
    fontSize: META_FONT_SIZE,
  });
  drawText(doc, skuLabel, rightGutterCx - gutterWidth / 2, metaY, gutterWidth, {
    bold: true,
    fontSize: META_FONT_SIZE,
  });

  // ── Side shields + labels — in gutters, lower half beside QR ──────────────
  const sideIconY = qrY + 20;
  const sideTextY = sideIconY + SIDE_ICON_SIZE + 1;
  const sideTextWidth = 26;

  doc.image(
    qrLabelAssetPaths.shieldIcon,
    leftGutterCx - SIDE_ICON_SIZE / 2,
    sideIconY,
    { width: SIDE_ICON_SIZE, height: SIDE_ICON_SIZE }
  );
  doc.image(
    qrLabelAssetPaths.trustIcon,
    rightGutterCx - SIDE_ICON_SIZE / 2,
    sideIconY,
    { width: SIDE_ICON_SIZE, height: SIDE_ICON_SIZE }
  );

  drawText(doc, '100%', leftGutterCx - sideTextWidth / 2, sideTextY, sideTextWidth, {
    bold: true,
    fontSize: BODY_FONT_SIZE,
  });
  drawText(doc, 'GENUINE', leftGutterCx - sideTextWidth / 2, sideTextY + BODY_LINE, sideTextWidth, {
    bold: true,
    fontSize: BODY_FONT_SIZE,
  });

  drawText(doc, 'TRUSTED', rightGutterCx - sideTextWidth / 2, sideTextY, sideTextWidth, {
    bold: true,
    fontSize: BODY_FONT_SIZE,
  });
  drawText(doc, 'QUALITY', rightGutterCx - sideTextWidth / 2, sideTextY + BODY_LINE, sideTextWidth, {
    bold: true,
    fontSize: BODY_FONT_SIZE,
  });

  // ── Bottom CTA — gap measured from white QR border, not QR image edge ─────
  const bottomY = qrY + QR_CODE_SIZE + QR_BG_PAD + QR_TO_SCAN_GAP;
  const bottomWidth = QR_LABEL_SIZE - 24;

  drawText(doc, 'Scan To Redeem', cx - bottomWidth / 2, bottomY, bottomWidth, {
    bold: true,
    color: '#000000',
    fontSize: BODY_FONT_SIZE,
  });
  drawText(doc, '*T&C Applied*', cx - bottomWidth / 2, bottomY + BODY_LINE + 1, bottomWidth, {
    color: '#000000',
    fontSize: META_FONT_SIZE,
  });

  doc.restore();
}
