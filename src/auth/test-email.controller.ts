import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('test')
export class TestEmailController {
  constructor(private emailService: EmailService) {}

  @Post('email')
  async testEmail(@Body() body: { email: string }) {
    try {
      await this.emailService.sendVerificationEmail(body.email, '123456');
      return { message: 'Test email sent successfully' };
    } catch (error) {
      return { 
        message: 'Email sending failed', 
        error: error.message,
        details: error.stack 
      };
    }
  }
}