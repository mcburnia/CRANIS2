import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        token_expires_at TIMESTAMPTZ,
        org_id UUID,
        org_role VARCHAR(50) DEFAULT 'admin',
        preferred_language VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role VARCHAR(50) DEFAULT 'admin';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10);
      END $$;
    `);

    // User events table — passive telemetry
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        event_type VARCHAR(50) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        accept_language TEXT,
        browser_language VARCHAR(10),
        browser_timezone VARCHAR(100),
        referrer TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Index for querying events by user and type
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_events_ip ON user_events(ip_address);
    `);

    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

export default pool;
