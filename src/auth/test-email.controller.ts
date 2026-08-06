import { Controller, Post, Body } from '@nestjs/common';
import { ApiExcludeController, ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@ApiTags('Testing')
@ApiExcludeController()
@Controller('test')
export class TestEmailController {
  constructor(
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  @Post('email')
  @ApiOperation({ summary: 'Test email sending functionality' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'test@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    schema: {
      example: {
        message: 'Test email sent successfully',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Email sending failed',
    schema: {
      example: {
        message: 'Email sending failed',
        error: 'Error message',
      },
    },
  })
  async testEmail(@Body() body: { email: string }) {
    const hasBrevoKey = !!this.configService.get('BREVO_API_KEY');
    const brevoKey = this.configService.get<string>('BREVO_API_KEY') ?? '';
    const looksLikeSmtpKey = brevoKey.startsWith('xsmtpsib-');

    console.log('🧪 Testing email configuration...');
    console.log(`📧 BREVO_API_KEY configured: ${hasBrevoKey}`);
    if (looksLikeSmtpKey) {
      console.log(
        '⚠️  BREVO_API_KEY looks like an SMTP key (xsmtpsib-). Use an API key (xkeysib-) instead.',
      );
    }

    try {
      await this.emailService.sendVerificationEmail(body.email, '123456');
      return {
        message: 'Test email attempted (check server logs for Brevo success/failure)',
        hint: looksLikeSmtpKey
          ? 'Your BREVO_API_KEY starts with xsmtpsib- (SMTP). Replace it with an xkeysib- API key.'
          : undefined,
      };
    } catch (error) {
      console.error('🚨 Detailed error:', error);
      return {
        message: 'Email sending failed',
        error: error instanceof Error ? error.message : String(error),
        config: {
          hasBrevoKey,
          looksLikeSmtpKey,
        },
      };
    }
  }
}
