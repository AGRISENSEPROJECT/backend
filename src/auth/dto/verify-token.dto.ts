import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyGoogleTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class VerifyFacebookTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}