import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Response } from 'express';
import { QrExportFormat } from '../constants/qr.constants';
import { qrCodeRepository } from '../repositories/qr-code.repository';
import { buildQrPayload } from './qr-generation.service';
import {
  drawQrLabel,
  QR_LABEL_SIZE,
  QrLabelMetadata,
} from '../utils/qr-label.renderer';

async function streamZipExport(
  res: Response,
  batchName: string,
  codes: string[]
): Promise<void> {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${batchName.replace(/\s+/g, '_')}_qrs.zip"`
  );

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.pipe(res);

  for (const code of codes) {
    const payload = buildQrPayload(code);
    const pngBuffer = await QRCode.toBuffer(payload, {
      type: 'png',
      width: 300,
      margin: 1,
    });
    archive.append(pngBuffer, { name: `${code}.png` });
  }

  await archive.finalize();
}

async function streamPdfExport(
  res: Response,
  batchName: string,
  codes: string[],
  metadata: QrLabelMetadata
): Promise<void> {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${batchName.replace(/\s+/g, '_')}_qrs.pdf"`
  );

  const doc = new PDFDocument({ autoFirstPage: false, size: 'LETTER' });
  doc.pipe(res);

  const cols = 2;
  const rows = 2;
  const perPage = cols * rows;
  const marginX = 36;
  const marginY = 48;
  const gapX = 20;
  const gapY = 24;
  const cellW = QR_LABEL_SIZE + gapX;
  const cellH = QR_LABEL_SIZE + gapY;

  for (let i = 0; i < codes.length; i++) {
    if (i % perPage === 0) doc.addPage();

    const indexOnPage = i % perPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    await drawQrLabel(doc, x, y, codes[i], metadata);
  }

  doc.info.Title = `${batchName} QR Codes`;
  doc.end();
}

async function streamPngExport(
  res: Response,
  batchName: string,
  codes: string[]
): Promise<void> {
  if (codes.length === 1) {
    const payload = buildQrPayload(codes[0]);
    const pngBuffer = await QRCode.toBuffer(payload, { width: 400, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${codes[0]}.png"`
    );
    res.send(pngBuffer);
    return;
  }

  await streamZipExport(res, batchName, codes);
}

export interface ExportBatchQrOptions {
  batchName: string;
  batchId: string;
  productSku?: string;
  format: QrExportFormat;
  limit?: number;
}

export async function exportBatchQrCodes(
  res: Response,
  options: ExportBatchQrOptions
): Promise<void> {
  const { batchName, batchId, productSku, format, limit = 1000 } = options;
  const codes = await qrCodeRepository.findCodesByBatchId(batchId, limit);

  if (codes.length === 0) {
    res.status(404).json({
      success: false,
      message: 'No QR codes found for this batch',
      developerMessage: `exportBatchQrCodes: empty batchId=${batchId}`,
    });
    return;
  }

  const labelMetadata: QrLabelMetadata = {
    batchId,
    batchName,
    productSku,
  };

  switch (format) {
    case 'pdf':
      await streamPdfExport(res, batchName, codes, labelMetadata);
      break;
    case 'png':
      await streamPngExport(res, batchName, codes);
      break;
    case 'zip':
    default:
      await streamZipExport(res, batchName, codes);
      break;
  }
}
