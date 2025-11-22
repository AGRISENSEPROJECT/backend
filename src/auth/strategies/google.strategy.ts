import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    
    if (!emails || !emails[0] || !name) {
      done(new Error('Missing profile information'), false);
      return;
    }

    const socialRegisterDto = {
      email: emails[0].value,
      username: `${name.givenName}_${name.familyName}`.toLowerCase(),
      provider: 'google',
      providerId: id,
      firstName: name.givenName,
      lastName: name.familyName,
    };

    try {
      const result = await this.authService.socialRegister(socialRegisterDto);
      done(null, result);
    } catch (error) {
      done(error, false);
    }
  }
}