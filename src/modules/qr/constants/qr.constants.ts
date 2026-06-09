export const QR_EXPORT_FORMATS = ['png', 'pdf', 'zip'] as const;
export type QrExportFormat = (typeof QR_EXPORT_FORMATS)[number];
