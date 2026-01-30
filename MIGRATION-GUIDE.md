# Database Migration Guide

## Overview

This guide covers migrating your database to support:
1. Multiple farms per user (OneToOne → ManyToOne)
2. New farm location fields (sector, cell, village)
3. Removed GPS coordinates (latitude, longitude)
4. Removed bio field from users
5. Optional farm owner phone number

---

## Option 1: TypeORM Automatic Synchronization (Development Only)

### ⚠️ WARNING: Only use in development! This will drop data!

If you have `synchronize: true` in your TypeORM config, the schema will update automatically when you restart the app.

**Check your configuration:**
```typescript
// src/app.module.ts or database config
TypeOrmModule.forRoot({
  synchronize: true, // ⚠️ Should be false in production!
})
```

**To apply changes:**
```bash
# Stop the app
# Start the app - schema will auto-update
yarn start:dev
```

---

## Option 2: Manual SQL Migration (Recommended for Production)

### Step 1: Create Migration File

Create a new file: `migrations/001-update-schema.sql`

```sql
-- ============================================
-- Migration: Update Schema for Multiple Farms
-- Date: 2026-01-30
-- ============================================

-- 1. Update Users Table
-- Remove bio column
ALTER TABLE users DROP COLUMN IF EXISTS bio;

-- 2. Update Farms Table
-- Remove GPS coordinates
ALTER TABLE farms DROP COLUMN IF EXISTS latitude;
ALTER TABLE farms DROP COLUMN IF EXISTS longitude;

-- Add new location fields
ALTER TABLE farms ADD COLUMN IF NOT EXISTS sector VARCHAR(255);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cell VARCHAR(255);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS village VARCHAR(255);

-- Make ownerPhone optional
ALTER TABLE farms ALTER COLUMN "ownerPhone" DROP NOT NULL;

-- Update existing farms with default values (if any exist)
UPDATE farms 
SET 
  sector = COALESCE(sector, ''),
  cell = COALESCE(cell, ''),
  village = COALESCE(village, '')
WHERE sector IS NULL OR cell IS NULL OR village IS NULL;

-- Make new columns NOT NULL after setting defaults
ALTER TABLE farms ALTER COLUMN sector SET NOT NULL;
ALTER TABLE farms ALTER COLUMN cell SET NOT NULL;
ALTER TABLE farms ALTER COLUMN village SET NOT NULL;

-- 3. Update Farm-User Relationship
-- Drop unique constraint on userId (allows multiple farms per user)
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "UQ_farms_userId";
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "REL_farms_userId";

-- Ensure foreign key exists with CASCADE delete
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "FK_farms_userId";
ALTER TABLE farms ADD CONSTRAINT "FK_farms_userId" 
  FOREIGN KEY ("userId") 
  REFERENCES users(id) 
  ON DELETE CASCADE;

-- ============================================
-- Verification Queries
-- ============================================

-- Check users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check farms table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'farms' 
ORDER BY ordinal_position;

-- Check constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'farms';
```

### Step 2: Run Migration Locally

#### Using psql (PostgreSQL CLI)

```bash
# Connect to your local database
psql -h localhost -p 5435 -U postgres -d agrisense

# Run the migration file
\i migrations/001-update-schema.sql

# Or run directly
psql -h localhost -p 5435 -U postgres -d agrisense -f migrations/001-update-schema.sql
```

#### Using Docker (if using docker-compose)

```bash
# Copy migration file to container
docker cp migrations/001-update-schema.sql agrisense-postgres:/tmp/

# Execute migration
docker exec -it agrisense-postgres psql -U postgres -d agrisense -f /tmp/001-update-schema.sql
```

#### Using Node.js Script

Create `scripts/migrate.ts`:

```typescript
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5435'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres123',
  database: process.env.DATABASE_NAME || 'agrisense',
});

async function runMigration() {
  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/001-update-schema.sql'),
      'utf8'
    );

    await dataSource.query(migrationSQL);
    console.log('✅ Migration completed successfully');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
```

Run it:
```bash
# Add to package.json scripts
"migrate": "ts-node scripts/migrate.ts"

# Run migration
yarn migrate
```

---

## Option 3: Production Migration (Render)

### Method A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Navigate to your PostgreSQL database
   - Click on "Connect" → "External Connection"

2. **Connect using psql**
   ```bash
   # Copy the connection string from Render
   psql postgresql://user:password@host:port/database
   ```

3. **Run Migration**
   ```sql
   -- Paste the SQL from migrations/001-update-schema.sql
   -- Or use \i command if you have the file locally
   ```

### Method B: Using Render Shell

1. **Access your web service shell**
   - Go to your web service in Render
   - Click "Shell" tab
   - Run migration script

2. **Create migration script in your repo**

Create `scripts/migrate-production.sh`:

```bash
#!/bin/bash

echo "🚀 Starting production migration..."

# Run migration using environment variables
psql $DATABASE_URL -f migrations/001-update-schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi
```

Make it executable:
```bash
chmod +x scripts/migrate-production.sh
```

3. **Run from Render Shell**
   ```bash
   ./scripts/migrate-production.sh
   ```

### Method C: Using Render Build Command

Update your `render.yaml`:

```yaml
services:
  - type: web
    name: agrisense-backend
    env: node
    plan: free
    buildCommand: |
      corepack enable && 
      yarn install --immutable && 
      yarn build &&
      node scripts/run-migration.js
    startCommand: yarn start:prod
```

Create `scripts/run-migration.js`:

```javascript
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/001-update-schema.sql'),
      'utf8'
    );

    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't exit with error - allow build to continue
    // The app will handle missing columns gracefully
  } finally {
    await client.end();
  }
}

runMigration();
```

Add pg package:
```bash
yarn add pg
```

---

## Verification

### Check Migration Success

```sql
-- 1. Verify users table (bio should be gone)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'bio';
-- Should return 0 rows

-- 2. Verify farms table (new columns should exist)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'farms' 
AND column_name IN ('sector', 'cell', 'village');
-- Should return 3 rows

-- 3. Verify old columns are gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'farms' 
AND column_name IN ('latitude', 'longitude');
-- Should return 0 rows

-- 4. Check if multiple farms per user is allowed
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'farms' 
AND constraint_name LIKE '%userId%' 
AND constraint_type = 'UNIQUE';
-- Should return 0 rows (no unique constraint)

-- 5. Test creating multiple farms for one user
-- This should work now (no unique constraint error)
```

---

## Rollback (If Needed)

Create `migrations/001-rollback.sql`:

```sql
-- Rollback migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

ALTER TABLE farms DROP COLUMN IF EXISTS sector;
ALTER TABLE farms DROP COLUMN IF EXISTS cell;
ALTER TABLE farms DROP COLUMN IF EXISTS village;

ALTER TABLE farms ALTER COLUMN "ownerPhone" SET NOT NULL;

-- Add unique constraint back (single farm per user)
ALTER TABLE farms ADD CONSTRAINT "UQ_farms_userId" UNIQUE ("userId");
```

---

## Troubleshooting

### Error: Column already exists
```
ERROR: column "sector" of relation "farms" already exists
```
**Solution:** The column was already added. Safe to ignore or use `IF NOT EXISTS`.

### Error: Cannot drop column (dependent objects)
```
ERROR: cannot drop column latitude because other objects depend on it
```
**Solution:** Drop dependent views/indexes first, then drop the column.

### Error: Permission denied
```
ERROR: must be owner of table farms
```
**Solution:** Connect with a user that has proper permissions (usually the database owner).

### Error: Connection timeout
**Solution:** Check your database connection string and firewall rules.

---

## Best Practices

1. **Backup First**: Always backup your database before running migrations
   ```bash
   # Local backup
   pg_dump -h localhost -p 5435 -U postgres agrisense > backup.sql
   
   # Render backup (from dashboard)
   # Go to Database → Backups → Create Backup
   ```

2. **Test Locally**: Run migrations on local database first

3. **Use Transactions**: Wrap migrations in transactions when possible
   ```sql
   BEGIN;
   -- Your migration SQL here
   COMMIT;
   -- Or ROLLBACK; if something goes wrong
   ```

4. **Version Control**: Keep all migration files in git

5. **Document Changes**: Add comments explaining what each migration does

---

## Quick Commands Reference

```bash
# Local Development
psql -h localhost -p 5435 -U postgres -d agrisense -f migrations/001-update-schema.sql

# Production (Render)
psql $DATABASE_URL -f migrations/001-update-schema.sql

# Backup before migration
pg_dump -h localhost -p 5435 -U postgres agrisense > backup-$(date +%Y%m%d).sql

# Restore from backup
psql -h localhost -p 5435 -U postgres agrisense < backup-20260130.sql
```
