/** Cap sticker: 1" × 1". Square sticker: 1.5" × 1" (PDF points @ 72 DPI). */
export const QR_LABEL_SHAPES = ['cap', 'square'] as const;
export type QrLabelShape = (typeof QR_LABEL_SHAPES)[number];

export const QR_LABEL_COLORS = [
  'performance_green',
  'heavy_duty_blue',
  'industrial_bronze',
  'premium_gold',
  'professional_graphite',
  'signature_burgundy',
] as const;
export type QrLabelColor = (typeof QR_LABEL_COLORS)[number];

export const QR_LABEL_COLOR_HEX: Record<QrLabelColor, string> = {
  performance_green: '#0A5C4B',
  heavy_duty_blue: '#1A4F9C',
  industrial_bronze: '#8B5A2B',
  premium_gold: '#C9A227',
  professional_graphite: '#2A3340',
  signature_burgundy: '#6B1F3A',
};

/** Physical label sizes in PDF points (1 pt = 1/72"). */
export const QR_LABEL_DIMENSIONS: Record<
  QrLabelShape,
  { width: number; height: number }
> = {
  cap: { width: 72, height: 72 },
  square: { width: 108, height: 72 },
};

export const QR_LABEL_TAGLINE = "YOUR ENGINE'S BEST FRIEND...";

export const DEFAULT_QR_LABEL_SHAPE: QrLabelShape = 'cap';
export const DEFAULT_QR_LABEL_COLOR: QrLabelColor = 'performance_green';
