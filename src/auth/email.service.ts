import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const hasSmtpConfig = this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS');
    
    if (hasSmtpConfig) {
      console.log('🔧 Initializing SMTP transporter...');
      console.log(`📧 SMTP Host: ${this.configService.get('SMTP_HOST')}`);
      console.log(`📧 SMTP Port: ${this.configService.get('SMTP_PORT')}`);
      console.log(`📧 SMTP User: ${this.configService.get('SMTP_USER')}`);
      console.log(`📧 SMTP Pass: ${this.configService.get('SMTP_PASS') ? '***configured***' : 'NOT SET'}`);
      
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: parseInt(this.configService.get('SMTP_PORT') || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
        debug: true, // Enable debug output
        logger: true, // Log to console
      });
      
      // Test the connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ SMTP connection failed:', error);
        } else {
          console.log('✅ SMTP server is ready to take our messages');
        }
      });
    } else {
      console.log('⚠️  No SMTP configuration found - emails will only be logged to console');
    }
  }

  async sendVerificationEmail(email: string, otp: string) {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const hasSmtpConfig = this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS');

    // Always log OTP in development for easy testing
    if (isDevelopment) {
      console.log('\n=================================');
      console.log('📧 EMAIL VERIFICATION');
      console.log('=================================');
      console.log(`📨 To: ${email}`);
      console.log(`🔑 OTP: ${otp}`);
      console.log('⏰ Expires in: 10 minutes');
      console.log('=================================\n');
    }

    // Send email if SMTP is configured
    if (hasSmtpConfig && this.transporter) {
      const mailOptions = {
        from: this.configService.get('SMTP_USER'),
        to: email,
        subject: 'Agrisense - Email Verification',
        html: `
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
        `,
      };

      try {
        console.log(`📤 Attempting to send email to: ${email}`);
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to: ${email}`);
        console.log(`📧 Message ID: ${info.messageId}`);
        console.log(`📧 Response: ${info.response}`);
      } catch (error) {
        console.error('❌ Failed to send email:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error response:', error.response);
        console.error('❌ Error responseCode:', error.responseCode);
        
        if (!isDevelopment) {
          throw new Error(`Failed to send verification email: ${error.message}`);
        }
        // In development, don't throw error if email fails
        console.log('📝 Email sending failed, but continuing in development mode...');
      }
    } else if (!isDevelopment) {
      throw new Error('SMTP configuration missing');
    }
  }
}