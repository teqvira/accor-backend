import { z } from 'zod';
import { NOTIFICATION_BROADCAST_TYPE_VALUES } from './notifications.constants';

const broadcastTypeSchema = z.enum(
  NOTIFICATION_BROADCAST_TYPE_VALUES as [string, ...string[]]
);

export const createAdminNotificationSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    /** Admin UI field */
    description: z.string().trim().min(1).max(2000).optional(),
    /** Alias for description */
    body: z.string().trim().min(1).max(2000).optional(),
    /** Admin UI type: reminder | campaign | info | alert */
    type: broadcastTypeSchema,
    data: z.record(z.string(), z.unknown()).optional(),
    userIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine((v) => Boolean(v.description?.trim() || v.body?.trim()), {
    message: 'description is required',
    path: ['description'],
  });

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

/** Admin management list (screenshot table): search + type filter */
export const listAdminBroadcastsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: broadcastTypeSchema.optional(),
});
