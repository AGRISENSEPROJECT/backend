import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, AuthProvider } from '../entities/user.entity';
import { RegisterDto, SocialRegisterDto } from './dto/register.dto';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';
import { TokenVerificationService } from './token-verification.service';
import { VerifyGoogleTokenDto, VerifyFacebookTokenDto } from './dto/verify-token.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private redisService: RedisService,
    private tokenVerificationService: TokenVerificationService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, username, password } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      provider: AuthProvider.LOCAL,
    });

    await this.userRepository.save(user);

    // Generate and send OTP
    await this.sendEmailVerification(email);

    return {
      message: 'Registration successful. Please check your email for verification code.',
      userId: user.id,
    };
  }

  async socialRegister(socialRegisterDto: SocialRegisterDto) {
    const { email, username, provider, providerId } = socialRegisterDto;

    // Check if user exists
    let user = await this.userRepository.findOne({
      where: [{ email }, { providerId }],
    });

    if (user) {
      // User exists, just login
      return this.generateTokens(user);
    }

    // Create new user
    user = this.userRepository.create({
      email,
      username,
      provider: provider as AuthProvider,
      providerId,
      isEmailVerified: true, // Social accounts are pre-verified
    });

    await this.userRepository.save(user);
    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    return this.generateTokens(user);
  }

  async sendEmailVerification(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in Redis with 10 minutes expiry
    await this.redisService.set(`otp:${email}`, otp, 600);

    // Send email
    await this.emailService.sendVerificationEmail(email, otp);

    return { message: 'Verification code sent to your email' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const storedOtp = await this.redisService.get(`otp:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Update user verification status
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.isEmailVerified = true;
    await this.userRepository.save(user);

    // Delete OTP from Redis
    await this.redisService.del(`otp:${email}`);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async validateUser(payload: any): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['farm'],
    });
    
    if (!user) {
      throw new UnauthorizedException();
    }
    
    return user;
  }

  async verifyGoogleToken(verifyGoogleTokenDto: VerifyGoogleTokenDto) {
    const { idToken } = verifyGoogleTokenDto;

    try {
      const googleUser = await this.tokenVerificationService.verifyGoogleToken(idToken);
      
      // Check if user exists
      let user = await this.userRepository.findOne({
        where: [
          { email: googleUser.email },
          { providerId: googleUser.sub, provider: AuthProvider.GOOGLE }
        ],
        relations: ['farm'],
      });

      if (user) {
        // Update user info if needed
        if (!user.providerId && user.provider === AuthProvider.LOCAL) {
          user.provider = AuthProvider.GOOGLE;
          user.providerId = googleUser.sub;
          user.isEmailVerified = true;
          await this.userRepository.save(user);
        }
        return this.generateTokens(user);
      }

      // Create new user
      const username = this.generateUsernameFromEmail(googleUser.email);
      user = this.userRepository.create({
        email: googleUser.email,
        username,
        provider: AuthProvider.GOOGLE,
        providerId: googleUser.sub,
        isEmailVerified: true,
      });

      await this.userRepository.save(user);
      console.log(`✅ New Google user created: ${googleUser.email}`);
      
      return this.generateTokens(user);
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new BadRequestException('Invalid Google token');
    }
  }

  async verifyFacebookToken(verifyFacebookTokenDto: VerifyFacebookTokenDto) {
    const { accessToken } = verifyFacebookTokenDto;

    try {
      const facebookUser = await this.tokenVerificationService.verifyFacebookToken(accessToken);
      
      if (!facebookUser.email) {
        throw new BadRequestException('Facebook account must have an email address');
      }

      // Check if user exists
      let user = await this.userRepository.findOne({
        where: [
          { email: facebookUser.email },
          { providerId: facebookUser.id, provider: AuthProvider.FACEBOOK }
        ],
        relations: ['farm'],
      });

      if (user) {
        // Update user info if needed
        if (!user.providerId && user.provider === AuthProvider.LOCAL) {
          user.provider = AuthProvider.FACEBOOK;
          user.providerId = facebookUser.id;
          user.isEmailVerified = true;
          await this.userRepository.save(user);
        }
        return this.generateTokens(user);
      }

      // Create new user
      const username = this.generateUsernameFromEmail(facebookUser.email);
      user = this.userRepository.create({
        email: facebookUser.email,
        username,
        provider: AuthProvider.FACEBOOK,
        providerId: facebookUser.id,
        isEmailVerified: true,
      });

      await this.userRepository.save(user);
      console.log(`✅ New Facebook user created: ${facebookUser.email}`);
      
      return this.generateTokens(user);
    } catch (error) {
      console.error('Facebook token verification failed:', error);
      throw new BadRequestException('Invalid Facebook token');
    }
  }

  private generateUsernameFromEmail(email: string): string {
    const baseUsername = email.split('@')[0].toLowerCase();
    const randomSuffix = Math.floor(Math.random() * 1000);
    return `${baseUsername}_${randomSuffix}`;
  }

  private async generateTokens(user: User) {
    const payload = { email: user.email, sub: user.id, username: user.username };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        hasFarm: !!user.farm,
      },
    };
  }
}