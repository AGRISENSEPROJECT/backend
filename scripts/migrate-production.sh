#!/bin/bash

echo "🚀 Starting production migration..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Run migration
psql $DATABASE_URL -f migrations/001-update-schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully"
    exit 0
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi
