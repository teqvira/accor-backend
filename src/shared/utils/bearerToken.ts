import { Request } from 'express';

export function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice(7).trim();
  return token || undefined;
}
