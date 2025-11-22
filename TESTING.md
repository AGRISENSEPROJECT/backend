# Agrisense Backend Testing Guide

## Prerequisites

1. **Start the development services:**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose -f docker-compose.dev.yml up -d
   
   # Start the application
   yarn start:dev
   ```

2. **Import Postman Collection:**
   - Open Postman
   - Click "Import" 
   - Select `Agrisense-API.postman_collection.json`
   - The collection will be imported with pre-configured variables

## Testing Flow

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Purpose:** Verify the API is running
- **Expected Response:** 200 OK with service status

### 2. User Registration Flow

#### Step 1: Register User
- **Endpoint:** `POST /api/auth/register`
- **Body:**
  ```json
  {
    "email": "test@agrisense.com",
    "username": "testuser",
    "password": "password123"
  }
  ```
- **Expected Response:** 201 Created with userId
- **Note:** OTP will be logged to console (check terminal)

#### Step 2: Verify OTP
- **Endpoint:** `POST /api/auth/verify-otp`
- **Body:**
  ```json
  {
    "email": "test@agrisense.com",
    "otp": "123456"
  }
  ```
- **Note:** Use the OTP from console logs or any 6-digit number for testing

#### Step 3: Login
- **Endpoint:** `POST /api/auth/login`
- **Body:**
  ```json
  {
    "email": "test@agrisense.com",
    "password": "password123"
  }
  ```
- **Expected Response:** JWT token (automatically saved to collection variable)

#### Step 4: Get Profile
- **Endpoint:** `GET /api/auth/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Expected Response:** User profile information

### 3. Farm Management Flow

#### Step 1: Check Registration Status
- **Endpoint:** `GET /api/farm/status`
- **Expected Response:** Registration status (initially no farm)

#### Step 2: Create Farm
- **Endpoint:** `POST /api/farm`
- **Body:**
  ```json
  {
    "name": "Green Valley Farm",
    "size": 25.5,
    "soilType": "loamy"
  }
  ```
- **Available Soil Types:** `clay`, `sandy`, `loamy`, `silty`, `peaty`, `chalky`

#### Step 3: Update Farm Location
- **Endpoint:** `PUT /api/farm/location`
- **Body:**
  ```json
  {
    "country": "Kenya",
    "district": "Nakuru",
    "latitude": -0.3031,
    "longitude": 36.0800
  }
  ```

#### Step 4: Update Owner Information
- **Endpoint:** `PUT /api/farm/owner`
- **Body:**
  ```json
  {
    "ownerName": "John Doe",
    "ownerPhone": "+254712345678",
    "ownerEmail": "test@agrisense.com"
  }
  ```

#### Step 5: Get Complete Farm Details
- **Endpoint:** `GET /api/farm`
- **Expected Response:** Complete farm information

#### Step 6: Check Final Status
- **Endpoint:** `GET /api/farm/status`
- **Expected Response:** `isComplete: true`

## Environment Variables for Testing

Make sure your `.env` file has these values for testing:

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
JWT_SECRET=test-secret-key
JWT_EXPIRES_IN=7d

# Email (for testing, OTP will be logged to console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@example.com
SMTP_PASS=test-password
```

## Common Issues & Solutions

### 1. Database Connection Error
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart if needed
docker-compose -f docker-compose.dev.yml restart postgres
```

### 2. Redis Connection Error
```bash
# Check if Redis is running
docker ps | grep redis

# Restart if needed
docker-compose -f docker-compose.dev.yml restart redis
```

### 3. OTP Not Working
- Check console logs for the generated OTP
- For testing, any 6-digit number should work
- Make sure email service is configured or check logs

### 4. JWT Token Issues
- Make sure the token is properly set in Postman variables
- Check token expiration (default 7 days)
- Re-login if token is expired

## Expected Test Results

### Successful Registration Flow:
1. ✅ User registered successfully
2. ✅ OTP verification successful
3. ✅ Login returns JWT token
4. ✅ Profile accessible with token

### Successful Farm Flow:
1. ✅ Initial status: `hasFarm: false`
2. ✅ Farm created successfully
3. ✅ Location updated successfully
4. ✅ Owner info updated successfully
5. ✅ Final status: `isComplete: true`

## Rate Limiting

The API has rate limiting configured:
- Short: 3 requests per second
- Medium: 20 requests per 10 seconds  
- Long: 100 requests per minute

If you hit rate limits, wait a moment before retrying.

## OAuth Testing

For Google/Facebook OAuth:
1. Configure OAuth credentials in `.env`
2. Visit the OAuth URLs in browser:
   - Google: `http://localhost:3000/api/auth/google`
   - Facebook: `http://localhost:3000/api/auth/facebook`
3. Complete OAuth flow in browser
4. Token will be in callback URL

## Database Inspection

To inspect the database directly:
```bash
# Connect to PostgreSQL
docker exec -it agrisense-postgres-dev psql -U postgres -d agrisense

# List tables
\dt

# View users
SELECT * FROM users;

# View farms
SELECT * FROM farms;
```