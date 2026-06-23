import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../../config/env';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/utils/errors';
import { isPgUniqueViolation } from '../../../shared/utils/postgres';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { userRepository } from '../repositories/user.repository';
import { JwtAccessPayload } from '../types/auth.types';
import { IUser, UserRole } from '../types/user.types';
import { sendOtpEmail } from './email.service';
import { sendOtpSms } from './sms.service';
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '../utils/jwt.util';
import { generateOtp, hashOtp, verifyOtpHash } from '../utils/otp.util';

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3,
};

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

function canAssignRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[creatorRole] > ROLE_RANK[targetRole];
}

function sanitizeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    walletBalance: user.walletBalance,
    rewardPoints: user.rewardPoints,
    createdAt: user.createdAt,
  };
}

async function hashRefreshToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(user: IUser) {
  const tokenId = uuidv4();
  const accessToken = signAccessToken({
    sub: user._id,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    sub: user._id,
    tokenId,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await refreshTokenRepository.create({
    userId: user._id,
    tokenHash: await hashRefreshToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

async function setUserOtp(userId: string, otp: string): Promise<void> {
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(
    Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000
  );
  const otpLastSentAt = new Date();
  await userRepository.updateOtp(userId, otpHash, otpExpiresAt, otpLastSentAt);
}

function assertOtpResendAllowed(user: IUser): void {
  if (!user.otpLastSentAt) return;
  const elapsed = Date.now() - user.otpLastSentAt.getTime();
  const cooldown = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
  if (elapsed < cooldown) {
    const waitSeconds = Math.ceil((cooldown - elapsed) / 1000);
    throw new BadRequestError(
      `Please wait ${waitSeconds} seconds before requesting a new OTP`,
      `OTP resend cooldown active for userId=${user._id}`
    );
  }
}

export class AuthService {
  async createUser(
    creator: JwtAccessPayload,
    input: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }
  ) {
    if (!canAssignRole(creator.role, input.role)) {
      throw new ForbiddenError(
        'You cannot create a user with this role',
        `Role assignment denied: creatorRole=${creator.role}, targetRole=${input.role}`
      );
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists',
        `createUser: duplicate email=${input.email}`
      );
    }

    const hashed = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashed,
      role: input.role,
      isVerified: true,
    });

    return sanitizeUser(user);
  }

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email, { includePassword: true });
    if (!user) {
      throw new UnauthorizedError(
        'Invalid email or password',
        `login: no user found for email=${email}`
      );
    }

    if (!ADMIN_ROLES.includes(user.role)) {
      throw new UnauthorizedError(
        'Invalid email or password',
        `login: non-admin role attempted email login role=${user.role}`
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support',
        `login: inactive user userId=${user._id}`
      );
    }

    const valid = await bcrypt.compare(password, user.password ?? '');
    if (!valid) {
      throw new UnauthorizedError(
        'Invalid email or password',
        `login: password mismatch for userId=${user._id}`
      );
    }

    const tokens = await issueTokenPair(user);
    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  }

  private async assertLoggedInMobileMatch(
    mobileNumber: string,
    loggedInUserId?: string
  ): Promise<void> {
    if (!loggedInUserId) return;

    const loggedInUser = await userRepository.findById(loggedInUserId);
    if (
      loggedInUser?.mobileNumber &&
      loggedInUser.mobileNumber !== mobileNumber
    ) {
      throw new BadRequestError(
        'You can only use your registered mobile number',
        `assertLoggedInMobileMatch: userId=${loggedInUserId}`
      );
    }
  }

  async sendMobileOtp(mobileNumber: string, loggedInUserId?: string) {
    await this.assertLoggedInMobileMatch(mobileNumber, loggedInUserId);
    let user = await userRepository.findByMobile(mobileNumber, {
      includeOtp: true,
    });

    if (!user) {
      try {
        const created = await userRepository.create({
          mobileNumber,
          role: UserRole.USER,
          name: `User ${mobileNumber.slice(-4)}`,
        });
        user = await userRepository.findByMobile(mobileNumber, {
          includeOtp: true,
        });
        if (!user) {
          user = created;
        }
      } catch (err: unknown) {
        if (!isPgUniqueViolation(err)) {
          throw err;
        }
        user = await userRepository.findByMobile(mobileNumber, {
          includeOtp: true,
        });
      }
    }

    if (!user) {
      throw new BadRequestError(
        'Unable to process request',
        'sendMobileOtp: user creation failed'
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support',
        `sendMobileOtp: inactive user userId=${user._id}`
      );
    }

    assertOtpResendAllowed(user);

    const otp = generateOtp();
    await setUserOtp(user._id, otp);
    await sendOtpSms(mobileNumber, otp);

    return { message: 'OTP sent successfully' };
  }

  async resendMobileOtp(mobileNumber: string, loggedInUserId?: string) {
    return this.sendMobileOtp(mobileNumber, loggedInUserId);
  }

  async verifyMobileOtp(
    mobileNumber: string,
    otp: string,
    loggedInUserId?: string
  ) {
    await this.assertLoggedInMobileMatch(mobileNumber, loggedInUserId);
    const user = await userRepository.findByMobile(mobileNumber, {
      includeOtp: true,
    });

    if (!user?.otpHash || !user.otpExpiresAt) {
      throw new BadRequestError(
        'No OTP request found. Please request a new OTP',
        `verifyMobileOtp: missing otp for mobile=${mobileNumber}`
      );
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestError(
        'Your OTP has expired. Please request a new one',
        `verifyMobileOtp: OTP expired for userId=${user._id}`
      );
    }

    if (!verifyOtpHash(otp, user.otpHash)) {
      throw new BadRequestError(
        'The OTP you entered is incorrect',
        `verifyMobileOtp: OTP mismatch for userId=${user._id}`
      );
    }

    const verifiedUser = await userRepository.clearOtpAndVerify(user._id);
    if (!verifiedUser) {
      throw new BadRequestError(
        'Unable to process request',
        `verifyMobileOtp: user not found userId=${user._id}`
      );
    }

    const tokens = await issueTokenPair(verifiedUser);
    return {
      user: sanitizeUser(verifiedUser),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      throw new UnauthorizedError(
        'Your session is invalid. Please log in again',
        `refreshToken: JWT verification failed — ${detail}`
      );
    }

    const tokenHash = await hashRefreshToken(refreshToken);
    const stored = await refreshTokenRepository.findByUserAndHash(
      payload.sub,
      tokenHash
    );

    if (!stored) {
      throw new UnauthorizedError(
        'Your session has expired. Please log in again',
        `refreshToken: token not found in DB for userId=${payload.sub}`
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError(
        'Your session has expired. Please log in again',
        `refreshToken: token expired at ${stored.expiresAt.toISOString()} for userId=${payload.sub}`
      );
    }

    await refreshTokenRepository.deleteById(stored._id);

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError(
        'Your session is invalid. Please log in again',
        `refreshToken: user not found userId=${payload.sub}`
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support',
        `refreshToken: inactive user userId=${user._id}`
      );
    }

    return issueTokenPair(user);
  }

  async logout(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const tokenHash = await hashRefreshToken(refreshToken);
      await refreshTokenRepository.deleteByUserAndHash(payload.sub, tokenHash);
    } catch {
      // ignore invalid tokens on logout
    }
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' };
    }

    const otp = generateOtp();
    await setUserOtp(user._id, otp);
    if (user.email) {
      await sendOtpEmail(user.email, otp);
    }

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async verifyPasswordOtp(email: string, otp: string) {
    const user = await userRepository.findByEmail(email, { includeOtp: true });

    if (!user?.otpHash || !user.otpExpiresAt) {
      throw new BadRequestError(
        'No password reset request found. Please request a new OTP',
        `verifyPasswordOtp: missing otpHash or otpExpiresAt for email=${email}`
      );
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestError(
        'Your OTP has expired. Please request a new one',
        `verifyPasswordOtp: OTP expired at ${user.otpExpiresAt.toISOString()} for userId=${user._id}`
      );
    }

    if (!verifyOtpHash(otp, user.otpHash)) {
      throw new BadRequestError(
        'The OTP you entered is incorrect',
        `verifyPasswordOtp: OTP hash mismatch for userId=${user._id}`
      );
    }

    await userRepository.clearOtp(user._id);

    const resetToken = signResetToken({
      sub: user._id,
      purpose: 'password-reset',
    });

    return { resetToken, expiresIn: env.JWT_RESET_EXPIRES_IN };
  }

  async resetPasswordWithToken(resetToken: string, newPassword: string) {
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      throw new BadRequestError(
        'Your reset link is invalid or has expired',
        `resetPasswordWithToken: JWT verification failed — ${detail}`
      );
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw new NotFoundError(
        'Account not found',
        `resetPasswordWithToken: user not found userId=${payload.sub}`
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(user._id, hashed);
    await refreshTokenRepository.deleteManyByUserId(user._id);

    return { message: 'Password reset successfully' };
  }

  async resetPasswordWithCurrent(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await userRepository.findById(userId, { includePassword: true });
    if (!user) {
      throw new NotFoundError(
        'Account not found',
        `resetPasswordWithCurrent: user not found userId=${userId}`
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.password ?? '');
    if (!valid) {
      throw new UnauthorizedError(
        'Your current password is incorrect',
        `resetPasswordWithCurrent: current password mismatch for userId=${userId}`
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(user._id, hashed);
    await refreshTokenRepository.deleteManyByUserId(user._id);

    return { message: 'Password updated successfully' };
  }
}

export const authService = new AuthService();
