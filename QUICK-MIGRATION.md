# Quick Migration Reference

## 🚀 Run Migration Commands

### Local Development

```bash
# Option 1: Using npm script (recommended)
yarn migrate

# Option 2: Direct psql
psql -h localhost -p 5435 -U postgres -d agrisense -f migrations/001-update-schema.sql

# Option 3: Using Docker
docker exec -it agrisense-postgres psql -U postgres -d agrisense -f /tmp/001-update-schema.sql
```

### Production (Render)

```bash
# Option 1: From Render Shell
./scripts/migrate-production.sh

# Option 2: Direct psql (get connection string from Render dashboard)
psql postgresql://user:password@host:port/database -f migrations/001-update-schema.sql

# Option 3: Using npm script (if DATABASE_URL is set)
yarn migrate:prod
```

---

## 📋 Pre-Migration Checklist

- [ ] Backup database
- [ ] Test migration on local database first
- [ ] Review migration SQL file
- [ ] Ensure no active users during production migration
- [ ] Have rollback script ready

---

## 🔄 Rollback (If Needed)

```bash
# Local
psql -h localhost -p 5435 -U postgres -d agrisense -f migrations/001-rollback.sql

# Production
psql $DATABASE_URL -f migrations/001-rollback.sql
```

---

## ✅ Verify Migration

```sql
-- Connect to database
psql -h localhost -p 5435 -U postgres -d agrisense

-- Check if bio is removed from users
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'bio';
-- Should return 0 rows

-- Check if new farm columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'farms' 
AND column_name IN ('sector', 'cell', 'village');
-- Should return 3 rows

-- Check if old columns are gone
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'farms' 
AND column_name IN ('latitude', 'longitude');
-- Should return 0 rows
```

---

## 🐛 Troubleshooting

### "Column already exists"
✅ Safe to ignore - column was already added

### "Permission denied"
❌ Connect with database owner user

### "Cannot drop column (dependent objects)"
❌ Drop dependent views/indexes first

### Migration script not found
```bash
# Make sure you're in the project root
cd /path/to/agrisense-backend

# Check if files exist
ls -la migrations/
ls -la scripts/
```

---

## 📦 Files Created

```
migrations/
  └── 001-update-schema.sql    # Main migration
  └── 001-rollback.sql          # Rollback script

scripts/
  └── run-migration.js          # Node.js migration runner
  └── migrate-production.sh     # Bash script for production

package.json                    # Added migrate scripts
```

---

## 🎯 What Changed

### Users Table
- ❌ Removed: `bio` column

### Farms Table
- ❌ Removed: `latitude`, `longitude`
- ✅ Added: `sector`, `cell`, `village`
- ✅ Changed: `ownerPhone` now optional
- ✅ Changed: Multiple farms per user allowed

---

## 📞 Need Help?

Check the full guide: `MIGRATION-GUIDE.md`
