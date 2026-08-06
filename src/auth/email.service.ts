import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as brevo from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private brevoApi: brevo.TransactionalEmailsApi;

  constructor(private configService: ConfigService) {
    // Initialize Brevo HTTP API (works on all hosting platforms including Render)
    const brevoApiKey = this.configService.get('BREVO_API_KEY');
    if (brevoApiKey) {
      const apiInstance = new brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
      this.brevoApi = apiInstance;
      console.log('🚀 Brevo HTTP API initialized');
      console.log(`📧 Sender email: nzizaprince7@gmail.com`);
    } else {
      console.log('⚠️  BREVO_API_KEY not found - emails will only be logged to console');
    }
  }

  async sendVerificationEmail(email: string, otp: string) {
    return this.sendEmail(email, otp, 'verification');
  }

  async sendPasswordResetEmail(email: string, otp: string) {
    return this.sendEmail(email, otp, 'reset');
  }

  private async sendEmail(email: string, otp: string, type: 'verification' | 'reset') {
    if (!email?.trim()) {
      console.error('❌ Refusing to send email: recipient address is missing');
      throw new Error('Recipient email is required');
    }

    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const senderEmail = 'nzizaprince7@gmail.com';
    const recipient = email.trim();

    const isVerification = type === 'verification';
    const subject = isVerification ? 'Agrisense - Email Verification' : 'Agrisense - Password Reset';
    const title = isVerification ? 'Welcome to Agrisense!' : 'Reset Your Password';
    const message = isVerification 
      ? 'Thank you for registering with Agrisense. Please use the following verification code to complete your registration:'
      : 'You requested to reset your password. Please use the following code to reset your password:';
    const disclaimer = isVerification
      ? "If you didn't create an account with Agrisense, please ignore this email."
      : "If you didn't request a password reset, please ignore this email and your password will remain unchanged.";

    // Always log OTP for debugging
    if (isDevelopment) {
      console.log('\n=================================');
      console.log(`📧 ${isVerification ? 'EMAIL VERIFICATION' : 'PASSWORD RESET'}`);
      console.log('=================================');
      console.log(`📨 To: ${recipient}`);
      console.log(`🔑 OTP: ${otp}`);
      console.log('⏰ Expires in: 10 minutes');
      console.log('=================================\n');
    } else {
      console.log(`🔑 OTP for ${recipient}: ${otp}`);
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">${title}</h2>
        <p>${message}</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2e7d32; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>${disclaimer}</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from Agrisense. Please do not reply to this email.
        </p>
      </div>
    `;

    // Send via Brevo HTTP API
    if (this.brevoApi) {
      try {
        console.log(`📤 Sending ${type} email via Brevo HTTP API to: ${recipient}`);
        console.log(`📧 From: ${senderEmail}`);
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: recipient }];
        sendSmtpEmail.sender = { email: senderEmail, name: 'Agrisense' };
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = emailHtml;
        
        const response = await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        
        console.log(`✅ Email sent successfully via Brevo to: ${recipient}`);
        console.log(`📧 Message ID: ${response.body?.messageId}`);
        return;
      } catch (error: any) {
        console.error(
          '❌ Failed to send email via Brevo:',
          error?.response?.data || error?.message || error,
        );
        console.log('📝 OTP is logged above for manual verification');
        
        // Don't throw error - just log OTP for manual verification
        return;
      }
    } else {
      console.log('⚠️  Brevo API not initialized - OTP logged above for manual verification');
    }
  }
}
