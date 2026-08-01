import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/utils/errors';
import { isPgUniqueViolation } from '../../shared/utils/postgres';
import { userRepository } from '../auth/repositories/user.repository';
import { UserRole } from '../auth/user.types';
import { isOwnProfileUploadUrl } from '../file-upload/profile-upload-key';
import { presignedUrlService } from '../file-upload/presigned-url.service';
import { userDocumentRepository } from '../users/user-document.repository';
import {
  CreatePartnerInput,
  PartnerListFilters,
  sanitizePartner,
  UpdatePartnerDocumentsInput,
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

  /** Admin Add Partner → auto approved (dealer or mechanic). */
  async create(input: CreatePartnerInput) {
    try {
      const created = await userRepository.create({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        mobileNumber: input.mobileNumber,
        role: UserRole.USER,
        userType: input.userType,
        city: input.city?.trim(),
        state: input.state?.trim(),
        isVerified: true,
        approvalStatus: 'approved',
        profileCompleted: true,
      });

      // Upload Aadhaar/PAN after create (same as mobile):
      // POST /api/partners/:id/documents/presigned-url → PUT S3
      // → PATCH /api/partners/:id/documents
      return this.getById(created._id);
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
