import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/utils/errors';
import { isPgUniqueViolation } from '../../shared/utils/postgres';
import { refreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import { userDeviceTokenRepository } from '../auth/repositories/user-device-token.repository';
import { userRepository } from '../auth/repositories/user.repository';
import { userSessionRepository } from '../auth/repositories/user-session.repository';
import { UserRole } from '../auth/user.types';
import { isOwnProfileUploadUrl } from '../file-upload/profile-upload-key';
import { isOwnBucketObjectUrl } from '../file-upload/product-image-key';
import { presignedUrlService } from '../file-upload/presigned-url.service';
import { userDocumentRepository } from '../users/user-document.repository';
import { notificationsService } from '../notifications/index';
import {
  CreatePartnerInput,
  PartnerListFilters,
  sanitizePartner,
  UpdatePartnerDocumentsInput,
  UpdatePartnerInput,
} from './partners.types';

async function getPartnerOrThrow(id: string) {
  const user = await userRepository.findById(id);
  if (!user || user.role !== UserRole.USER) {
    throw new NotFoundError('Partner not found', `partnerId=${id}`);
  }
  return user;
}

export class PartnersService {
  async getStats() {
    return userRepository.getPartnerStats();
  }

  async list(page = 1, limit = 20, filters: PartnerListFilters = {}) {
    const { items, total } = await userRepository.findPartners(
      page,
      limit,
      filters
    );
    return {
      items: items.map(sanitizePartner),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const partner = await userRepository.findPartnerById(id);
    if (!partner) {
      throw new NotFoundError('Partner not found', `getById: partnerId=${id}`);
    }
    return sanitizePartner(partner);
  }

  /** Admin Add Partner → auto approved (dealer or mechanic) + docs at create. */
  async create(input: CreatePartnerInput) {
    if (!isOwnBucketObjectUrl(input.aadhaarUrl)) {
      throw new BadRequestError(
        'Aadhaar must be an uploaded document URL',
        'createPartner: invalid aadhaarUrl'
      );
    }
    if (!isOwnBucketObjectUrl(input.panUrl)) {
      throw new BadRequestError(
        'PAN must be an uploaded document URL',
        'createPartner: invalid panUrl'
      );
    }

    // Check if a soft-deleted user already exists with the same mobile or email.
    // If so, restore that user instead of inserting a duplicate (which would hit
    // the unique constraint and surface a misleading "already registered" error).
    const existingByMobile = await userRepository.findByMobileIncludingDeleted(
      input.mobileNumber
    );
    const existingByEmail = input.email
      ? await userRepository.findByEmailIncludingDeleted(
          input.email.trim().toLowerCase()
        )
      : null;

    const deletedUser =
      (existingByMobile?.deletedAt ? existingByMobile : null) ??
      (existingByEmail?.deletedAt ? existingByEmail : null);

    // If a non-deleted user already exists with this mobile/email, surface a conflict.
    const activeConflict =
      (existingByMobile && !existingByMobile.deletedAt) ||
      (existingByEmail && !existingByEmail.deletedAt);

    if (activeConflict) {
      throw new ConflictError(
        'Mobile number or email is already registered',
        'createPartner: active user exists with same mobile or email'
      );
    }

    try {
      let partnerId: string;
      const isMechanic = input.userType === 'mechanic';
      const garageRole = isMechanic ? input.garageRole ?? null : null;
      let garageName = isMechanic ? input.garageName?.trim() ?? null : null;
      let garageOwnerName =
        isMechanic && input.garageRole === 'worker'
          ? input.garageOwnerName?.trim() ?? null
          : null;
      let garageId: string | null = null;

      if (isMechanic && garageRole === 'worker' && input.ownerId) {
        const owner = await userRepository.findById(input.ownerId);
        if (owner) {
          garageId = owner.garageId ?? null;
          garageName = owner.garageName ?? null;
          garageOwnerName = owner.name ?? null;
        }
      }

      if (deletedUser) {
        // Restore the soft-deleted row with the new details.
        await userRepository.update(deletedUser._id, {
          name: input.name.trim(),
          email: input.email ? input.email.trim().toLowerCase() : null,
          mobileNumber: input.mobileNumber,
          userType: input.userType,
          garageRole,
          garageName,
          garageOwnerName,
          city: input.city?.trim() ?? null,
          state: input.state?.trim() ?? null,
          isVerified: true,
          isActive: true,
          isBlocked: false,
          approvalStatus: 'approved',
          profileCompleted: true,
          deletedAt: null,
        });
        partnerId = deletedUser._id;
      } else {
        const created = await userRepository.create({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          mobileNumber: input.mobileNumber,
          role: UserRole.USER,
          userType: input.userType,
          garageRole: garageRole ?? undefined,
          garageName: garageName ?? undefined,
          garageOwnerName: garageOwnerName ?? undefined,
          city: input.city?.trim(),
          state: input.state?.trim(),
          isVerified: true,
          approvalStatus: 'approved',
          profileCompleted: true,
        });
        partnerId = created._id;
      }

      // Handle garage linkage
      if (isMechanic && garageRole === 'owner' && garageName) {
        garageId = await userRepository.upsertOwnerGarage(partnerId, garageName);
      } else if (isMechanic && garageRole === 'worker' && !input.ownerId) {
        const owner = await userRepository.findGarageOwnerForWorker({
          _id: partnerId,
          role: UserRole.USER,
          walletBalance: 0,
          rewardPoints: 0,
          isActive: true,
          isBlocked: false,
          isVerified: true,
          approvalStatus: 'approved',
          profileCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          garageRole: 'worker',
          garageName: garageName ?? undefined,
          garageOwnerName: garageOwnerName ?? undefined,
        });
        garageId = owner?.garageId ?? null;
      }

      if (garageId) {
        await userRepository.update(partnerId, { garageId });
      }

      await userDocumentRepository.upsertByUserAndType({
        userId: partnerId,
        documentType: 'aadhaar',
        documentFront: input.aadhaarUrl,
        status: 'approved',
      });
      await userDocumentRepository.upsertByUserAndType({
        userId: partnerId,
        documentType: 'pan',
        documentFront: input.panUrl,
        status: 'approved',
      });

      return this.getById(partnerId);
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictError(
          'Mobile number or email is already registered',
          'createPartner: unique violation'
        );
      }
      throw err;
    }
  }

  async update(id: string, input: UpdatePartnerInput) {
    const current = await getPartnerOrThrow(id);

    if (input.aadhaarUrl && !isOwnBucketObjectUrl(input.aadhaarUrl)) {
      throw new BadRequestError(
        'Aadhaar must be an uploaded document URL',
        'updatePartner: invalid aadhaarUrl'
      );
    }
    if (input.panUrl && !isOwnBucketObjectUrl(input.panUrl)) {
      throw new BadRequestError(
        'PAN must be an uploaded document URL',
        'updatePartner: invalid panUrl'
      );
    }

    try {
      const effectiveUserType =
        input.userType !== undefined ? input.userType : current.userType;
      const isMechanic = effectiveUserType === 'mechanic';

      let garageRole =
        input.garageRole !== undefined ? input.garageRole : current.garageRole;
      let garageName =
        input.garageName !== undefined
          ? input.garageName?.trim() ?? null
          : current.garageName;
      let garageOwnerName =
        input.garageOwnerName !== undefined
          ? input.garageOwnerName?.trim() ?? null
          : current.garageOwnerName;

      if (!isMechanic) {
        garageRole = null;
        garageName = null;
        garageOwnerName = null;
      } else if (garageRole === 'owner') {
        garageOwnerName = null;
      }

      let garageId = current.garageId ?? null;

      if (isMechanic && garageRole === 'worker' && input.ownerId) {
        const owner = await userRepository.findById(input.ownerId);
        if (owner) {
          garageId = owner.garageId ?? null;
          garageName = owner.garageName ?? null;
          garageOwnerName = owner.name ?? null;
        }
      }

      if (isMechanic && garageRole === 'owner' && garageName) {
        garageId = await userRepository.upsertOwnerGarage(id, garageName);
      } else if (isMechanic && garageRole === 'worker' && !input.ownerId) {
        const owner = await userRepository.findGarageOwnerForWorker({
          _id: id,
          role: UserRole.USER,
          walletBalance: 0,
          rewardPoints: 0,
          isActive: true,
          isBlocked: false,
          isVerified: true,
          approvalStatus: 'approved',
          profileCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          garageRole: 'worker',
          garageName: garageName ?? undefined,
          garageOwnerName: garageOwnerName ?? undefined,
        });
        garageId = owner?.garageId ?? null;
      } else if (!isMechanic) {
        garageId = null;
      }

      await userRepository.update(id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined
          ? { email: input.email.trim().toLowerCase() }
          : {}),
        ...(input.mobileNumber !== undefined
          ? { mobileNumber: input.mobileNumber }
          : {}),
        ...(input.userType !== undefined ? { userType: input.userType } : {}),
        ...(input.city !== undefined
          ? { city: input.city ? input.city.trim() : null }
          : {}),
        ...(input.state !== undefined
          ? { state: input.state ? input.state.trim() : null }
          : {}),
        garageRole,
        garageName,
        garageOwnerName,
        garageId,
      });

      if (input.aadhaarUrl) {
        await userDocumentRepository.upsertByUserAndType({
          userId: id,
          documentType: 'aadhaar',
          documentFront: input.aadhaarUrl,
          status: 'approved',
        });
      }
      if (input.panUrl) {
        await userDocumentRepository.upsertByUserAndType({
          userId: id,
          documentType: 'pan',
          documentFront: input.panUrl,
          status: 'approved',
        });
      }

      // Handle worker garage transfer notifications
      if (current.garageRole === 'worker' && current.garageId && current.garageId !== garageId) {
        const oldOwner = await userRepository.findOwnerByGarageId(current.garageId);
        if (oldOwner) {
          notificationsService.notifyWorkerLeft(
            { name: input.name ?? current.name, mobileNumber: current.mobileNumber },
            oldOwner._id,
            oldOwner.name || 'Owner'
          );
        }
      }

      if (isMechanic && garageRole === 'worker' && garageId && current.garageId !== garageId) {
        const currentNewOwner = await userRepository.findOwnerByGarageId(garageId);
        if (currentNewOwner) {
          notificationsService.notifyWorkerJoined(
            { name: input.name ?? current.name, mobileNumber: current.mobileNumber },
            currentNewOwner._id,
            currentNewOwner.name || 'Owner'
          );
        }
      }

      return this.getById(id);
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictError(
          'Mobile number or email is already registered',
          'updatePartner: unique violation'
        );
      }
      throw err;
    }
  }

  async approve(id: string) {
    const partner = await getPartnerOrThrow(id);
    if (partner.approvalStatus === 'approved') {
      throw new BadRequestError(
        'Partner is already approved',
        `approve: partnerId=${id}`
      );
    }

    await userRepository.update(id, {
      approvalStatus: 'approved',
      isVerified: true,
      isActive: true,
    });
    return this.getById(id);
  }

  async reject(id: string, _reason?: string) {
    const partner = await getPartnerOrThrow(id);
    if (partner.approvalStatus === 'rejected') {
      throw new BadRequestError(
        'Partner is already rejected',
        `reject: partnerId=${id}`
      );
    }

    await userRepository.update(id, {
      approvalStatus: 'rejected',
      isActive: false,
    });
    return this.getById(id);
  }

  async block(id: string, _reason?: string) {
    const partner = await getPartnerOrThrow(id);
    if (partner.isBlocked) {
      throw new BadRequestError(
        'Partner is already blocked',
        `block: partnerId=${id}`
      );
    }

    await userRepository.update(id, {
      isBlocked: true,
      isActive: false,
    });

    // Invalidate active auth tokens, sessions, and push device tokens immediately
    await refreshTokenRepository.revokeManyByUserId(id);
    await userSessionRepository.closeManyByUserId(id);
    await userDeviceTokenRepository.deactivateManyByUserId(id);

    return this.getById(id);
  }

  async unblock(id: string) {
    const partner = await getPartnerOrThrow(id);
    if (!partner.isBlocked) {
      throw new BadRequestError(
        'Partner is not blocked',
        `unblock: partnerId=${id}`
      );
    }

    await userRepository.update(id, {
      isBlocked: false,
      isActive: true,
    });

    return this.getById(id);
  }

  async createDocumentPresignedUrl(
    partnerId: string,
    input: { purpose: 'aadhaar' | 'pan'; fileName: string; contentType: string }
  ) {
    await getPartnerOrThrow(partnerId);
    return presignedUrlService.createProfileUploadUrl(partnerId, input);
  }

  async updateDocuments(partnerId: string, input: UpdatePartnerDocumentsInput) {
    await getPartnerOrThrow(partnerId);

    if (
      input.aadhaarUrl &&
      !isOwnProfileUploadUrl(input.aadhaarUrl, partnerId, 'aadhaar')
    ) {
      throw new BadRequestError(
        'Aadhaar URL must be an uploaded document for this partner',
        `updateDocuments: invalid aadhaarUrl partnerId=${partnerId}`
      );
    }
    if (
      input.panUrl &&
      !isOwnProfileUploadUrl(input.panUrl, partnerId, 'pan')
    ) {
      throw new BadRequestError(
        'PAN URL must be an uploaded document for this partner',
        `updateDocuments: invalid panUrl partnerId=${partnerId}`
      );
    }

    if (input.aadhaarUrl) {
      await userDocumentRepository.upsertByUserAndType({
        userId: partnerId,
        documentType: 'aadhaar',
        documentFront: input.aadhaarUrl,
        status: 'approved',
      });
    }
    if (input.panUrl) {
      await userDocumentRepository.upsertByUserAndType({
        userId: partnerId,
        documentType: 'pan',
        documentFront: input.panUrl,
        status: 'approved',
      });
    }

    return this.getById(partnerId);
  }
}

/** App access: only approved dealers/mechanics. */
export async function assertPartnerApproved(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError(
      'User not found',
      `assertPartnerApproved: userId=${userId}`
    );
  }
  if (user.role !== UserRole.USER) return;

  if (user.isBlocked || !user.isActive) {
    throw new ForbiddenError(
      'Your account has been blocked. Please contact support',
      `assertPartnerApproved: blocked/inactive userId=${userId}`
    );
  }

  if (user.approvalStatus === 'pending') {
    throw new ForbiddenError(
      'Your account is awaiting admin approval',
      `assertPartnerApproved: pending userId=${userId}`
    );
  }
  if (user.approvalStatus === 'rejected') {
    throw new ForbiddenError(
      'Your account has been rejected. Please contact support',
      `assertPartnerApproved: rejected userId=${userId}`
    );
  }
}

/** QR scan is mechanic-only. */
export async function assertMechanicForQr(userId: string): Promise<void> {
  await assertPartnerApproved(userId);
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found', `assertMechanicForQr: userId=${userId}`);
  }
  if (user.userType !== 'mechanic') {
    throw new ForbiddenError(
      'QR scanning is only available for mechanics',
      `assertMechanicForQr: userType=${user.userType} userId=${userId}`
    );
  }
}

export const partnersService = new PartnersService();
