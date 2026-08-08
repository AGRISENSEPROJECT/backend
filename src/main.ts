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
      'Production-ready API documentation for Agrisense.\n\n' +
        'Modules are grouped by business capability: Authentication, Farms, Predictions, Community, Marketplace, Suppliers, Administration, Regional Operations, Notifications, and Billing.',
    )
    .setVersion('1.0')
    .addTag('General', 'General endpoints and health checks')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Farm Management', 'Farm CRUD operations and registration')
    .addTag('Community', 'Community posts, likes, and comments')
    .addTag('Predictions', 'Model predictions, recommendations, and history')
    .addTag('Marketplace', 'Farmer product discovery, AI product matching, and orders')
    .addTag('Supplier', 'Supplier registration, profile, products, demand intelligence, and sales')
    .addTag('Admin', 'User administration, approvals, announcements, and audit logs')
    .addTag('NGO', 'Regional NGO dashboards, programs, and reports')
    .addTag('Government', 'National and regional analytics, advisories, and reports')
    .addTag('Notifications', 'User notification inbox and read states')
    .addTag('Waitlist', 'Public early-access waitlist and promotional checklist emails')
    .addTag(
      'Billing',
      'Subscription plans, Pro checkout (Flutterwave MoMo/Airtel/card), webhooks, enterprise leads, and admin assign/revoke. Currency: RWF.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token (without Bearer prefix)',
      },
    )
    .addServer('/', 'Current host (use this)')
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://agrisense.rw', 'Production')
    .addServer('http://102.202.208.198', 'VPS (IP fallback)')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Agrisense API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
