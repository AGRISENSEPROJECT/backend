import { User } from '../../entities/user.entity';

/** Display label for UI that still expects `username`. */
export function userDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.email) return user.email.split('@')[0] || user.email;
  return 'Farmer';
}

export function mapToAuthor(user?: User | null) {
  if (!user) return null;
  const username = userDisplayName(user);
  return {
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    profileImage: user.profileImage ?? null,
    /** Backward-compatible alias for mobile clients still reading `.username` */
    username,
    displayName: username,
  };
}
