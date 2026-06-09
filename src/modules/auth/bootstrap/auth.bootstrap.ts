import bcrypt from 'bcryptjs';
import { env } from '../../../config/env';
import { User, UserRole } from '../models/user.model';

export async function bootstrapAdmin(): Promise<void> {
  const count = await User.countDocuments({
    role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  });
  if (count > 0) return;

  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.warn(
      'No admin users in DB. Set BOOTSTRAP_ADMIN_* env vars to create the first admin.'
    );
    return;
  }

  const hashed = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);
  await User.create({
    name: env.BOOTSTRAP_ADMIN_NAME ?? 'Super Admin',
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: hashed,
    role: UserRole.SUPER_ADMIN,
    isVerified: true,
  });

  console.log(`Bootstrap super admin created: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
}
