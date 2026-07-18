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
import { UpdateUserInput, UserListFilters } from './users.types';

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3,
};

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
    updatedAt: user.updatedAt,
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
