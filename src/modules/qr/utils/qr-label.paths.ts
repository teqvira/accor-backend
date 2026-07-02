import path from 'path';

const QR_LABEL_ASSETS_DIR = path.join(process.cwd(), 'assets', 'qr-label');

export const qrLabelAssetPaths = {
  appIcon: path.join(QR_LABEL_ASSETS_DIR, 'appicon.png'),
  shieldIcon: path.join(QR_LABEL_ASSETS_DIR, 'shield-icon.png'),
  trustIcon: path.join(QR_LABEL_ASSETS_DIR, 'trust.png'),
} as const;
