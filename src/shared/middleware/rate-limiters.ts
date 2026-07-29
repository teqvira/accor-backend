import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/auth routes (50 requests per 15 minutes)',
  },
});

export const redemptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many redemption attempts. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/redemption routes (30 requests per 15 minutes)',
  },
});

export const withdrawLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many withdrawal requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on wallet withdrawal routes (10 requests per 15 minutes)',
  },
});

export const rewardRedeemLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'Too many reward redemption requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on POST /api/rewards/redeem (15 requests per 10 minutes)',
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many upload requests. Please try again later',
    developerMessage:
      'Rate limit exceeded on /api/upload routes (20 requests per 15 minutes)',
  },
});
