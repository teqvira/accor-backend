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
