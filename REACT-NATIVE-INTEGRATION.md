# React Native Integration Guide

This guide shows how to integrate the Agrisense backend with React Native mobile apps using the new token verification endpoints.

## Overview

The backend now supports both web and mobile authentication flows:
- **Web**: Traditional OAuth redirects
- **Mobile**: Token verification (recommended for React Native)

## Mobile Authentication Flow

### Google Sign-In Flow
1. User taps "Sign in with Google" in React Native app
2. App uses `@react-native-google-signin/google-signin` to authenticate
3. App receives Google ID token
4. App sends token to backend for verification
5. Backend returns JWT token for API access

### Facebook Sign-In Flow
1. User taps "Sign in with Facebook" in React Native app
2. App uses `react-native-fbsdk-next` to authenticate
3. App receives Facebook access token
4. App sends token to backend for verification
5. Backend returns JWT token for API access

## React Native Setup

### 1. Install Required Packages

```bash
npm install @react-native-google-signin/google-signin
npm install react-native-fbsdk-next
```

### 2. Configure Google Sign-In

**Android Setup:**
1. Add `google-services.json` to `android/app/`
2. Configure `android/build.gradle` and `android/app/build.gradle`

**iOS Setup:**
1. Add `GoogleService-Info.plist` to iOS project
2. Configure URL schemes in `Info.plist`

### 3. Configure Facebook SDK

**Android Setup:**
1. Add Facebook App ID to `android/app/src/main/res/values/strings.xml`
2. Configure `AndroidManifest.xml`

**iOS Setup:**
1. Add Facebook App ID to `Info.plist`
2. Configure URL schemes

## Implementation Examples

### Google Sign-In Component

```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'your-google-web-client-id', // From Google Console
  offlineAccess: true,
});

const GoogleSignInButton = () => {
  const signInWithGoogle = async () => {
    try {
      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices();
      
      // Sign in and get user info
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken;
      
      // Send token to your backend
      const response = await fetch('http://your-backend-url/api/auth/google/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Store JWT token for API calls
        await AsyncStorage.setItem('authToken', result.access_token);
        console.log('Login successful:', result.user);
        // Navigate to main app
      } else {
        console.error('Login failed:', result.message);
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
    }
  };

  return (
    <TouchableOpacity onPress={signInWithGoogle}>
      <Text>Sign in with Google</Text>
    </TouchableOpacity>
  );
};
```

### Facebook Sign-In Component

```javascript
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';

const FacebookSignInButton = () => {
  const signInWithFacebook = async () => {
    try {
      // Request Facebook login
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      
      if (result.isCancelled) {
        console.log('Facebook login cancelled');
        return;
      }
      
      // Get access token
      const data = await AccessToken.getCurrentAccessToken();
      
      if (!data) {
        console.error('Failed to get Facebook access token');
        return;
      }
      
      // Send token to your backend
      const response = await fetch('http://your-backend-url/api/auth/facebook/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: data.accessToken }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Store JWT token for API calls
        await AsyncStorage.setItem('authToken', result.access_token);
        console.log('Login successful:', result.user);
        // Navigate to main app
      } else {
        console.error('Login failed:', result.message);
      }
    } catch (error) {
      console.error('Facebook Sign-In error:', error);
    }
  };

  return (
    <TouchableOpacity onPress={signInWithFacebook}>
      <Text>Sign in with Facebook</Text>
    </TouchableOpacity>
  );
};
```

### API Service with JWT

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiService {
  constructor() {
    this.baseURL = 'http://your-backend-url/api';
  }

  async getAuthToken() {
    return await AsyncStorage.getItem('authToken');
  }

  async makeAuthenticatedRequest(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (response.status === 401) {
      // Token expired, redirect to login
      await AsyncStorage.removeItem('authToken');
      // Navigate to login screen
    }
    
    return response;
  }

  // Farm management methods
  async createFarm(farmData) {
    return this.makeAuthenticatedRequest('/farm', {
      method: 'POST',
      body: JSON.stringify(farmData),
    });
  }

  async getFarmStatus() {
    return this.makeAuthenticatedRequest('/farm/status');
  }

  async updateFarmLocation(locationData) {
    return this.makeAuthenticatedRequest('/farm/location', {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  }
}

export default new ApiService();
```

## Backend Endpoints for Mobile

### Google Token Verification
```
POST /api/auth/google/verify-token
Content-Type: application/json

{
  "idToken": "google-id-token-from-mobile"
}

Response:
{
  "access_token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "isEmailVerified": true,
    "hasFarm": false
  }
}
```

### Facebook Token Verification
```
POST /api/auth/facebook/verify-token
Content-Type: application/json

{
  "accessToken": "facebook-access-token-from-mobile"
}

Response:
{
  "access_token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "isEmailVerified": true,
    "hasFarm": false
  }
}
```

## Environment Configuration

Make sure your backend `.env` file has the OAuth credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## Testing

1. **Use Postman** to test the token verification endpoints
2. **Mock tokens** for development (backend will validate in production)
3. **Test error handling** for invalid tokens
4. **Verify JWT tokens** work with protected endpoints

## Security Notes

- ID tokens are verified server-side using Google's official library
- Facebook tokens are verified against Facebook's API
- JWT tokens have configurable expiration (default: 7 days)
- All social authentication creates verified users (no email verification needed)
- Existing email users can link social accounts

## Troubleshooting

### Common Issues:
1. **Invalid Google token**: Check client ID configuration
2. **Facebook token expired**: Tokens have short lifespans
3. **Network errors**: Check backend URL and connectivity
4. **JWT expired**: Implement token refresh or re-authentication

### Debug Tips:
- Check backend logs for detailed error messages
- Use Postman to test endpoints directly
- Verify OAuth app configurations in Google/Facebook consoles
- Test with real devices (not just simulators)