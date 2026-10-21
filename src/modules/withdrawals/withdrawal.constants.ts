export enum PayoutMethod {
  UPI = 'upi',
  BANK = 'bank',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum PayoutProviderName {
  MANUAL = 'manual',
  MOCK = 'mock',
  RAZORPAY = 'razorpay',
  CASHFREE = 'cashfree',
  DECENTRO = 'decentro',
}

export const WITHDRAWAL_COOLDOWN_DAYS = 7;

