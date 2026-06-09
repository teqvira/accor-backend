import mongoose, { Document, Schema, Types } from 'mongoose';

export enum QrBatchStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  ASSIGNED = 'assigned',
}

export interface IQrBatch extends Document {
  name: string;
  totalQrs: number;
  generatedCount: number;
  campaignId?: Types.ObjectId;
  status: QrBatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const qrBatchSchema = new Schema<IQrBatch>(
  {
    name: { type: String, required: true, trim: true },
    totalQrs: { type: Number, required: true, min: 1 },
    generatedCount: { type: Number, default: 0, min: 0 },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    status: {
      type: String,
      enum: Object.values(QrBatchStatus),
      default: QrBatchStatus.DRAFT,
    },
  },
  { timestamps: true }
);

export const QrBatch = mongoose.model<IQrBatch>('QrBatch', qrBatchSchema);
