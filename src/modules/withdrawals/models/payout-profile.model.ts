import mongoose, { Document, Schema, Types } from 'mongoose';
import { PayoutMethod, PayoutProviderName } from '../constants/withdrawal.constants';

export interface IPayoutProfile extends Document {
  userId: Types.ObjectId;
  method: PayoutMethod;
  accountHolderName: string;
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
  provider: PayoutProviderName;
  providerContactId?: string;
  providerFundAccountId?: string;
  cashfreeBeneficiaryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutProfileSchema = new Schema<IPayoutProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    method: { type: String, enum: Object.values(PayoutMethod), required: true },
    accountHolderName: { type: String, required: true, trim: true },
    upiId: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    ifsc: { type: String, trim: true, uppercase: true },
    provider: {
      type: String,
      enum: Object.values(PayoutProviderName),
      required: true,
    },
    providerContactId: { type: String },
    providerFundAccountId: { type: String },
    cashfreeBeneficiaryId: { type: String },
  },
  { timestamps: true }
);

export const PayoutProfile = mongoose.model<IPayoutProfile>(
  'PayoutProfile',
  payoutProfileSchema
);
