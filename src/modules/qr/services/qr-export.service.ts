import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Response } from 'express';
import { QrExportFormat } from '../constants/qr.constants';
import { qrCodeRepository } from '../repositories/qr-code.repository';
import { buildQrPayload } from './qr-generation.service';

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
  codes: string[]
): Promise<void> {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${batchName.replace(/\s+/g, '_')}_qrs.pdf"`
  );

  const doc = new PDFDocument({ autoFirstPage: false });
  doc.pipe(res);

  const cols = 3;
  const rows = 4;
  const perPage = cols * rows;
  const cellW = 180;
  const cellH = 200;
  const marginX = 30;
  const marginY = 40;

  for (let i = 0; i < codes.length; i++) {
    if (i % perPage === 0) doc.addPage();

    const indexOnPage = i % perPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    const code = codes[i];
    const payload = buildQrPayload(code);
    const pngBuffer = await QRCode.toBuffer(payload, { width: 150, margin: 1 });

    doc.image(pngBuffer, x, y, { width: 120, height: 120 });
    doc.fontSize(8).text(code, x, y + 125, { width: 120, align: 'center' });
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

export async function exportBatchQrCodes(
  res: Response,
  batchName: string,
  batchId: string,
  format: QrExportFormat,
  limit = 1000
): Promise<void> {
  const codes = await qrCodeRepository.findCodesByBatchId(batchId, limit);

  if (codes.length === 0) {
    res.status(404).json({
      success: false,
      message: 'No QR codes found for this batch',
      developerMessage: `exportBatchQrCodes: empty batchId=${batchId}`,
    });
    return;
  }

  switch (format) {
    case 'pdf':
      await streamPdfExport(res, batchName, codes);
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
