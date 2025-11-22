import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('FACEBOOK_APP_ID') || '',
      clientSecret: configService.get('FACEBOOK_APP_SECRET') || '',
      callbackURL: '/auth/facebook/callback',
      scope: 'email',
      profileFields: ['emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, id } = profile;
    
    if (!emails || !emails[0] || !name) {
      done(new Error('Missing profile information'), false);
      return;
    }

    const socialRegisterDto = {
      email: emails[0].value,
      username: `${name.givenName}_${name.familyName}`.toLowerCase(),
      provider: 'facebook',
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