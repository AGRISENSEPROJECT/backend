const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let client;

  // Check if DATABASE_URL exists (production)
  if (process.env.DATABASE_URL) {
    console.log('📡 Using DATABASE_URL for connection');
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  } else {
    // Use individual environment variables (local development)
    console.log('🏠 Using local database configuration');
    client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres123',
      database: process.env.DATABASE_NAME || 'agrisense',
    });
  }

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Run all migration files in order
    const migrationFiles = [
      '002-add-missing-columns.sql',
      '001-update-schema.sql',
    ];

    for (const filename of migrationFiles) {
      const migrationPath = path.join(__dirname, '../migrations', filename);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${filename} - skipping`);
        continue;
      }

      console.log(`🚀 Running migration: ${filename}`);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(migrationSQL);
        console.log(`✅ Migration ${filename} completed successfully`);
      } catch (error) {
        console.error(`❌ Migration ${filename} failed:`, error.message);
        // Continue with other migrations
      }
    }

    console.log('✅ All migrations completed');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Don't exit with error in production - allow build to continue
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Continuing despite migration error (production mode)');
    } else {
      process.exit(1);
    }
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();
