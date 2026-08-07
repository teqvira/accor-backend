import fs from 'fs';
import {
  App,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../../config/env';

export interface FcmPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

let app: App | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    } catch (err) {
      console.error(
        '[FCM] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:',
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) {
    try {
      const raw = fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
      return JSON.parse(raw) as ServiceAccount;
    } catch (err) {
      console.error(
        '[FCM] Failed to read FIREBASE_SERVICE_ACCOUNT_PATH:',
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  return null;
}

function ensureInitialized(): boolean {
  if (app) return true;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return true;
  }

  const account = loadServiceAccount();
  if (!account) {
    console.warn(
      '[FCM] Firebase not configured — push notifications will be skipped. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.'
    );
    return false;
  }

  app = initializeApp({
    credential: cert(account),
  });
  console.log('[FCM] Firebase Admin initialized');
  return true;
}

function toStringData(
  data?: Record<string, string | number | boolean | null | undefined>
): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Send the same notification to many FCM device tokens.
 * Invalid / unregistered tokens are returned so callers can deactivate them.
 */
export async function sendFcmToTokens(
  tokens: string[],
  payload: FcmPushPayload
): Promise<FcmSendResult> {
  const unique = [...new Set(tokens.filter((t) => Boolean(t?.trim())))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  if (!ensureInitialized() || !app) {
    console.log(
      `[DEV] FCM skip (${unique.length} tokens): ${payload.title} — ${payload.body}`
    );
    return {
      successCount: 0,
      failureCount: unique.length,
      invalidTokens: [],
    };
  }

  const invalidTokens: string[] = [];
  let successCount = 0;
  let failureCount = 0;
  const messaging = getMessaging(app);

  // FCM multicast allows up to 500 tokens per call
  const chunkSize = 500;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: toStringData(payload.data),
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((res, idx) => {
      if (res.success) return;
      const code = res.error?.code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(chunk[idx]!);
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
}

export function isFcmConfigured(): boolean {
  return ensureInitialized();
}
