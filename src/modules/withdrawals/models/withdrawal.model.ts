import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  PayoutMethod,
  PayoutProviderName,
  WithdrawalStatus,
} from '../constants/withdrawal.constants';

export interface IWithdrawal extends Document {
  userId: Types.ObjectId;
  amount: number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider: PayoutProviderName;
  providerPayoutId?: string;
  providerReferenceId: string;
  failureReason?: string;
  payoutDestination: string;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: Object.values(PayoutMethod), required: true },
    status: {
      type: String,
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.PENDING,
    },
    provider: {
      type: String,
      enum: Object.values(PayoutProviderName),
      required: true,
    },
    providerPayoutId: { type: String },
    providerReferenceId: { type: String, required: true, unique: true },
    failureReason: { type: String },
    payoutDestination: { type: String, required: true },
  },
  { timestamps: true }
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ userId: 1, status: 1 });

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
