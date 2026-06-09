import { z } from 'zod';

const campaignBaseSchema = z.object({
  name: z.string().min(2).max(200),
  walletAmount: z.coerce.number().min(0),
  rewardPoints: z.coerce.number().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export const createCampaignSchema = campaignBaseSchema.refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export const updateCampaignSchema = campaignBaseSchema
  .partial()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    { message: 'End date must be on or after start date', path: ['endDate'] }
  );

export const campaignIdParamSchema = z.object({
  id: z.string().min(1),
});
