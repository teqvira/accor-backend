interface MongoErrorShape {
  code?: number;
  insertedDocs?: Array<{ _id: unknown }>;
}

export function isMongoDuplicateKeyError(err: unknown): err is Error & MongoErrorShape {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as MongoErrorShape).code === 11000
  );
}

export function getInsertedDocsCount(err: Error & MongoErrorShape): number {
  return err.insertedDocs?.length ?? 0;
}
