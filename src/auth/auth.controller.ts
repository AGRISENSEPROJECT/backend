import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  Put,
  UseInterceptors,
  UploadedFile,
  Delete,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import { ForgotPasswordDto, VerifyResetOtpDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyGoogleTokenDto, VerifyFacebookTokenDto } from './dto/verify-token.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. OTP sent to email.',
    schema: {
      example: {
        message: 'Registration successful. Please check your email for verification code.',
        userId: 'uuid-string',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        access_token: 'jwt-token-string',
        refresh_token: 'refresh-token-string',
        expires_in: '15m',
        user: {
          id: 'uuid-string',
          email: 'user@example.com',
          username: 'username',
          isEmailVerified: true,
          farmsCount: 2,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        message: 'Email verified successfully',
        user: {
          id: 'uuid-string',
          email: 'user@example.com',
          username: 'username',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        message: 'Verification code sent to your email',
      },
    },
  })
  async resendOtp(@Body() body: { email: string }) {
    return this.authService.sendEmailVerification(body.email);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset OTP sent if account exists',
    schema: {
      example: {
        message: 'If an account exists with this email, a password reset code has been sent.',
      },
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('verify-reset-otp')
  @ApiOperation({ summary: 'Verify password reset OTP' })
  @ApiBody({ type: VerifyResetOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      example: {
        message: 'OTP verified successfully. You can now reset your password.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyResetOtp(@Body() verifyResetOtpDto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(verifyResetOtpDto.email, verifyResetOtpDto.otp);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      example: {
        message: 'Password reset successfully. You can now login with your new password.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = req.user as any;
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${result?.access_token || ''}`);
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  async facebookAuth() {
    // Initiates Facebook OAuth flow
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  async facebookAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = req.user as any;
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${result?.access_token || ''}`);
  }

  @Post('google/verify-token')
  @ApiOperation({ summary: 'Verify Google ID token from mobile app' })
  @ApiBody({ type: VerifyGoogleTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Google token verified successfully',
    schema: {
      example: {
        access_token: 'jwt-token-string',
        user: {
          id: 'uuid-string',
          email: 'user@example.com',
          username: 'username',
          isEmailVerified: true,
          hasFarm: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Google token' })
  async verifyGoogleToken(@Body() verifyGoogleTokenDto: VerifyGoogleTokenDto) {
    return this.authService.verifyGoogleToken(verifyGoogleTokenDto);
  }

  @Post('facebook/verify-token')
  @ApiOperation({ summary: 'Verify Facebook access token from mobile app' })
  @ApiBody({ type: VerifyFacebookTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Facebook token verified successfully',
    schema: {
      example: {
        access_token: 'jwt-token-string',
        user: {
          id: 'uuid-string',
          email: 'user@example.com',
          username: 'username',
          isEmailVerified: true,
          hasFarm: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Facebook token' })
  async verifyFacebookToken(@Body() verifyFacebookTokenDto: VerifyFacebookTokenDto) {
    return this.authService.verifyFacebookToken(verifyFacebookTokenDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        user: {
          id: 'uuid-string',
          email: 'user@example.com',
          username: 'username',
          isEmailVerified: true,
          provider: 'local',
          createdAt: '2023-01-01T00:00:00.000Z',
          farm: null,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getProfile(@Req() req: Request) {
    return {
      user: req.user,
    };
  }

  @Put('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(@Req() req: Request, @Body() updateProfileDto: UpdateProfileDto) {
    const user = req.user as any;
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Post('profile/image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP - max 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile image uploaded successfully',
    schema: {
      example: {
        message: 'Profile image uploaded successfully',
        profileImage: 'https://res.cloudinary.com/...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadProfileImage(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Please select an image file.');
    }
    const user = req.user as any;
    return this.authService.uploadProfileImage(user.id, file);
  }

  @Delete('profile/image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete profile image' })
  @ApiResponse({
    status: 200,
    description: 'Profile image deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteProfileImage(@Req() req: Request) {
    const user = req.user as any;
    return this.authService.deleteProfileImage(user.id);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Req() req: Request, @Body() changePasswordDto: ChangePasswordDto) {
    const user = req.user as any;
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout and blacklist token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Refresh token to revoke (optional)',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Headers('authorization') authorization: string,
    @Req() req: Request,
    @Body() body?: { refreshToken?: string },
  ) {
    const user = req.user as any;
    return this.authService.logout(authorization, user.id, body?.refreshToken);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'New access token generated successfully',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_in: '15m',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }
}