import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User, UserRole } from '../models/User';

export async function bootstrapAdmin(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;

  if (
    !env.BOOTSTRAP_ADMIN_EMAIL ||
    !env.BOOTSTRAP_ADMIN_PASSWORD
  ) {
    console.warn(
      'No users in DB. Set BOOTSTRAP_ADMIN_* env vars to create the first admin.'
    );
    return;
  }

  const hashed = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);
  await User.create({
    name: env.BOOTSTRAP_ADMIN_NAME ?? 'Admin',
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: hashed,
    role: UserRole.ADMIN,
  });

  console.log(`Bootstrap admin created: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
}
