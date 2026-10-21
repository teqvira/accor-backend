import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutProviderName } from '../withdrawal.constants';
import { cashfreePayoutService } from './cashfree-payout.provider';
import { decentroPayoutService } from './decentro-payout.provider';
import { manualPayoutService } from './manual-payout.provider';
import { mockPayoutService } from './mock-payout.provider';
import { PayoutProvider } from './payout-provider.types';
import { razorpayPayoutService } from './razorpay-payout.provider';

export function getActivePayoutProvider(): PayoutProviderName {
  return env.PAYOUT_PROVIDER;
}

export function getPayoutProvider(
  provider: PayoutProviderName = env.PAYOUT_PROVIDER
): PayoutProvider {
  switch (provider) {
    case PayoutProviderName.MANUAL:
      return manualPayoutService;
    case PayoutProviderName.MOCK:
      return mockPayoutService;
    case PayoutProviderName.RAZORPAY:
      return razorpayPayoutService;
    case PayoutProviderName.CASHFREE:
      return cashfreePayoutService;
    case PayoutProviderName.DECENTRO:
      return decentroPayoutService;
    default:
      throw new BadRequestError(
        'Payout provider is not supported',
        `Unsupported payout provider: ${provider}`
      );
  }
}

