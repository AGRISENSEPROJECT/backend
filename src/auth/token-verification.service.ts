import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

export interface GoogleUserInfo {
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  sub: string; // Google user ID
}

export interface FacebookUserInfo {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  picture: {
    data: {
      url: string;
    };
  };
  id: string; // Facebook user ID
}

@Injectable()
export class TokenVerificationService {
  private googleClient: OAuth2Client;

  constructor(private configService: ConfigService) {
    const googleClientId = this.configService.get('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      if (!this.googleClient) {
        throw new BadRequestException('Google OAuth not configured');
      }

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Invalid Google token');
      }

      return {
        email: payload.email || '',
        name: payload.name || '',
        given_name: payload.given_name || '',
        family_name: payload.family_name || '',
        picture: payload.picture || '',
        sub: payload.sub,
      };
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new BadRequestException('Invalid Google token');
    }
  }

  async verifyFacebookToken(accessToken: string): Promise<FacebookUserInfo> {
    try {
      const appId = this.configService.get('FACEBOOK_APP_ID');
      const appSecret = this.configService.get('FACEBOOK_APP_SECRET');

      if (!appId || !appSecret) {
        throw new BadRequestException('Facebook OAuth not configured');
      }

      // Verify token with Facebook
      const tokenVerifyUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
      const verifyResponse = await axios.get(tokenVerifyUrl);

      if (!verifyResponse.data.data.is_valid) {
        throw new BadRequestException('Invalid Facebook token');
      }

      // Get user info
      const userInfoUrl = `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${accessToken}`;
      const userResponse = await axios.get(userInfoUrl);

      return userResponse.data;
    } catch (error) {
      console.error('Facebook token verification failed:', error);
      if (error.response?.data?.error) {
        throw new BadRequestException(`Facebook API error: ${error.response.data.error.message}`);
      }
      throw new BadRequestException('Invalid Facebook token');
    }
  }
}