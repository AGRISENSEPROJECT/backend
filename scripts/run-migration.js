const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let client;
  const shouldUseSsl =
    process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
  const sslConfig = shouldUseSsl ? { rejectUnauthorized: false } : undefined;

  if (process.env.DATABASE_URL) {
    console.log('📡 Using DATABASE_URL for connection');
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    });
  } else {
    console.log('🧩 Using DATABASE_* configuration');
    client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres123',
      database: process.env.DATABASE_NAME || 'agrisense',
      ...(sslConfig ? { ssl: sslConfig } : {}),
    });
  }

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    const migrationDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs
      .readdirSync(migrationDir)
      .filter((filename) => filename.endsWith('.sql'))
      .filter((filename) => !filename.toLowerCase().includes('rollback'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found.');
      return;
    }

    const requiredTables = ['users', 'farms'];
    const requiredTableResults = await Promise.all(
      requiredTables.map((table) =>
        client.query('SELECT to_regclass($1) AS exists', [`public.${table}`]),
      ),
    );
    const missingTables = requiredTables.filter(
      (_, index) => !requiredTableResults[index].rows[0].exists,
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Base schema is missing required table(s): ${missingTables.join(', ')}. ` +
          'These migrations are patch migrations and require an existing schema.',
      );
    }

    for (const filename of migrationFiles) {
      const migrationPath = path.join(migrationDir, filename);

      console.log(`🚀 Running migration: ${filename}`);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await client.query(migrationSQL);
      console.log(`✅ Migration ${filename} completed successfully`);
    }

    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();
