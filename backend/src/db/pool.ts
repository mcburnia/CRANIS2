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
    // Sync history (duration tracking for workload balancing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        sync_type VARCHAR(20) NOT NULL DEFAULT 'manual',
        started_at TIMESTAMPTZ NOT NULL,
        duration_seconds NUMERIC(10,2) NOT NULL,
        package_count INTEGER DEFAULT 0,
        contributor_count INTEGER DEFAULT 0,
        release_count INTEGER DEFAULT 0,
        cranis_version VARCHAR(20),
        triggered_by VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_history_product ON sync_history(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at)`);

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

    // Stakeholders — CRA/NIS2 compliance contacts
    await client.query(`
      CREATE TABLE IF NOT EXISTS stakeholders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255),
        role_key VARCHAR(50) NOT NULL,
        name VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(100) DEFAULT '',
        organisation VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        updated_by VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stakeholders_org ON stakeholders(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stakeholders_product ON stakeholders(product_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholders_org_role ON stakeholders(org_id, role_key) WHERE product_id IS NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholders_product_role ON stakeholders(org_id, product_id, role_key) WHERE product_id IS NOT NULL`);


    // Obligations — CRA/NIS2 compliance tracking per product
    await client.query(`
      CREATE TABLE IF NOT EXISTS obligations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        obligation_key VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'not_started',
        notes TEXT DEFAULT '',
        updated_by VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_obligations_product_key ON obligations(org_id, product_id, obligation_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_obligations_product ON obligations(product_id)`);


    // Vulnerability scans — tracking scan runs per product
    await client.query(`
      CREATE TABLE IF NOT EXISTS vulnerability_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'running',
        findings_count INT DEFAULT 0,
        critical_count INT DEFAULT 0,
        high_count INT DEFAULT 0,
        medium_count INT DEFAULT 0,
        low_count INT DEFAULT 0,
        source VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_scans_product ON vulnerability_scans(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_scans_org ON vulnerability_scans(org_id)`);

    // Vulnerability findings — individual CVEs/advisories found per product
    await client.query(`
      CREATE TABLE IF NOT EXISTS vulnerability_findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        scan_id UUID REFERENCES vulnerability_scans(id),
        source VARCHAR(20) NOT NULL,
        source_id VARCHAR(255),
        severity VARCHAR(20) NOT NULL,
        cvss_score DECIMAL(3,1),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        dependency_name VARCHAR(255),
        dependency_version VARCHAR(100),
        dependency_ecosystem VARCHAR(50),
        dependency_purl VARCHAR(1000),
        affected_versions TEXT,
        fixed_version VARCHAR(100),
        references_url TEXT,
        mitigation TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'open',
        dismissed_by VARCHAR(255),
        dismissed_at TIMESTAMPTZ,
        dismissed_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_findings_product ON vulnerability_findings(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_findings_scan ON vulnerability_findings(scan_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vuln_findings_unique ON vulnerability_findings(product_id, source, source_id, dependency_purl)`);

    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

export default pool;
