import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('General')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  @ApiResponse({
    status: 200,
    description: 'Welcome message',
    schema: {
      example: 'Welcome to Agrisense Backend API!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2023-01-01T00:00:00.000Z',
        service: 'Agrisense Backend',
        version: '1.0.0',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Agrisense Backend',
      version: '1.0.0',
    };
  }
}
