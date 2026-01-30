# Farm Location Structure Update

## Changes Made

### ❌ Removed (GPS Coordinates)
- `latitude` (decimal)
- `longitude` (decimal)

### ✅ Added (Rwanda Administrative Structure)
- `country` (string) - e.g., "Rwanda"
- `district` (string) - e.g., "Gasabo"
- `sector` (string) - e.g., "Remera"
- `cell` (string) - e.g., "Rukiri I"
- `village` (string) - e.g., "Amahoro"

### ✅ Made Optional
- `ownerPhone` - Farm owner phone number is now optional

---

## Rwanda Administrative Structure

Rwanda has a hierarchical administrative structure:

1. **Country**: Rwanda
2. **Province**: 5 provinces (Kigali City, Eastern, Western, Northern, Southern)
3. **District**: 30 districts
4. **Sector**: 416 sectors
5. **Cell**: 2,148 cells
6. **Village**: 14,837 villages (Imidugudu)

**Example:**
```
Country: Rwanda
District: Gasabo
Sector: Remera
Cell: Rukiri I
Village: Amahoro
```

---

## API Changes

### Create Farm Payload

**Before:**
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

**After:**
```json
{
  "name": "Green Valley Farm",
  "size": 25.5,
  "soilType": "loamy",
  "country": "Rwanda",
  "district": "Gasabo",
  "sector": "Remera",
  "cell": "Rukiri I",
  "village": "Amahoro",
  "ownerName": "John Doe",
  "ownerPhone": "+250788123456",
  "ownerEmail": "owner@example.com"
}
```

**Note:** `ownerPhone` is now optional and can be omitted.

---

## Database Migration Required

Run this SQL to update your database:

```sql
-- Remove old columns
ALTER TABLE farms DROP COLUMN IF EXISTS latitude;
ALTER TABLE farms DROP COLUMN IF EXISTS longitude;

-- Add new columns
ALTER TABLE farms ADD COLUMN IF NOT EXISTS sector VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cell VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE farms ADD COLUMN IF NOT EXISTS village VARCHAR(255) NOT NULL DEFAULT '';

-- Make ownerPhone optional
ALTER TABLE farms ALTER COLUMN "ownerPhone" DROP NOT NULL;
```

---

## Frontend Implementation

### Form Fields

Replace GPS coordinate inputs with administrative location dropdowns:

```jsx
// Old
<Input name="latitude" type="number" />
<Input name="longitude" type="number" />

// New
<Select name="district" options={districts} />
<Select name="sector" options={sectors} />
<Select name="cell" options={cells} />
<Select name="village" options={villages} />
```

### Cascading Dropdowns

Implement cascading selection:
1. User selects **District** → Load sectors for that district
2. User selects **Sector** → Load cells for that sector
3. User selects **Cell** → Load villages for that cell

### Optional Phone Number

```jsx
<Input 
  name="ownerPhone" 
  type="tel" 
  required={false}  // Not required
  placeholder="+250788123456 (optional)"
/>
```

---

## Profile Picture Note

As requested, profile pictures work as follows:

1. **Registration**: No profile picture required
2. **Login**: User logs in without profile picture
3. **Frontend**: Shows fallback avatar (initials, default icon, etc.)
4. **Update Profile**: User can upload profile picture anytime via `POST /auth/profile/image`

**Frontend Implementation:**
```jsx
// Show fallback if no profile image
const avatarUrl = user.profileImage || generateFallbackAvatar(user.username);

<Avatar src={avatarUrl} alt={user.username} />
```

**Fallback Options:**
- User initials (e.g., "JD" for John Doe)
- Default avatar icon
- Gravatar
- UI Avatars API: `https://ui-avatars.com/api/?name=${user.username}`

---

## Testing

### Test Farm Creation
```bash
curl -X POST http://localhost:3000/farms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Green Valley Farm",
    "size": 25.5,
    "soilType": "loamy",
    "country": "Rwanda",
    "district": "Gasabo",
    "sector": "Remera",
    "cell": "Rukiri I",
    "village": "Amahoro",
    "ownerName": "John Doe",
    "ownerEmail": "owner@example.com"
  }'
```

Note: `ownerPhone` is omitted (optional)

---

## Rwanda Administrative Data

You may want to create a reference API or static data for:
- List of districts
- List of sectors per district
- List of cells per sector
- List of villages per cell

**Example endpoint structure:**
```
GET /locations/districts
GET /locations/districts/:districtId/sectors
GET /locations/sectors/:sectorId/cells
GET /locations/cells/:cellId/villages
```

This will help with cascading dropdowns in the frontend.
