import { Matches } from 'class-validator';

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character';

export const NATIONAL_ID_REGEX = /^[0-9]{16}$/;
export const NATIONAL_ID_MESSAGE = 'National ID must be 16 digits';

export function IsStrongPassword() {
  return Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE });
}

export function IsNationalId() {
  return Matches(NATIONAL_ID_REGEX, { message: NATIONAL_ID_MESSAGE });
}
