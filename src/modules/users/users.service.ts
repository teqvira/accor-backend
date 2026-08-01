import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/utils/errors';
import { isPgUniqueViolation } from '../../shared/utils/postgres';
import { userRepository } from '../auth/repositories/user.repository';
import { JwtAccessPayload } from '../auth/auth.types';
import { IUser, UserRole } from '../auth/user.types';
import { isOwnProfileUploadUrl } from '../file-upload/profile-upload-key';
import { userDocumentRepository } from './user-document.repository';
import {
  CompleteProfileInput,
  UpdateUserInput,
  UserListFilters,
} from './users.types';

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3,
};

function canAssignRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[creatorRole] > ROLE_RANK[targetRole];
}

function formatDate(date?: Date): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
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
    approvalStatus: user.approvalStatus,
    canAccessApp:
      user.role !== UserRole.USER || user.approvalStatus === 'approved',
    walletBalance: user.walletBalance,
    rewardPoints: user.rewardPoints,
    avatarUrl: user.avatarUrl,
    dateOfBirth: formatDate(user.dateOfBirth),
    city: user.city,
    state: user.state,
    userType: user.userType,
    profileCompleted: user.profileCompleted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sanitizeDocuments(
  docs: Awaited<ReturnType<typeof userDocumentRepository.findByUserId>>
) {
  const aadhaar = docs.find((d) => d.documentType === 'aadhaar');
  const pan = docs.find((d) => d.documentType === 'pan');

  return {
    aadhaar: aadhaar
      ? {
          url: aadhaar.documentFront,
          status: aadhaar.status,
          uploadedAt: aadhaar.createdAt,
        }
      : null,
    pan: pan
      ? {
          url: pan.documentFront,
          status: pan.status,
          uploadedAt: pan.createdAt,
        }
      : null,
  };
}

export class UsersService {
  async list(page = 1, limit = 20, filters: UserListFilters = {}) {
    const { items, total } = await userRepository.findAll(page, limit, filters);
    return {
      items: items.map(sanitizeUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found', `getById: id=${id}`);
    }
    return sanitizeUser(user);
  }

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getMe: userId=${userId}`);
    }
    const docs = await userDocumentRepository.findByUserId(userId);
    return {
      user: sanitizeUser(user),
      documents: sanitizeDocuments(docs),
    };
  }

  async completeProfile(userId: string, input: CompleteProfileInput) {
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError(
        'User not found',
        `completeProfile: userId=${userId}`
      );
    }

    if (input.avatarUrl && !isOwnProfileUploadUrl(input.avatarUrl, userId, 'avatar')) {
      throw new BadRequestError(
        'Avatar URL must be an uploaded profile image',
        `completeProfile: invalid avatarUrl userId=${userId}`
      );
    }

    if (!isOwnProfileUploadUrl(input.aadhaarUrl, userId, 'aadhaar')) {
      throw new BadRequestError(
        'Aadhaar URL must be an uploaded document for this user',
        `completeProfile: invalid aadhaarUrl userId=${userId}`
      );
    }

    if (!isOwnProfileUploadUrl(input.panUrl, userId, 'pan')) {
      throw new BadRequestError(
        'PAN URL must be an uploaded document for this user',
        `completeProfile: invalid panUrl userId=${userId}`
      );
    }

    const dob = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestError(
        'Invalid date of birth',
        `completeProfile: dateOfBirth=${input.dateOfBirth}`
      );
    }
    if (dob > new Date()) {
      throw new BadRequestError(
        'Date of birth cannot be in the future',
        `completeProfile: future DOB userId=${userId}`
      );
    }

    try {
      const updated = await userRepository.update(userId, {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        dateOfBirth: input.dateOfBirth,
        city: input.city.trim(),
        state: input.state.trim(),
        userType: input.userType,
        avatarUrl: input.avatarUrl,
        profileCompleted: true,
      });

      if (!updated) {
        throw new NotFoundError(
          'User not found',
          `completeProfile: update failed userId=${userId}`
        );
      }

      await userDocumentRepository.upsertByUserAndType({
        userId,
        documentType: 'aadhaar',
        documentFront: input.aadhaarUrl,
        status: 'pending',
      });
      await userDocumentRepository.upsertByUserAndType({
        userId,
        documentType: 'pan',
        documentFront: input.panUrl,
        status: 'pending',
      });

      const docs = await userDocumentRepository.findByUserId(userId);
      return {
        user: sanitizeUser(updated),
        documents: sanitizeDocuments(docs),
      };
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictError(
          'Email is already in use',
          `completeProfile: unique violation userId=${userId}`
        );
      }
      throw err;
    }
  }

  async update(actor: JwtAccessPayload, id: string, input: UpdateUserInput) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found', `update: id=${id}`);
    }

    if (input.role !== undefined) {
      if (!canAssignRole(actor.role, input.role)) {
        throw new ForbiddenError(
          'You cannot assign this role',
          `update: actorRole=${actor.role}, targetRole=${input.role}`
        );
      }
      if (!canAssignRole(actor.role, existing.role) && actor.sub !== id) {
        throw new ForbiddenError(
          'You cannot change a user with equal or higher role',
          `update: actorRole=${actor.role}, existingRole=${existing.role}`
        );
      }
    }

    if (
      input.isActive === false &&
      existing.role === UserRole.SUPER_ADMIN &&
      actor.sub === id
    ) {
      throw new BadRequestError(
        'You cannot deactivate your own super admin account',
        `update: self-deactivate blocked userId=${id}`
      );
    }

    try {
      const updated = await userRepository.update(id, {
        name: input.name,
        email: input.email,
        mobileNumber: input.mobileNumber,
        role: input.role,
        isActive: input.isActive,
        isVerified: input.isVerified,
      });

      if (!updated) {
        throw new NotFoundError('User not found', `update: id=${id}`);
      }

      return sanitizeUser(updated);
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictError(
          'Email or mobile number is already in use',
          `update: unique violation for userId=${id}`
        );
      }
      throw err;
    }
  }
}

export const usersService = new UsersService();
