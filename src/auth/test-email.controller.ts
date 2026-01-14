import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { EmailService } from './email.service';

@ApiTags('Testing')
@Controller('test')
export class TestEmailController {
  constructor(private emailService: EmailService) {}

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
    try {
      await this.emailService.sendVerificationEmail(body.email, '123456');
      return { message: 'Test email sent successfully' };
    } catch (error) {
      return {
        message: 'Email sending failed',
        error: error.message,
        details: error.stack,
      };
    }
  }
}
