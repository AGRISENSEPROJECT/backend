import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyGoogleTokenDto {
  @ApiProperty({
    description: 'Google ID token received from mobile app',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjdkYzAyYjg1...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class VerifyFacebookTokenDto {
  @ApiProperty({
    description: 'Facebook access token received from mobile app',
    example: 'EAABwzLixnjYBAOZCZCqzZCZBZCqzZCZBZCqzZCZB...',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}