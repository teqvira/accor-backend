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
  MOCK = 'mock',
  RAZORPAY = 'razorpay',
  CASHFREE = 'cashfree',
}
