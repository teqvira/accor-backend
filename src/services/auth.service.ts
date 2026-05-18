import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { RefreshToken } from '../models/RefreshToken';
import { IUser, User, UserRole } from '../models/User';
import { JwtAccessPayload } from '../types';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors';
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '../utils/jwt';
import { generateOtp, hashOtp, verifyOtpHash } from '../utils/otp';
import { sendOtpEmail } from './email.service';

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.MODERATOR]: 2,
  [UserRole.ADMIN]: 3,
};

function canAssignRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[creatorRole] > ROLE_RANK[targetRole];
}

function sanitizeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function hashRefreshToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(user: IUser) {
  const tokenId = new Types.ObjectId().toString();
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    tokenId,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: await hashRefreshToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken };
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

    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists',
        `createUser: duplicate email=${input.email}`
      );
    }

    const hashed = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      name: input.name,
      email: input.email,
      password: hashed,
      role: input.role,
    });

    return sanitizeUser(user);
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new UnauthorizedError(
        'Invalid email or password',
        `login: no user found for email=${email}`
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support',
        `login: inactive user userId=${user._id}`
      );
    }

    const valid = await bcrypt.compare(password, user.password);
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
    const stored = await RefreshToken.findOne({
      userId: payload.sub,
      tokenHash,
    });

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

    await RefreshToken.deleteOne({ _id: stored._id });

    const user = await User.findById(payload.sub);
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
      await RefreshToken.deleteOne({ userId: payload.sub, tokenHash });
    } catch {
      // ignore invalid tokens on logout
    }
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(
      Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000
    );

    user.otpHash = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await sendOtpEmail(user.email, otp);

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await User.findOne({ email })
      .select('+otpHash +otpExpiresAt');

    if (!user?.otpHash || !user.otpExpiresAt) {
      throw new BadRequestError(
        'No password reset request found. Please request a new OTP',
        `verifyOtp: missing otpHash or otpExpiresAt for email=${email}`
      );
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestError(
        'Your OTP has expired. Please request a new one',
        `verifyOtp: OTP expired at ${user.otpExpiresAt.toISOString()} for userId=${user._id}`
      );
    }

    if (!verifyOtpHash(otp, user.otpHash)) {
      throw new BadRequestError(
        'The OTP you entered is incorrect',
        `verifyOtp: OTP hash mismatch for userId=${user._id}`
      );
    }

    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const resetToken = signResetToken({
      sub: user._id.toString(),
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

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new NotFoundError(
        'Account not found',
        `resetPasswordWithToken: user not found userId=${payload.sub}`
      );
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });

    return { message: 'Password reset successfully' };
  }

  async resetPasswordWithCurrent(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError(
        'Account not found',
        `resetPasswordWithCurrent: user not found userId=${userId}`
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedError(
        'Your current password is incorrect',
        `resetPasswordWithCurrent: current password mismatch for userId=${userId}`
      );
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });

    return { message: 'Password updated successfully' };
  }
}

export const authService = new AuthService();
