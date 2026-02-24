# Agrisense Backend

A scalable NestJS backend for agricultural management with comprehensive authentication, farm management, and real-time features.

## Features

- 🔐 **Complete Authentication System**
  - Email/Password registration with OTP verification
  - Google OAuth integration
  - Facebook OAuth integration
  - JWT-based authentication
  - Rate limiting with Redis

- 🚜 **Farm Management**
  - Multi-step farm registration
  - Location tracking with GPS coordinates
  - Owner information management
  - Soil type classification

- 🐳 **Docker Support**
  - PostgreSQL database
  - Redis for caching and sessions
  - Development and production configurations

- 🛡️ **Security & Performance**
  - Input validation with class-validator
  - Rate limiting with Yarn package manager
  - CORS configuration
  - Environment-based configuration

- 📚 **API Documentation**
  - Interactive Swagger/OpenAPI documentation
  - Complete request/response examples
  - Try-it-out functionality
  - Authentication testing

## Quick Start

### Prerequisites
- Node.js 18+
- Yarn (recommended) or npm
- Docker and Docker Compose
- Git

### 1. Clone and Install
```bash
git clone <repository-url>
cd agrisense-backend
yarn install
```

> **Note**: This project uses Yarn for package management. If you don't have Yarn installed, you can install it with `npm install -g yarn` or use npm commands instead.

### 2. Environment Setup
```bash
cp .env .env.local
# Edit .env.local with your configuration
```

### 3. Start Development Services
```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Start the application
yarn start:dev
```

The API will be available at `http://localhost:3000/api`

**Swagger Documentation**: `http://localhost:3000/api/docs`

## API Endpoints

### Swagger Documentation
Access the interactive API documentation at: `http://localhost:3000/api/docs`

The Swagger UI provides:
- Complete API endpoint documentation
- Request/response schemas with examples
- Try-it-out functionality for testing
- Authentication support (Bearer token)

### Authentication
```
POST /api/auth/register              # Register with email/password
POST /api/auth/login                # Login with email/password
POST /api/auth/verify-otp           # Verify email with OTP
POST /api/auth/resend-otp           # Resend OTP
GET  /api/auth/google               # Google OAuth (Web)
GET  /api/auth/facebook             # Facebook OAuth (Web)
POST /api/auth/google/verify-token  # Verify Google ID token (Mobile)
POST /api/auth/facebook/verify-token # Verify Facebook token (Mobile)
GET  /api/auth/profile              # Get user profile (protected)
```

### Farm Management
```
POST /api/farm                  # Create farm (protected)
PUT  /api/farm/location         # Update farm location (protected)
PUT  /api/farm/owner           # Update owner info (protected)
GET  /api/farm                 # Get farm details (protected)
GET  /api/farm/status          # Get registration status (protected)
```

### Community
```
POST /api/community/posts       # Create a new post (protected)
GET  /api/community/posts       # Get all posts (protected)
POST /api/community/posts/:id/like    # Like/unlike a post (protected)
POST /api/community/posts/:id/comment # Comment on a post (protected)
```

### Predictions
```
POST /api/predictions/run        # Run AI prediction + store scan/history (protected)
GET  /api/predictions/dashboard  # Get latest composition, trends, suggestions (protected)
```

### Health Check
```
GET  /api/health               # Health check endpoint
```

### Email Testing
```
POST /api/test/email           # Test email sending functionality
```

## Registration Flow

### Web Registration
1. **User Registration**: Email, username, password
2. **Email Verification**: OTP sent to email
3. **Farm Creation**: Name, size, soil type
4. **Location Setup**: Country, district, GPS coordinates
5. **Owner Information**: Name, phone, email

### Mobile OAuth Registration
1. **Social Login**: User authenticates with Google/Facebook on device
2. **Token Verification**: App sends ID/access token to backend
3. **User Creation**: Backend verifies token and creates/logs in user
4. **Farm Setup**: Same flow as web registration

## Environment Variables

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres123
DATABASE_NAME=agrisense

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Model API
MODEL_API_URL=https://agrisense-api.onrender.com
MODEL_PREDICT_PATH=/predict
MODEL_API_TIMEOUT_MS=30000
```

## Development Commands

```bash
# Development
yarn start:dev

# Build
yarn build

# Production
yarn start:prod

# Linting
yarn lint

# Testing
yarn test
yarn test:e2e
yarn test:cov
```

## Docker Commands

```bash
# Development (DB + Redis only)
docker-compose -f docker-compose.dev.yml up -d

# Full stack with app
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

## Testing with Postman

### 1. Register User
```json
POST /api/auth/register
{
  "email": "user@example.com",
  "username": "testuser",
  "password": "password123"
}
```

### 2. Verify OTP
```json
POST /api/auth/verify-otp
{
  "email": "user@example.com",
  "otp": "123456"
}
```

### 3. Login
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 4. Create Farm (with Bearer token)
```json
POST /api/farm
Authorization: Bearer <your-jwt-token>
{
  "name": "Green Valley Farm",
  "size": 25.5,
  "soilType": "loamy"
}
```

### 5. Mobile Google Authentication
```json
POST /api/auth/google/verify-token
{
  "idToken": "google-id-token-from-mobile-app"
}
```

### 6. Mobile Facebook Authentication
```json
POST /api/auth/facebook/verify-token
{
  "accessToken": "facebook-access-token-from-mobile-app"
}
```

## Database Schema

### Users Table
- id (UUID, Primary Key)
- email (Unique)
- username (Unique)
- password (Hashed)
- provider (local/google/facebook)
- isEmailVerified
- timestamps

### Farms Table
- id (UUID, Primary Key)
- name
- size (Decimal)
- soilType (Enum)
- country, district
- latitude, longitude (Optional)
- ownerName, ownerPhone, ownerEmail
- userId (Foreign Key)
- timestamps

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
