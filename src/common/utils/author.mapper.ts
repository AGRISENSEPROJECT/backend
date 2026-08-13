import { User } from '../../entities/user.entity';
import { UserStatus } from '../enums/user-status.enum';

type AccountFlags = {
  deletedAt?: Date | string | null;
  status?: UserStatus | string | null;
};

export function isDeletedUser(user?: AccountFlags | null): boolean {
  return !!user?.deletedAt;
}

export function isBannedUser(user?: AccountFlags | null): boolean {
  return !!user && !user.deletedAt && String(user.status || '').toUpperCase() === UserStatus.BANNED;
}

/** Ban and delete hide the person from community; suspend does not. */
export function isHiddenFromCommunity(user?: AccountFlags | null): boolean {
  return isDeletedUser(user) || isBannedUser(user);
}

/** Display label for UI that still expects `username`. */
export function userDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  deletedAt?: Date | string | null;
  status?: UserStatus | string | null;
}): string {
  if (isDeletedUser(user)) return 'Deleted account';
  if (isBannedUser(user)) return 'Banned account';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.email) return user.email.split('@')[0] || user.email;
  return 'Farmer';
}

export function mapToAuthor(user?: User | null) {
  if (!user) return null;
  if (isDeletedUser(user)) {
    return {
      id: user.id,
      firstName: null,
      lastName: null,
      email: null,
      profileImage: null,
      username: 'Deleted account',
      displayName: 'Deleted account',
      deleted: true,
      banned: false,
      status: user.status,
    };
  }
  if (isBannedUser(user)) {
    return {
      id: user.id,
      firstName: null,
      lastName: null,
      email: null,
      profileImage: null,
      username: 'Banned account',
      displayName: 'Banned account',
      deleted: false,
      banned: true,
      status: user.status,
    };
  }
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
    deleted: false,
    banned: false,
    status: user.status,
  };
}
