import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true },
    walletAmount: { type: Number, required: true, min: 0 },
    rewardPoints: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: false },
  },
  { timestamps: true }
);

campaignSchema.index({ active: 1, startDate: 1, endDate: 1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);

export type CampaignId = Types.ObjectId;
