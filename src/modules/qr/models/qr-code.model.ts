import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQrCode extends Document {
  code: string;
  batchId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  redeemed: boolean;
  redeemedBy?: Types.ObjectId;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const qrCodeSchema = new Schema<IQrCode>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'QrBatch', required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    redeemed: { type: Boolean, default: false },
    redeemedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    redeemedAt: { type: Date },
  },
  { timestamps: true }
);

qrCodeSchema.index({ batchId: 1, redeemed: 1 });
qrCodeSchema.index({ campaignId: 1, redeemed: 1 });

export const QrCode = mongoose.model<IQrCode>('QrCode', qrCodeSchema);
