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
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const senderEmail = 'nzizaprince7@gmail.com';

    // Always log OTP for debugging
    if (isDevelopment) {
      console.log('\n=================================');
      console.log('📧 EMAIL VERIFICATION');
      console.log('=================================');
      console.log(`📨 To: ${email}`);
      console.log(`🔑 OTP: ${otp}`);
      console.log('⏰ Expires in: 10 minutes');
      console.log('=================================\n');
    } else {
      console.log(`🔑 OTP for ${email}: ${otp}`);
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">Welcome to Agrisense!</h2>
        <p>Thank you for registering with Agrisense. Please use the following verification code to complete your registration:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2e7d32; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't create an account with Agrisense, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from Agrisense. Please do not reply to this email.
        </p>
      </div>
    `;

    // Send via Brevo HTTP API
    if (this.brevoApi) {
      try {
        console.log(`📤 Sending email via Brevo HTTP API to: ${email}`);
        console.log(`📧 From: ${senderEmail}`);
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: email }];
        sendSmtpEmail.sender = { email: senderEmail, name: 'Agrisense' };
        sendSmtpEmail.subject = 'Agrisense - Email Verification';
        sendSmtpEmail.htmlContent = emailHtml;
        
        const response = await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        
        console.log(`✅ Email sent successfully via Brevo to: ${email}`);
        console.log(`📧 Message ID: ${response.body?.messageId}`);
        return;
      } catch (error) {
        console.error('❌ Failed to send email via Brevo:', error);
        console.error('❌ Error details:', error.response?.body || error.message);
        console.log('📝 OTP is logged above for manual verification');
        
        // Don't throw error - just log OTP for manual verification
        return;
      }
    } else {
      console.log('⚠️  Brevo API not initialized - OTP logged above for manual verification');
    }
  }
}
