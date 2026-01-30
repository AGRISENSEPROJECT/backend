# Cloudinary Setup Guide

## Why Cloudinary?
- **Free tier**: 25GB storage + 25GB bandwidth/month
- **Automatic image optimization**: Resizes and compresses images
- **CDN delivery**: Fast image loading worldwide
- **Easy integration**: Simple API

## Setup Steps

### 1. Create Cloudinary Account
1. Go to https://cloudinary.com/users/register_free
2. Sign up for a free account
3. Verify your email

### 2. Get Your Credentials
1. Go to your Cloudinary Dashboard: https://console.cloudinary.com/
2. You'll see your credentials:
   - **Cloud Name**: e.g., `dxyz123abc`
   - **API Key**: e.g., `123456789012345`
   - **API Secret**: e.g., `abcdefghijklmnopqrstuvwxyz123`

### 3. Add to Environment Variables

**Local (.env file):**
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Render Dashboard:**
1. Go to your service → Environment
2. Add these environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 4. Test Upload
Use the new endpoint:
```bash
POST /auth/profile/image
Authorization: Bearer <your-token>
Content-Type: multipart/form-data

Body: image (file)
```

## Features Implemented

### Profile Management
- ✅ Upload profile image (auto-resized to 500x500)
- ✅ Delete profile image
- ✅ Update profile (username, bio, phone)
- ✅ Change password (local auth only)

### Logout & Token Blacklisting
- ✅ Logout endpoint blacklists JWT token
- ✅ Blacklisted tokens stored in Redis until expiry
- ✅ JWT strategy checks blacklist on every request

## API Endpoints

### Profile Image
- `POST /auth/profile/image` - Upload profile image
- `DELETE /auth/profile/image` - Delete profile image

### Profile Update
- `PUT /auth/profile` - Update username, bio, phone
- `POST /auth/change-password` - Change password

### Logout
- `POST /auth/logout` - Logout and blacklist token

All endpoints require authentication (Bearer token).
