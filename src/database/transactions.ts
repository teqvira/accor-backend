import mongoose, { ClientSession } from 'mongoose';

let transactionsEnabled = false;

function isTransactionNotSupportedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code?: number }).code === 20
  );
}

export function areMongoTransactionsEnabled(): boolean {
  return transactionsEnabled;
}

export async function detectMongoTransactions(): Promise<void> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await mongoose.connection.collection('users').findOne({}, { session });
    await session.commitTransaction();
    transactionsEnabled = true;
    console.log('MongoDB transactions: enabled');
  } catch (err) {
    if (isTransactionNotSupportedError(err)) {
      transactionsEnabled = false;
      console.warn(
        'MongoDB transactions are not available on this instance (standalone). ' +
          'Using non-transactional fallback for local development.'
      );
      return;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export function optionalSessionOptions(session?: ClientSession) {
  return session ? { session } : {};
}

export async function withMongoTransaction<T>(
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> {
  if (!transactionsEnabled) {
    return fn(undefined);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
