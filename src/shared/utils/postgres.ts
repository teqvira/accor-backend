import { ConflictError, NotFoundError } from './errors';

interface PgErrorShape {
  code?: string;
}

function asPgError(error: unknown): PgErrorShape | null {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    return error as PgErrorShape;
  }
  return null;
}

export const isPgUniqueViolation = (error: unknown): boolean => {
  return asPgError(error)?.code === '23505';
};

export const isPgForeignKeyViolation = (error: unknown): boolean => {
  return asPgError(error)?.code === '23503';
};

export const handlePgError = (error: unknown): void => {
  if (isPgUniqueViolation(error)) {
    throw new ConflictError('Record already exists');
  }
  if (isPgForeignKeyViolation(error)) {
    throw new NotFoundError('Referenced record not found');
  }
  throw error;
};
