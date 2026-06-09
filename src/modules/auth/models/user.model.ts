import mongoose, { Document, Schema } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export interface IUser extends Document {
  name?: string;
  email?: string;
  password?: string;
  mobileNumber?: string;
  walletBalance: number;
  rewardPoints: number;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpLastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    mobileNumber: {
      type: String,
      trim: true,
    },
    walletBalance: { type: Number, default: 0, min: 0 },
    rewardPoints: { type: Number, default: 0, min: 0 },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpLastSentAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $gt: '' } },
  }
);

userSchema.index(
  { mobileNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { mobileNumber: { $exists: true, $gt: '' } },
  }
);

export const User = mongoose.model<IUser>('User', userSchema);

export async function ensureUserIndexes(): Promise<void> {
  await User.updateMany(
    { $or: [{ email: null }, { email: '' }] },
    { $unset: { email: 1 } }
  );
  await User.updateMany(
    { $or: [{ mobileNumber: null }, { mobileNumber: '' }] },
    { $unset: { mobileNumber: 1 } }
  );
  await User.syncIndexes();
}
