import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { partnersAdminController } from './partners.admin.controller';
import {
  createPartnerSchema,
  listPartnersQuerySchema,
  partnerDocumentPresignedSchema,
  rejectPartnerSchema,
  updatePartnerDocumentsSchema,
} from './partners.validator';

const router = Router();

router.get(
  '/stats',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.getStats(req, res)
  )
);

router.get(
  '/',
  ...adminOnly,
  validate(listPartnersQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) => partnersAdminController.list(req, res))
);

router.post(
  '/',
  ...adminOnly,
  validate(createPartnerSchema),
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.create(req, res)
  )
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.getById(req, res)
  )
);

router.post(
  '/:id/approve',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.approve(req, res)
  )
);

router.post(
  '/:id/reject',
  ...adminOnly,
  validate(rejectPartnerSchema),
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.reject(req, res)
  )
);

router.post(
  '/:id/documents/presigned-url',
  ...adminOnly,
  validate(partnerDocumentPresignedSchema),
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.createDocumentPresignedUrl(req, res)
  )
);

router.patch(
  '/:id/documents',
  ...adminOnly,
  validate(updatePartnerDocumentsSchema),
  asyncHandler<AuthRequest>((req, res) =>
    partnersAdminController.updateDocuments(req, res)
  )
);

export default router;
