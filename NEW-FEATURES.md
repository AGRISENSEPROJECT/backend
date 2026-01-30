# New Features Implemented

## 1. ✅ OTP Sent on Login for Unverified Users

**Behavior:**
- When a user logs in with correct credentials but email is not verified
- System automatically sends a new OTP to their email
- Returns a special response indicating verification is needed

**Response Example:**
```json
{
  "isEmailVerified": false,
  "message": "Email not verified. A new verification code has been sent to your email.",
  "userId": "uuid",
  "email": "user@example.com"
}
```

**Frontend should:**
- Check `isEmailVerified` field in login response
- If `false`, redirect to OTP verification page
- User can verify and then login again

---

## 2. ✅ Single Farm Creation Payload

**Before:** 3 separate API calls (POST farm, PUT location, PUT owner)

**Now:** 1 single API call with complete farm data

**Endpoint:** `POST /farms`

**Payload:**
```json
{
  "name": "Green Valley Farm",
  "size": 25.5,
  "soilType": "loamy",
  "country": "Kenya",
  "district": "Nakuru",
  "latitude": -0.3031,
  "longitude": 36.0800,
  "ownerName": "John Doe",
  "ownerPhone": "+254712345678",
  "ownerEmail": "owner@example.com"
}
```

---

## 3. ✅ Multiple Farms Per User

**New Capabilities:**
- Users can create unlimited farms
- Each farm has a unique ID
- Full CRUD operations on each farm

**New Endpoints:**

### Create Farm
`POST /farms`
- Creates a new farm with complete information

### Get All Farms
`GET /farms`
- Returns all farms owned by the user
- Response includes count and array of farms

### Get Single Farm
`GET /farms/:farmId`
- Get details of a specific farm

### Update Farm
`PUT /farms/:farmId`
- Update any farm field (all fields optional)
- Only owner can update their farms

### Delete Farm
`DELETE /farms/:farmId`
- Permanently delete a farm
- Only owner can delete their farms

**Response Example (Get All):**
```json
{
  "count": 2,
  "farms": [
    {
      "id": "uuid-1",
      "name": "Green Valley Farm",
      "size": 25.5,
      "soilType": "loamy",
      "country": "Kenya",
      "district": "Nakuru",
      "createdAt": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "name": "Sunset Farm",
      "size": 15.0,
      "soilType": "clay",
      "country": "Kenya",
      "district": "Kiambu",
      "createdAt": "2023-01-02T00:00:00.000Z"
    }
  ]
}
```

---

## 4. ✅ Fixed Profile Update Payload

**Removed:** `bio` field (was not in registration)

**Current Fields:**
```json
{
  "username": "john_doe",
  "phoneNumber": "+250788123456"
}
```

**Both fields are optional** - update only what you need

---

## Database Changes Required

Run these migrations to update your database:

```sql
-- Remove bio column from users
ALTER TABLE users DROP COLUMN IF EXISTS bio;

-- Change farm relationship from OneToOne to ManyToOne
-- This is handled by TypeORM, but you may need to:
-- 1. Drop the unique constraint on userId in farms table
-- 2. Update the foreign key relationship

-- The farms table should allow multiple farms per user
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "UQ_farms_userId";
```

---

## Breaking Changes

### Farm Endpoints Changed:
- ❌ Old: `POST /farm` → ✅ New: `POST /farms`
- ❌ Old: `GET /farm` → ✅ New: `GET /farms` (returns array)
- ❌ Old: `PUT /farm/location` → ✅ New: `PUT /farms/:farmId`
- ❌ Old: `PUT /farm/owner` → ✅ New: `PUT /farms/:farmId`
- ❌ Old: `GET /farm/status` → ✅ New: `GET /farms` (check count)

### User Response Changed:
- ❌ Removed: `hasFarm` (boolean)
- ✅ Added: `farmsCount` (number)
- ❌ Removed: `bio` field

### Login Response:
- ✅ Added: `isEmailVerified` field in response
- If `false`, includes `message` and `userId` instead of `access_token`

---

## Testing Checklist

- [ ] Test login with unverified email (should send OTP)
- [ ] Test creating multiple farms for one user
- [ ] Test updating a specific farm
- [ ] Test deleting a farm
- [ ] Test profile update without bio field
- [ ] Verify farm endpoints use `/farms` (plural)
- [ ] Check that `farmsCount` is returned in user object
