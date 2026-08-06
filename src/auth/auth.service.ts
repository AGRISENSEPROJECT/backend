import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, AuthProvider } from '../entities/user.entity';
import { RegisterDto, SocialRegisterDto, IdentityVerificationDto } from './dto/register.dto';
import { OnboardingFarmDto } from './dto/onboarding.dto';
import { Farm } from '../entities/farm.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { IdentityVerificationStatus } from '../common/enums/identity-verification-status.enum';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';
import { CloudinaryService } from './cloudinary.service';
import { TokenVerificationService } from './token-verification.service';
import { VerifyGoogleTokenDto, VerifyFacebookTokenDto } from './dto/verify-token.dto';
import { AuditService } from '../common/services/audit.service';
import { AuditAction } from '../entities/audit-log.entity';
import { NATIONAL_ID_REGEX } from '../common/validators/password.validator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Farm)
    private farmRepository: Repository<Farm>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private redisService: RedisService,
    private cloudinaryService: CloudinaryService,
    private tokenVerificationService: TokenVerificationService,
    private auditService: AuditService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phoneNumber } = registerDto;

    const duplicateConditions: Array<{ email?: string; phoneNumber?: string }> = [{ email }];
    if (phoneNumber) {
      duplicateConditions.push({ phoneNumber });
    }

    const existingUser = await this.userRepository.findOne({
      where: duplicateConditions,
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone number already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      provider: AuthProvider.LOCAL,
      role: UserRole.FARMER,
      status: UserStatus.PENDING,
      onboardingStep: 1,
      onboardingCompleted: false,
    });

    await this.userRepository.save(user);
    await this.sendEmailVerification(email);
    await this.auditService.log(AuditAction.REGISTER, user.id, email);

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
      onboardingStep: 1,
    };
  }

  async verifyIdentity(userId: string, dto: IdentityVerificationDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role !== UserRole.FARMER) {
      throw new BadRequestException('Identity verification is only for farmers');
    }

    if (user.nationalIdVerified) {
      throw new BadRequestException('National ID already verified and cannot be changed');
    }

    if (!NATIONAL_ID_REGEX.test(dto.nationalId)) {
      throw new BadRequestException('National ID must be 16 digits');
    }

    const existingNationalId = await this.userRepository.findOne({
      where: { nationalId: dto.nationalId },
    });
    if (existingNationalId && existingNationalId.id !== userId) {
      throw new ConflictException('National ID is already registered');
    }

    user.nationalId = dto.nationalId;
    user.documentType = dto.documentType;
    if (dto.idImageUrl) user.idImageUrl = dto.idImageUrl;
    user.identityVerificationStatus = IdentityVerificationStatus.VERIFIED;
    user.nationalIdVerified = true;
    user.onboardingStep = 3;
    await this.userRepository.save(user);

    return {
      message: 'Identity verified successfully',
      onboardingStep: 3,
      identityVerificationStatus: user.identityVerificationStatus,
    };
  }

  async completeOnboardingFarm(userId: string, dto: OnboardingFarmDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role !== UserRole.FARMER) {
      throw new BadRequestException('Farm onboarding is only for farmers');
    }

    if (!user.nationalId) {
      throw new BadRequestException('Complete identity verification first');
    }

    const farm = this.farmRepository.create({
      name: dto.name,
      size: dto.size,
      soilType: dto.soilType,
      country: 'Rwanda',
      province: dto.province,
      district: dto.district,
      sector: dto.sector,
      cell: dto.cell,
      village: dto.village,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ownerName: `${user.firstName} ${user.lastName}`,
      ownerPhone: user.phoneNumber,
      ownerEmail: user.email,
      userId,
      user,
      isActive: true,
    });

    await this.farmRepository.save(farm);

    user.onboardingStep = 3;
    user.onboardingCompleted = true;
    user.status = UserStatus.ACTIVE;
    user.activeFarmId = farm.id;
    await this.userRepository.save(user);

    return {
      message: 'Onboarding completed successfully',
      onboardingStep: 3,
      onboardingCompleted: true,
      farmId: farm.id,
    };
  }

  async getOnboardingStatus(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      onboardingStep: user.onboardingStep,
      onboardingCompleted: user.onboardingCompleted,
      identityVerificationStatus: user.identityVerificationStatus,
      nationalIdVerified: user.nationalIdVerified,
      role: user.role,
      status: user.status,
    };
  }

  async socialRegister(socialRegisterDto: SocialRegisterDto) {
    const { email, provider, providerId, firstName, lastName } = socialRegisterDto;

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
      firstName,
      lastName,
      provider: provider as AuthProvider,
      providerId,
      isEmailVerified: true,
      role: UserRole.FARMER,
      status: UserStatus.ACTIVE,
      onboardingStep: 1,
      onboardingCompleted: false,
    });

    await this.userRepository.save(user);
    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const { email, phoneNumber, password } = loginDto;

    if (!email && !phoneNumber) {
      throw new BadRequestException('Email or phone number is required');
    }

    let user: User | null = null;
    const loginIdentifier = email || phoneNumber || '';

    if (email) {
      user = await this.userRepository.findOne({
        where: { email },
        relations: ['farms'],
      });
    } else if (phoneNumber) {
      user = await this.userRepository.findOne({
        where: { phoneNumber },
        relations: ['farms'],
      });
      if (user && user.role !== UserRole.FARMER) {
        throw new UnauthorizedException('Phone login is only available for farmers');
      }
    }

    if (!user || !user.password) {
      await this.auditService.log(AuditAction.LOGIN_FAILED, undefined, loginIdentifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.log(AuditAction.LOGIN_FAILED, user.id, loginIdentifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    // If email not verified, send OTP and return special response
    if (!user.isEmailVerified) {
      await this.sendEmailVerification(user.email);
      return {
        isEmailVerified: false,
        message: 'Email not verified. A new verification code has been sent to your email.',
        userId: user.id,
        email: user.email,
      };
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.LOGIN, user.id, loginIdentifier);

    return this.generateTokens(user);
  }

  async sendEmailVerification(email: string) {
    const trimmed = email?.trim();
    if (!trimmed) {
      throw new BadRequestException('Email is required to send a verification code');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in Redis with 10 minutes expiry
    await this.redisService.set(`otp:${trimmed}`, otp, 600);

    // Send email
    await this.emailService.sendVerificationEmail(trimmed, otp);

    return { message: 'Verification code sent to your email' };
  }

  async resendEmailVerification(body: { email?: string; userId?: string }) {
    let email = body.email?.trim();

    if (!email && body.userId) {
      const user = await this.userRepository.findOne({
        where: { id: body.userId },
      });
      if (!user?.email) {
        throw new BadRequestException(
          'Could not find an account to resend the verification code',
        );
      }
      email = user.email;
    }

    if (!email) {
      throw new BadRequestException(
        'Email is required to resend the verification code',
      );
    }

    return this.sendEmailVerification(email);
  }

  async forgotPassword(email: string) {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('No account found with this email address.');
    }

    // Only allow password reset for local auth users
    if (user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException(`This account uses ${user.provider} authentication. Please use ${user.provider} to sign in.`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in Redis with 10 minutes expiry
    await this.redisService.set(`reset:${email}`, otp, 600);

    // Send email
    await this.emailService.sendPasswordResetEmail(email, otp);

    return { message: 'Password reset code has been sent to your email.' };
  }

  async verifyResetOtp(email: string, otp: string) {
    const storedOtp = await this.redisService.get(`reset:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    return { message: 'OTP verified successfully. You can now reset your password.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    // Verify OTP
    const storedOtp = await this.redisService.get(`reset:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Only allow password reset for local auth users
    if (user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException(`This account uses ${user.provider} authentication.`);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Delete OTP from Redis
    await this.redisService.del(`reset:${email}`);
    await this.auditService.log(AuditAction.PASSWORD_RESET, user.id, email);

    return { message: 'Password reset successfully. You can now login with your new password.' };
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
    if (user.role === UserRole.FARMER && user.status === UserStatus.PENDING) {
      user.onboardingStep = 2;
    }
    await this.userRepository.save(user);

    await this.redisService.del(`otp:${email}`);
    await this.auditService.log(AuditAction.EMAIL_VERIFY, user.id, email);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async validateUser(payload: any): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['farms'],
    });
    
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
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
        relations: ['farms'],
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
      user = this.userRepository.create({
        email: googleUser.email,
        firstName: googleUser.given_name || undefined,
        lastName: googleUser.family_name || undefined,
        provider: AuthProvider.GOOGLE,
        providerId: googleUser.sub,
        isEmailVerified: true,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        onboardingStep: 1,
        onboardingCompleted: false,
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
        relations: ['farms'],
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
      user = this.userRepository.create({
        email: facebookUser.email,
        firstName: facebookUser.first_name || undefined,
        lastName: facebookUser.last_name || undefined,
        provider: AuthProvider.FACEBOOK,
        providerId: facebookUser.id,
        isEmailVerified: true,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        onboardingStep: 1,
        onboardingCompleted: false,
      });

      await this.userRepository.save(user);
      console.log(`✅ New Facebook user created: ${facebookUser.email}`);
      
      return this.generateTokens(user);
    } catch (error) {
      console.error('Facebook token verification failed:', error);
      throw new BadRequestException('Invalid Facebook token');
    }
  }

  private mapUserProfile(user: User, farmsCount = 0) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      phoneNumber: user.phoneNumber,
      profileImage: user.profileImage,
      nationalId: user.nationalIdVerified ? user.nationalId : undefined,
      nationalIdVerified: user.nationalIdVerified,
      identityVerificationStatus: user.identityVerificationStatus,
      isEmailVerified: user.isEmailVerified,
      onboardingStep: user.onboardingStep,
      onboardingCompleted: user.onboardingCompleted,
      activeFarmId: user.activeFarmId,
      assignedRegions: user.assignedRegions,
      provider: user.provider,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      farmsCount,
    };
  }

  private async generateTokens(user: User) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };
    
    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Store refresh token in Redis with expiry
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await this.redisService.set(`refresh:${user.id}:${refreshToken}`, 'valid', refreshTokenExpiry);
    
    const farmsCount = user.farms ? user.farms.length : 0;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.configService.get('JWT_EXPIRES_IN') || '15m',
      user: this.mapUserProfile(user, farmsCount),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in Redis (not revoked)
      const isValid = await this.redisService.exists(`refresh:${payload.sub}:${refreshToken}`);
      if (!isValid) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Get user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['farms'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role,
      };
      const accessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
      });

      return {
        access_token: accessToken,
        expires_in: this.configService.get('JWT_EXPIRES_IN') || '15m',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async revokeRefreshToken(userId: string, refreshToken: string) {
    // Remove refresh token from Redis
    await this.redisService.del(`refresh:${userId}:${refreshToken}`);
    return { message: 'Refresh token revoked successfully' };
  }

  async getFullProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['farms'],
    });
    if (!user) throw new BadRequestException('User not found');
    const farmsCount = user.farms?.length || 0;
    return { user: this.mapUserProfile(user, farmsCount) };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check phone uniqueness if updating
    if (updateProfileDto.phoneNumber && updateProfileDto.phoneNumber !== user.phoneNumber) {
      const existingUser = await this.userRepository.findOne({
        where: { phoneNumber: updateProfileDto.phoneNumber },
      });
      if (existingUser) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // Update fields
    if (updateProfileDto.phoneNumber !== undefined) user.phoneNumber = updateProfileDto.phoneNumber;
    if (updateProfileDto.firstName) user.firstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName) user.lastName = updateProfileDto.lastName;

    await this.userRepository.save(user);

    return {
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        profileImage: user.profileImage,
      },
    };
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Delete old image if exists
    if (user.profileImage) {
      await this.cloudinaryService.deleteImage(user.profileImage);
    }

    // Upload new image
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    user.profileImage = imageUrl;
    await this.userRepository.save(user);

    return {
      message: 'Profile image uploaded successfully',
      profileImage: imageUrl,
    };
  }

  async deleteProfileImage(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.profileImage) {
      throw new BadRequestException('No profile image to delete');
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteImage(user.profileImage);
    user.profileImage = null;
    await this.userRepository.save(user);

    return { message: 'Profile image deleted successfully' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user uses local auth
    if (user.provider !== AuthProvider.LOCAL || !user.password) {
      throw new BadRequestException(`This account uses ${user.provider} authentication and cannot change password.`);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);
    user.password = hashedPassword;
    await this.userRepository.save(user);
    await this.auditService.log(AuditAction.PASSWORD_CHANGE, userId, user.email);

    return { message: 'Password changed successfully' };
  }

  async logout(token: string, userId: string, refreshToken?: string) {
    // Extract token without 'Bearer ' prefix
    const cleanToken = token.replace('Bearer ', '');
    
    // Decode token to get expiry
    const decoded = this.jwtService.decode(cleanToken) as any;
    if (!decoded || !decoded.exp) {
      throw new BadRequestException('Invalid token');
    }

    // Calculate TTL (time until token expires)
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;

    if (ttl > 0) {
      // Blacklist access token in Redis until it expires
      await this.redisService.set(`blacklist:${cleanToken}`, 'true', ttl);
    }

    // Revoke refresh token if provided
    if (refreshToken) {
      await this.revokeRefreshToken(userId, refreshToken);
    }

    await this.auditService.log(AuditAction.LOGOUT, userId);

    return { message: 'Logged out successfully' };
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const cleanToken = token.replace('Bearer ', '');
    const isBlacklisted = await this.redisService.exists(`blacklist:${cleanToken}`);
    return isBlacklisted;
  }
}