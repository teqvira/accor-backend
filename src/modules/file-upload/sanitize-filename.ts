export function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/^.*[\\/]/, '');
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return sanitized || 'file';
}
