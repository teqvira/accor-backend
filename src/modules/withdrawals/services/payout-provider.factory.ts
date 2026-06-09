import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutProviderName } from '../constants/withdrawal.constants';
import { cashfreePayoutService } from './cashfree-payout.service';
import { mockPayoutService } from './mock-payout.service';
import { PayoutProvider } from './payout-provider.types';
import { razorpayPayoutService } from './razorpay-payout.service';

export function getActivePayoutProvider(): PayoutProviderName {
  return env.PAYOUT_PROVIDER;
}

export function getPayoutProvider(
  provider: PayoutProviderName = env.PAYOUT_PROVIDER
): PayoutProvider {
  switch (provider) {
    case PayoutProviderName.MOCK:
      return mockPayoutService;
    case PayoutProviderName.RAZORPAY:
      return razorpayPayoutService;
    case PayoutProviderName.CASHFREE:
      return cashfreePayoutService;
    default:
      throw new BadRequestError(
        'Payout provider is not supported',
        `Unsupported payout provider: ${provider}`
      );
  }
}
