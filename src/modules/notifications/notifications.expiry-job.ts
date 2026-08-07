import { env } from '../../config/env';
import { notificationRepository } from './notifications.repository';
import { notificationsService } from './notifications.service';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function runExpiryNotificationCheck(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const hours = env.NOTIFICATION_EXPIRY_WINDOW_HOURS;
    const [campaigns, coupons] = await Promise.all([
      notificationRepository.findCampaignsExpiringWithinHours(hours),
      notificationRepository.findCouponsExpiringWithinHours(hours),
    ]);

    for (const campaign of campaigns) {
      notificationsService.notifyCampaignExpiry({
        campaignId: campaign.id,
        name: campaign.name,
        endDate: campaign.endDate,
      });
    }

    for (const coupon of coupons) {
      notificationsService.notifyCouponExpiry({
        batchId: coupon.id,
        name: coupon.name,
        endDate: coupon.endDate,
      });
    }

    if (campaigns.length > 0 || coupons.length > 0) {
      console.log(
        `[notifications] Expiry check: ${campaigns.length} campaign(s), ${coupons.length} coupon batch(es)`
      );
    }
  } catch (err) {
    console.error(
      '[notifications] Expiry check failed:',
      err instanceof Error ? err.message : err
    );
  } finally {
    running = false;
  }
}

export function startExpiryNotificationJob(): void {
  if (timer) return;

  // Initial delay so boot is not blocked by DB work
  setTimeout(() => {
    void runExpiryNotificationCheck();
  }, 15_000);

  timer = setInterval(() => {
    void runExpiryNotificationCheck();
  }, env.NOTIFICATION_EXPIRY_CHECK_MS);

  // Allow process to exit in tests / short-lived scripts
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }

  console.log(
    `[notifications] Expiry job started (every ${env.NOTIFICATION_EXPIRY_CHECK_MS}ms, window ${env.NOTIFICATION_EXPIRY_WINDOW_HOURS}h)`
  );
}
