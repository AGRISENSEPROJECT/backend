# Refresh Token Implementation Guide

## What is a Refresh Token?

A refresh token system improves security by using two types of tokens:

1. **Access Token** (Short-lived: 15 minutes)
   - Used for API requests
   - Sent in Authorization header
   - Expires quickly for security

2. **Refresh Token** (Long-lived: 7 days)
   - Used to get new access tokens
   - Stored securely by client
   - Doesn't expire as quickly

## Why Use Refresh Tokens?

- **Better Security**: If an access token is stolen, it expires in 15 minutes
- **Better UX**: Users don't need to re-login every 15 minutes
- **Revocable**: Can invalidate refresh tokens on logout

---

## How It Works

### 1. Login
User logs in and receives both tokens:

**Request:**
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": "15m",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "isEmailVerified": true,
    "farmsCount": 2
  }
}
```

### 2. Use Access Token
Make API requests with access token:

```bash
GET /auth/profile
Authorization: Bearer <access_token>
```

### 3. Access Token Expires
After 15 minutes, access token expires. Client gets 401 error.

### 4. Refresh Access Token
Use refresh token to get a new access token:

**Request:**
```bash
POST /auth/refresh
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "expires_in": "15m"
}
```

### 5. Continue Using New Access Token
Use the new access token for API requests.

### 6. Logout
Revoke both tokens:

**Request:**
```bash
POST /auth/logout
Authorization: Bearer <access_token>
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## Frontend Implementation

### Store Tokens Securely

```javascript
// After login
const { access_token, refresh_token, user } = response.data;

// Store in memory or secure storage (NOT localStorage for sensitive apps)
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
```

### Axios Interceptor (Automatic Token Refresh)

```javascript
import axios from 'axios';

// Request interceptor - add access token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token expiry
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get new access token using refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post('/auth/refresh', {
          refreshToken,
        });

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh token expired - redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### React Native Implementation

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store tokens
await AsyncStorage.setItem('access_token', access_token);
await AsyncStorage.setItem('refresh_token', refresh_token);

// Get tokens
const accessToken = await AsyncStorage.getItem('access_token');
const refreshToken = await AsyncStorage.getItem('refresh_token');

// Clear on logout
await AsyncStorage.clear();
```

---

## API Endpoints

### POST /auth/login
Returns both access and refresh tokens

### POST /auth/refresh
- **Body**: `{ "refreshToken": "..." }`
- **Returns**: New access token
- **No authentication required**

### POST /auth/logout
- **Headers**: `Authorization: Bearer <access_token>`
- **Body**: `{ "refreshToken": "..." }` (optional)
- **Revokes**: Both tokens

---

## Environment Variables

```env
# Access token (short-lived)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m

# Refresh token (long-lived)
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d
```

**Important:** Use different secrets for access and refresh tokens!

---

## Security Best Practices

1. **Store refresh tokens securely**
   - Mobile: Use secure storage (Keychain/Keystore)
   - Web: HttpOnly cookies (most secure) or secure storage

2. **Never expose tokens in URLs**
   - Always use request body or headers

3. **Implement token rotation**
   - Issue new refresh token on each refresh (optional enhancement)

4. **Monitor suspicious activity**
   - Track refresh token usage
   - Revoke tokens if suspicious

5. **Use HTTPS only**
   - Never send tokens over HTTP

---

## Testing

### Test Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Test Refresh
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGc..."}'
```

### Test Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGc..."}'
```

---

## Troubleshooting

### "Invalid or expired refresh token"
- Refresh token has expired (7 days)
- Refresh token was revoked on logout
- User needs to login again

### "Token has been revoked"
- Access token was blacklisted on logout
- User needs to login again

### Access token expires too quickly
- Increase `JWT_EXPIRES_IN` in .env (e.g., `30m`, `1h`)
- Balance between security and UX
