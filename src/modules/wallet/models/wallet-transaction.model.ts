import mongoose, { Document, Schema, Types } from 'mongoose';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface IWalletTransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: WalletTransactionType;
  referenceId?: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: Object.values(WalletTransactionType),
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  walletTransactionSchema
);
