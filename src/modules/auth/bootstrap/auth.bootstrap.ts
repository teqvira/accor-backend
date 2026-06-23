import bcrypt from 'bcryptjs';
import { env } from '../../../config/env';
import { userRepository } from '../repositories/user.repository';
import { UserRole } from '../types/user.types';

export async function bootstrapAdmin(): Promise<void> {
  const count = await userRepository.countAdmins();
  if (count > 0) return;

  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.warn(
      'No admin users in DB. Set BOOTSTRAP_ADMIN_* env vars to create the first admin.'
    );
    return;
  }

  const hashed = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);
  await userRepository.create({
    name: env.BOOTSTRAP_ADMIN_NAME ?? 'Super Admin',
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: hashed,
    role: UserRole.SUPER_ADMIN,
    isVerified: true,
  });

  console.log(`Bootstrap super admin created: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
}
