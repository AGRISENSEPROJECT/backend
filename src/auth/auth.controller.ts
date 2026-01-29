import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import { ForgotPasswordDto, VerifyResetOtpDto, ResetPasswordDto } from './dto/forgot-password.dto';
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
}