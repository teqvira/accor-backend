import mongoose from 'mongoose';
import { env } from '../config/env';
import { ensureUserIndexes } from '../modules/auth/models/user.model';
import { detectMongoTransactions } from './transactions';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  await ensureUserIndexes();
  await detectMongoTransactions();
  console.log('MongoDB connected');
}
