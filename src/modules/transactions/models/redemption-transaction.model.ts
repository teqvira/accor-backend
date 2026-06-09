import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRedemptionTransaction extends Document {
  userId: Types.ObjectId;
  qrCodeId: Types.ObjectId;
  campaignId: Types.ObjectId;
  walletAmount: number;
  rewardPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const redemptionTransactionSchema = new Schema<IRedemptionTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    qrCodeId: { type: Schema.Types.ObjectId, ref: 'QrCode', required: true, unique: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    walletAmount: { type: Number, required: true, min: 0 },
    rewardPoints: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

redemptionTransactionSchema.index({ userId: 1, createdAt: -1 });
redemptionTransactionSchema.index({ campaignId: 1, createdAt: -1 });

export const RedemptionTransaction = mongoose.model<IRedemptionTransaction>(
  'RedemptionTransaction',
  redemptionTransactionSchema
);
