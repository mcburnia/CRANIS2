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

    // GitHub connections table — encrypted OAuth tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        github_user_id BIGINT NOT NULL,
        github_username VARCHAR(255) NOT NULL,
        github_avatar_url TEXT,
        access_token_encrypted TEXT NOT NULL,
        token_scope VARCHAR(255),
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);


    // Product SBOMs — cached SPDX documents from GitHub
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_sboms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL UNIQUE,
        spdx_json JSONB NOT NULL,
        spdx_version VARCHAR(20),
        package_count INT DEFAULT 0,
        is_stale BOOLEAN DEFAULT FALSE,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);


    // Technical File sections — CRA Annex VII structured documentation
    await client.query(`
      CREATE TABLE IF NOT EXISTS technical_file_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        section_key VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content JSONB DEFAULT '{}',
        notes TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'not_started',
        cra_reference VARCHAR(100),
        updated_by VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(product_id, section_key)
      );
    `);


    // Product versions — dual versioning (CRANIS2 auto + GitHub releases)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        cranis_version VARCHAR(20) NOT NULL,
        github_tag VARCHAR(100),
        github_release_name VARCHAR(255),
        github_release_body TEXT,
        github_commit_sha VARCHAR(40),
        is_prerelease BOOLEAN DEFAULT FALSE,
        source VARCHAR(20) NOT NULL DEFAULT 'sync',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_versions_product ON product_versions(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_versions_cranis ON product_versions(product_id, cranis_version)`);

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
