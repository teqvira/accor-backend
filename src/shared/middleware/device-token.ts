import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../modules/auth/auth.types';
import {
  DevicePlatform,
  userDeviceTokenRepository,
} from '../../modules/auth/repositories/user-device-token.repository';

const PLATFORMS = new Set<DevicePlatform>(['ios', 'android', 'web', 'unknown']);

function headerString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

function parsePlatform(raw?: string): DevicePlatform {
  if (!raw) return 'unknown';
  const normalized = raw.trim().toLowerCase() as DevicePlatform;
  return PLATFORMS.has(normalized) ? normalized : 'unknown';
}

/**
 * Reads FCM device token from headers (preferred) or JSON body.
 * Attach on every request so authenticated middleware can upsert tokens.
 *
 * Headers:
 *   X-Device-Token   (required for sync)
 *   X-Device-Platform  ios | android | web | unknown
 *   X-Device-Id
 *   X-Device-Name
 *   X-App-Version
 */
export function captureDeviceContext(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const body =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};

  const deviceToken =
    headerString(req.headers['x-device-token']) ??
    (typeof body.deviceToken === 'string' ? body.deviceToken.trim() : undefined);

  if (!deviceToken) {
    next();
    return;
  }

  req.deviceContext = {
    deviceToken,
    platform: parsePlatform(
      headerString(req.headers['x-device-platform']) ??
        (typeof body.platform === 'string' ? body.platform : undefined)
    ),
    deviceId:
      headerString(req.headers['x-device-id']) ??
      (typeof body.deviceId === 'string' ? body.deviceId : undefined),
    deviceName:
      headerString(req.headers['x-device-name']) ??
      (typeof body.deviceName === 'string' ? body.deviceName : undefined),
    appVersion:
      headerString(req.headers['x-app-version']) ??
      (typeof body.appVersion === 'string' ? body.appVersion : undefined),
  };

  next();
}

/**
 * After JWT auth: upsert FCM token when the client sent one.
 * Never fails the request — push registration is best-effort.
 */
export function syncDeviceToken(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const userId = req.user?.sub;
  const ctx = req.deviceContext;

  if (!userId || !ctx?.deviceToken) {
    next();
    return;
  }

  void userDeviceTokenRepository
    .upsert({
      userId,
      deviceToken: ctx.deviceToken,
      platform: ctx.platform,
      deviceId: ctx.deviceId,
      deviceName: ctx.deviceName,
      appVersion: ctx.appVersion,
    })
    .catch((err) => {
      console.error(
        '[device-token] upsert failed:',
        err instanceof Error ? err.message : err
      );
    });

  next();
}
