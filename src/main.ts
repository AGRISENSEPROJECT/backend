import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rawOrigins = process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3001';

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowAllOrigins = origins.length === 0 || origins.includes('*') || isDevelopment;

  app.enableCors({
    origin: allowAllOrigins ? true : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger setup
  const isDev = process.env.NODE_ENV === 'development';
  
  const config = new DocumentBuilder()
    .setTitle('Agrisense API')
    .setDescription(
      'Complete API documentation for Agrisense - Agricultural Management System\n\n' +
        'Features:\n' +
        '- Email/Password authentication with OTP verification\n' +
        '- Google and Facebook OAuth (Web and Mobile)\n' +
        '- Farm management with multi-step registration\n' +
        '- Location tracking and owner information\n' +
        '- JWT-based authentication\n' +
        '- Rate limiting and security features',
    )
    .setVersion('1.0')
    .addTag('General', 'General endpoints and health checks')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Farm Management', 'Farm CRUD operations and registration')
    .addTag('Community', 'Community posts, likes, and comments')
    .addTag('Testing', 'Testing and debugging endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token (without Bearer prefix)',
      },
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://agrisense-backend-pkdg.onrender.com', 'Production (Render)')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Agrisense API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
