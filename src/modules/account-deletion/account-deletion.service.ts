import { env } from '../../config/env';
import { sendOtpSms } from '../../infrastructure/sms/sms.client';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { generateOtp, hashOtp, verifyOtpHash } from '../auth/otp.util';
import { otpVerificationRepository } from '../auth/repositories/otp-verification.repository';
import { refreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import { userDeviceTokenRepository } from '../auth/repositories/user-device-token.repository';
import { userSessionRepository } from '../auth/repositories/user-session.repository';
import { userRepository } from '../auth/repositories/user.repository';
import { IUser, UserRole } from '../auth/user.types';
import { notificationsService } from '../notifications/index';
import { accountDeletionRepository } from './account-deletion.repository';
import {
  AccountDeletionListFilters,
  IAccountDeletionRequest,
} from './account-deletion.types';

const ACCOUNT_DELETION_OTP_PURPOSE = 'account_deletion' as const;
const WEBSITE_HOLD_DAYS = 4;

function resolveOtp(mobileNumber: string): string {
  if (env.TEST_STATIC_OTP) {
    return env.TEST_STATIC_OTP;
  }
  void mobileNumber;
  return generateOtp();
}

function maskMobile(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `+91 ******${digits.slice(-4)}`;
}

function sanitizeRequest(request: IAccountDeletionRequest) {
  return {
    id: request._id,
    userId: request.userId,
    mobileNumber: request.mobileNumber,
    source: request.source,
    status: request.status,
    reason: request.reason ?? null,
    requestedAt: request.requestedAt,
    scheduledFor: request.scheduledFor ?? null,
    processedAt: request.processedAt ?? null,
    cancelledAt: request.cancelledAt ?? null,
    processedBy: request.processedBy ?? null,
    cancelledBy: request.cancelledBy ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user: {
      name: request.userName ?? null,
      email: request.userEmail ?? null,
      isActive: request.userIsActive ?? null,
      deletedAt: request.userDeletedAt ?? null,
    },
  };
}

function assertDeletablePartner(user: IUser, context: string): void {
  if (user.role !== UserRole.USER) {
    throw new BadRequestError(
      'Only partner accounts can be deleted through this flow',
      `${context}: role=${user.role}`
    );
  }
  if (user.deletedAt || !user.isActive) {
    throw new BadRequestError(
      'This account is already deleted or deactivated',
      `${context}: already inactive userId=${user._id}`
    );
  }
}

async function softDeleteUser(userId: string): Promise<void> {
  await userRepository.update(userId, {
    isActive: false,
    deletedAt: new Date(),
  });
  await refreshTokenRepository.revokeManyByUserId(userId);
  await userSessionRepository.closeManyByUserId(userId);
  await userDeviceTokenRepository.deactivateManyByUserId(userId);
}

export class AccountDeletionService {
  /** Mobile app: authenticated user soft-deletes immediately. */
  async deleteFromApp(userId: string, reason?: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `deleteFromApp: userId=${userId}`);
    }

    assertDeletablePartner(user, 'deleteFromApp');

    if (!user.mobileNumber) {
      throw new BadRequestError(
        'Mobile number is required to delete this account',
        `deleteFromApp: missing mobile userId=${userId}`
      );
    }

    await softDeleteUser(userId);
    await accountDeletionRepository.completePendingForUser(userId);

    const request = await accountDeletionRepository.create({
      userId,
      mobileNumber: user.mobileNumber,
      source: 'app',
      status: 'deleted',
      reason: reason ?? null,
      scheduledFor: null,
      processedAt: new Date(),
    });

    notificationsService.notifyAccountDeletion({
      userId,
      requestId: request._id,
      name: user.name,
      mobileNumber: user.mobileNumber,
      source: 'app',
      status: 'deleted',
      scheduledFor: null,
    });

    return {
      deleted: true,
      deletedAt: new Date().toISOString(),
      holdDays: 0,
      request: sanitizeRequest(request),
    };
  }

  /** Public website: send OTP to registered mobile to prove ownership. */
  async sendWebsiteOtp(mobileNumber: string) {
    const user = await userRepository.findByMobile(mobileNumber);
    if (!user || user.role !== UserRole.USER) {
      throw new NotFoundError(
        'No partner account found with this mobile number',
        `sendWebsiteOtp: mobile=${mobileNumber}`
      );
    }

    assertDeletablePartner(user, 'sendWebsiteOtp');

    const pending = await accountDeletionRepository.findPendingByUserId(user._id);
    if (pending) {
      throw new ConflictError(
        'An account deletion request is already pending for this account',
        `sendWebsiteOtp: pending requestId=${pending._id}`
      );
    }

    const purpose = ACCOUNT_DELETION_OTP_PURPOSE;

    if (!env.TEST_STATIC_OTP) {
      const latest = await otpVerificationRepository.findLatest({
        mobileNumber,
        purpose,
      });
      if (latest) {
        const elapsed = Date.now() - latest.createdAt.getTime();
        const cooldown = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
        if (elapsed < cooldown) {
          const waitSeconds = Math.ceil((cooldown - elapsed) / 1000);
          throw new BadRequestError(
            `Please wait ${waitSeconds} seconds before requesting a new OTP`,
            `sendWebsiteOtp: cooldown mobile=${mobileNumber}`
          );
        }
      }
    }

    const otp = resolveOtp(mobileNumber);
    await otpVerificationRepository.invalidateActive({ mobileNumber, purpose });
    await otpVerificationRepository.create({
      mobileNumber,
      otpHash: hashOtp(otp),
      purpose,
      expiresAt: new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000),
    });

    if (env.TEST_STATIC_OTP) {
      console.log(
        `[TEST OTP] account_deletion static OTP for ${mobileNumber}: ${otp} (SMS skipped)`
      );
    } else {
      await sendOtpSms(mobileNumber, otp);
    }

    return {
      mobileNumber: maskMobile(mobileNumber),
      expiresIn: env.OTP_EXPIRES_MINUTES * 60,
      holdDays: WEBSITE_HOLD_DAYS,
    };
  }

  /** Public website: verify OTP and schedule soft-delete after 4 days. */
  async confirmWebsiteDeletion(
    mobileNumber: string,
    otp: string,
    reason?: string
  ) {
    const user = await userRepository.findByMobile(mobileNumber);
    if (!user || user.role !== UserRole.USER) {
      throw new NotFoundError(
        'No partner account found with this mobile number',
        `confirmWebsiteDeletion: mobile=${mobileNumber}`
      );
    }

    assertDeletablePartner(user, 'confirmWebsiteDeletion');

    const pending = await accountDeletionRepository.findPendingByUserId(user._id);
    if (pending) {
      throw new ConflictError(
        'An account deletion request is already pending for this account',
        `confirmWebsiteDeletion: pending requestId=${pending._id}`
      );
    }

    const purpose = ACCOUNT_DELETION_OTP_PURPOSE;
    const otpRecord = await otpVerificationRepository.findLatestActive({
      mobileNumber,
      purpose,
    });

    const staticOtpOk = Boolean(
      env.TEST_STATIC_OTP && otp === env.TEST_STATIC_OTP
    );

    if (!otpRecord && !staticOtpOk) {
      throw new BadRequestError(
        'No OTP request found. Please request a new OTP',
        `confirmWebsiteDeletion: missing otp mobile=${mobileNumber}`
      );
    }

    const otpValid =
      staticOtpOk ||
      (otpRecord ? verifyOtpHash(otp, otpRecord.otpHash) : false);

    if (!otpValid) {
      throw new BadRequestError(
        'Invalid OTP. Please try again',
        `confirmWebsiteDeletion: bad otp mobile=${mobileNumber}`
      );
    }

    if (otpRecord) {
      await otpVerificationRepository.markVerified(otpRecord._id);
    }

    const scheduledFor = new Date(
      Date.now() + WEBSITE_HOLD_DAYS * 24 * 60 * 60 * 1000
    );

    const request = await accountDeletionRepository.create({
      userId: user._id,
      mobileNumber,
      source: 'website',
      status: 'pending',
      reason: reason ?? null,
      scheduledFor,
    });

    notificationsService.notifyAccountDeletion({
      userId: user._id,
      requestId: request._id,
      name: user.name,
      mobileNumber,
      source: 'website',
      status: 'pending',
      scheduledFor,
    });

    return {
      deleted: false,
      holdDays: WEBSITE_HOLD_DAYS,
      scheduledFor: scheduledFor.toISOString(),
      message: `Your account deletion is scheduled. The account will be deactivated in ${WEBSITE_HOLD_DAYS} days.`,
      request: sanitizeRequest(request),
    };
  }

  async listForAdmin(filters: AccountDeletionListFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await accountDeletionRepository.findAll({
      ...filters,
      page,
      limit,
    });
    return {
      items: items.map(sanitizeRequest),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async getByIdForAdmin(id: string) {
    const request = await accountDeletionRepository.findById(id);
    if (!request) {
      throw new NotFoundError(
        'Deletion request not found',
        `getByIdForAdmin: id=${id}`
      );
    }
    return sanitizeRequest(request);
  }

  /** Admin: cancel a pending website hold. */
  async cancelRequest(id: string, adminId: string) {
    const existing = await accountDeletionRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(
        'Deletion request not found',
        `cancelRequest: id=${id}`
      );
    }
    if (existing.status !== 'pending') {
      throw new BadRequestError(
        'Only pending deletion requests can be cancelled',
        `cancelRequest: status=${existing.status} id=${id}`
      );
    }

    const cancelled = await accountDeletionRepository.markCancelled(id, adminId);
    if (!cancelled) {
      throw new ConflictError(
        'Deletion request could not be cancelled',
        `cancelRequest: race id=${id}`
      );
    }

    const fresh = await accountDeletionRepository.findById(id);
    return sanitizeRequest(fresh!);
  }

  /** Admin: process a pending request immediately (soft-delete now). */
  async processRequestNow(id: string, adminId: string) {
    const existing = await accountDeletionRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(
        'Deletion request not found',
        `processRequestNow: id=${id}`
      );
    }
    if (existing.status !== 'pending') {
      throw new BadRequestError(
        'Only pending deletion requests can be processed',
        `processRequestNow: status=${existing.status} id=${id}`
      );
    }

    const user = await userRepository.findById(existing.userId);
    if (!user) {
      throw new NotFoundError(
        'User not found',
        `processRequestNow: userId=${existing.userId}`
      );
    }

    if (!user.deletedAt) {
      await softDeleteUser(existing.userId);
    }

    const completed = await accountDeletionRepository.markCompleted(id, adminId);
    if (!completed) {
      throw new ConflictError(
        'Deletion request could not be processed',
        `processRequestNow: race id=${id}`
      );
    }

    const fresh = await accountDeletionRepository.findById(id);
    return sanitizeRequest(fresh!);
  }

  /** Background job: complete website holds whose scheduled_for has passed. */
  async processDueRequests(): Promise<number> {
    const due = await accountDeletionRepository.findDuePending(50);
    let processed = 0;

    for (const request of due) {
      try {
        const user = await userRepository.findById(request.userId);
        if (user && !user.deletedAt) {
          await softDeleteUser(request.userId);
        }
        const completed = await accountDeletionRepository.markCompleted(
          request._id
        );
        if (completed) processed += 1;
      } catch (err) {
        console.error(
          `[account-deletion] Failed to process request ${request._id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return processed;
  }
}

export const accountDeletionService = new AccountDeletionService();
