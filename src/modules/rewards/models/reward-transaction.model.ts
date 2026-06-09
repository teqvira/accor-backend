import mongoose, { Document, Schema, Types } from 'mongoose';

export enum RewardTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface IRewardTransaction extends Document {
  userId: Types.ObjectId;
  points: number;
  type: RewardTransactionType;
  referenceId?: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const rewardTransactionSchema = new Schema<IRewardTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    points: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: Object.values(RewardTransactionType),
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

rewardTransactionSchema.index({ userId: 1, createdAt: -1 });

export const RewardTransaction = mongoose.model<IRewardTransaction>(
  'RewardTransaction',
  rewardTransactionSchema
);
