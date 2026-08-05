const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@agrisense.com';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

  let client;
  const shouldUseSsl =
    process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
  const sslConfig = shouldUseSsl ? { rejectUnauthorized: false } : undefined;

  if (process.env.DATABASE_URL) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    });
  } else {
    client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      user: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres123',
      database: process.env.DATABASE_NAME || 'agrisense',
      ...(sslConfig ? { ssl: sslConfig } : {}),
    });
  }

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    const existing = await client.query(
      'SELECT id, email, role, status FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username],
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      await client.query(
        `UPDATE users
         SET role = 'admin',
             status = 'active',
             "isEmailVerified" = true
         WHERE id = $1`,
        [user.id],
      );
      console.log(`✅ Existing user promoted/updated to admin: ${user.email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (
         id, email, username, password, provider, role, status,
         "isEmailVerified", "createdAt", "updatedAt"
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, 'local', 'admin', 'active',
         true, NOW(), NOW()
       )`,
      [email, username, hashedPassword],
    );

    console.log('✅ Admin user created successfully');
    console.log(`   email: ${email}`);
    console.log(`   username: ${username}`);
    console.log('   password: (from ADMIN_PASSWORD or default Admin123!)');
  } catch (error) {
    console.error('❌ Admin seed failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

seedAdmin();
