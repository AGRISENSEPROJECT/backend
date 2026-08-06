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

  async sendWaitlistWelcomeEmail(input: {
    email: string;
    fullName: string;
    interest?: string;
    province?: string | null;
  }) {
    const recipient = input.email?.trim();
    if (!recipient) {
      throw new Error('Recipient email is required');
    }

    const firstName = input.fullName?.trim().split(/\s+/)[0] || 'there';
    const interestLabel = this.formatInterest(input.interest);
    const provinceLine = input.province
      ? `We noted your interest from <strong>${this.escapeHtml(input.province)}</strong>.`
      : 'We are building AgriSense for farmers, suppliers, NGOs, and government partners across Rwanda.';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://agrisense.rw';
    const subject = 'Welcome to the AgriSense waitlist — smarter farming starts here';
    const emailHtml = this.buildWaitlistWelcomeHtml({
      firstName,
      fullName: input.fullName || firstName,
      interestLabel,
      provinceLine,
      frontendUrl,
    });

    console.log(`📧 Waitlist welcome email queued for: ${recipient}`);
    await this.sendHtmlEmail(recipient, subject, emailHtml);
  }

  private formatInterest(interest?: string) {
    switch ((interest || '').toUpperCase()) {
      case 'SUPPLIER':
        return 'Agricultural Supplier';
      case 'NGO':
        return 'NGO / Development Partner';
      case 'GOVERNMENT':
        return 'Government / Policy Partner';
      case 'OTHER':
        return 'Platform Partner';
      default:
        return 'Farmer / Farm Owner';
    }
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildWaitlistWelcomeHtml(input: {
    firstName: string;
    fullName: string;
    interestLabel: string;
    provinceLine: string;
    frontendUrl: string;
  }) {
    const safeFirst = this.escapeHtml(input.firstName);
    const safeFull = this.escapeHtml(input.fullName);
    const safeInterest = this.escapeHtml(input.interestLabel);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to AgriSense</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f2;font-family:Georgia,'Times New Roman',serif;color:#1f2a1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f2;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(22,62,33,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1b5e20 0%,#2e7d32 55%,#66bb6a 100%);padding:36px 32px 28px 32px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;font-family:Arial,Helvetica,sans-serif;">AgriSense Waitlist</div>
              <h1 style="margin:14px 0 8px 0;font-size:32px;line-height:1.2;font-weight:700;">Welcome, ${safeFirst}</h1>
              <p style="margin:0;font-size:16px;line-height:1.6;opacity:0.95;font-family:Arial,Helvetica,sans-serif;">
                You are officially on the early-access checklist for Rwanda’s smart agriculture platform.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 32px 10px 32px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334033;">
                Hi ${safeFull}, thank you for registering your interest as a
                <strong style="color:#1b5e20;">${safeInterest}</strong>.
                ${input.provinceLine}
              </p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#334033;">
                AgriSense helps farms grow smarter with AI disease prediction, farm-centric records,
                marketplace matching, community knowledge, and regional decision support for partners.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fbf6;border:1px solid #d7e8d5;border-radius:14px;">
                <tr>
                  <td style="padding:22px 22px 8px 22px;">
                    <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#2e7d32;font-weight:700;">What you get with AgriSense</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <ul style="margin:0;padding-left:18px;color:#2d3a2d;font-size:14px;line-height:1.8;">
                      <li><strong>AI crop disease prediction</strong> — upload field images and receive confidence-scored insights with recommended treatments.</li>
                      <li><strong>Farm-centric management</strong> — manage multiple farms, soil data, crop history, irrigation methods, and harvest visibility in one place.</li>
                      <li><strong>Smart marketplace</strong> — match AI recommendations with verified suppliers for seeds, fertilizer, pesticides, tools, and equipment.</li>
                      <li><strong>Farmer community</strong> — share posts, join conversations, get peer advice, and stay connected with agricultural peers.</li>
                      <li><strong>Regional intelligence</strong> — NGOs and government partners monitor disease trends, program adoption, and district-level productivity.</li>
                      <li><strong>Real-time notifications</strong> — stay informed on predictions, orders, advisories, and community activity.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
              <h2 style="margin:0 0 12px 0;font-size:20px;color:#1b5e20;">Why early waitlist members matter</h2>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#334033;">
                As a waitlist member, you are among the first to shape AgriSense before general launch.
                Your feedback helps us refine prediction quality, marketplace matching, onboarding, and regional tools.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" valign="top" style="padding:6px 6px 6px 0;">
                    <div style="background:#ffffff;border:1px solid #e1ebe0;border-radius:12px;padding:16px;">
                      <div style="font-size:13px;font-weight:700;color:#1b5e20;margin-bottom:6px;">Early access priority</div>
                      <div style="font-size:13px;line-height:1.6;color:#445044;">Be first in line when farmer, supplier, NGO, and government onboarding opens.</div>
                    </div>
                  </td>
                  <td width="50%" valign="top" style="padding:6px 0 6px 6px;">
                    <div style="background:#ffffff;border:1px solid #e1ebe0;border-radius:12px;padding:16px;">
                      <div style="font-size:13px;font-weight:700;color:#1b5e20;margin-bottom:6px;">Product influence</div>
                      <div style="font-size:13px;line-height:1.6;color:#445044;">Tell us which crops, regions, and workflows matter most for your day-to-day work.</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="padding:6px 6px 6px 0;">
                    <div style="background:#ffffff;border:1px solid #e1ebe0;border-radius:12px;padding:16px;">
                      <div style="font-size:13px;font-weight:700;color:#1b5e20;margin-bottom:6px;">Practical benefits</div>
                      <div style="font-size:13px;line-height:1.6;color:#445044;">Reduce guesswork, improve input planning, and protect yields with earlier disease signals.</div>
                    </div>
                  </td>
                  <td width="50%" valign="top" style="padding:6px 0 6px 6px;">
                    <div style="background:#ffffff;border:1px solid #e1ebe0;border-radius:12px;padding:16px;">
                      <div style="font-size:13px;font-weight:700;color:#1b5e20;margin-bottom:6px;">Trusted ecosystem</div>
                      <div style="font-size:13px;line-height:1.6;color:#445044;">Connect farmers, suppliers, NGOs, and government around one farm-centric platform.</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 32px 10px 32px;font-family:Arial,Helvetica,sans-serif;">
              <div style="background:#102915;border-radius:14px;padding:24px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.8;">Your checklist</div>
                <h3 style="margin:10px 0 12px 0;font-size:20px;">What happens next</h3>
                <ol style="margin:0;padding-left:18px;font-size:14px;line-height:1.8;opacity:0.95;">
                  <li>We confirm your waitlist registration (this email).</li>
                  <li>Our team reviews regional demand and partner readiness.</li>
                  <li>You receive launch updates, onboarding invites, and feature previews.</li>
                  <li>When access opens for your role, you get priority registration instructions.</li>
                </ol>
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
              <a href="${input.frontendUrl}" style="display:inline-block;background:#2e7d32;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;">
                Visit AgriSense
              </a>
              <p style="margin:14px 0 0 0;font-size:12px;color:#6b776b;">
                Or open <a href="${input.frontendUrl}" style="color:#2e7d32;">${input.frontendUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.7;color:#334033;">
                If this email reached the wrong person, you can ignore it — no account has been created yet.
                You are only on the waitlist checklist.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#334033;">
                Together, we can make agricultural decisions clearer, faster, and more resilient.
              </p>
              <p style="margin:18px 0 0 0;font-size:14px;color:#1b5e20;font-weight:700;">
                — The AgriSense Team
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f0f4ef;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #dde7db;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#6d776d;">
                This is an automated message from AgriSense. Please do not reply directly to this email.
                For support, visit ${input.frontendUrl}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private async sendHtmlEmail(email: string, subject: string, emailHtml: string) {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const senderEmail = 'nzizaprince7@gmail.com';
    const recipient = email.trim();

    if (isDevelopment) {
      console.log('\n=================================');
      console.log('📧 WAITLIST / HTML EMAIL');
      console.log('=================================');
      console.log(`📨 To: ${recipient}`);
      console.log(`📝 Subject: ${subject}`);
      console.log('=================================\n');
    }

    if (this.brevoApi) {
      try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: recipient }];
        sendSmtpEmail.sender = { email: senderEmail, name: 'Agrisense' };
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = emailHtml;
        const response = await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ HTML email sent via Brevo to: ${recipient}`);
        console.log(`📧 Message ID: ${response.body?.messageId}`);
        return;
      } catch (error: any) {
        console.error(
          '❌ Failed to send HTML email via Brevo:',
          error?.response?.data || error?.message || error,
        );
        return;
      }
    }

    console.log('⚠️  Brevo API not initialized - HTML email logged only');
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
