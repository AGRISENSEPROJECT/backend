import { User } from '../../entities/user.entity';

export function mapToAuthor(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
  };
}
