import { QR_EXPORT_FORMATS, QrExportFormat } from '../constants/qr.constants';

function isQrExportFormat(value: string): value is QrExportFormat {
  return (QR_EXPORT_FORMATS as readonly string[]).includes(value);
}

export function parseQrExportFormat(value: unknown): QrExportFormat {
  if (typeof value === 'string' && isQrExportFormat(value)) {
    return value;
  }
  return 'zip';
}
