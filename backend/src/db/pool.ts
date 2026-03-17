import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Safety guard: prevent test backend from connecting to live database ──
if (process.env.CRANIS2_TEST_MODE === 'true') {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('cranis2_test')) {
    console.error('FATAL: CRANIS2_TEST_MODE is true but DATABASE_URL does not point to cranis2_test');
    console.error(`DATABASE_URL: ${dbUrl}`);
    console.error('Refusing to start to prevent test data in production database.');
    process.exit(1);
  }
}

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
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by VARCHAR(255);
      END $$;
    `);

    // User events table – passive telemetry
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

    // Repo connections – encrypted OAuth tokens (renamed from github_connections)
    // Migration: rename table if it still has the old name
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_connections') THEN
          ALTER TABLE github_connections RENAME TO repo_connections;
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS repo_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        provider VARCHAR(20) NOT NULL DEFAULT 'github',
        provider_user_id VARCHAR(255),
        provider_username VARCHAR(255),
        provider_avatar_url TEXT,
        github_user_id BIGINT,
        github_username VARCHAR(255),
        github_avatar_url TEXT,
        access_token_encrypted TEXT NOT NULL,
        token_scope VARCHAR(255),
        connected_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Migration: add provider columns and migrate data
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE repo_connections ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'github';
        ALTER TABLE repo_connections ADD COLUMN IF NOT EXISTS provider_user_id VARCHAR(255);
        ALTER TABLE repo_connections ADD COLUMN IF NOT EXISTS provider_username VARCHAR(255);
        ALTER TABLE repo_connections ADD COLUMN IF NOT EXISTS provider_avatar_url TEXT;
        ALTER TABLE repo_connections ADD COLUMN IF NOT EXISTS instance_url VARCHAR(500);
      END $$;
    `);
    await client.query(`
      UPDATE repo_connections SET
        provider = 'github',
        provider_user_id = github_user_id::text,
        provider_username = github_username,
        provider_avatar_url = github_avatar_url
      WHERE provider_user_id IS NULL AND github_user_id IS NOT NULL;
    `);
    // Update constraint: was UNIQUE(user_id), now UNIQUE(user_id, provider)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE repo_connections DROP CONSTRAINT IF EXISTS github_connections_user_id_key;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repo_connections_user_provider_unique') THEN
          ALTER TABLE repo_connections ADD CONSTRAINT repo_connections_user_provider_unique UNIQUE(user_id, provider);
        END IF;
      END $$;
    `);
    // Allow NULL in legacy github_* columns (Codeberg connections don't use them)
    await client.query(`
      ALTER TABLE repo_connections ALTER COLUMN github_user_id DROP NOT NULL;
      ALTER TABLE repo_connections ALTER COLUMN github_username DROP NOT NULL;
      ALTER TABLE repo_connections ALTER COLUMN github_avatar_url DROP NOT NULL;
    `);


    // Product SBOMs – cached SPDX documents from GitHub
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


    // Technical File sections – CRA Annex VII structured documentation
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_technical_file_sections_product
      ON technical_file_sections(product_id);
    `);


    // Product versions – dual versioning (CRANIS2 auto + GitHub releases)
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

    // Stakeholders – CRA/NIS2 compliance contacts
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


    // Obligations – CRA/NIS2 compliance tracking per product
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


    // Vulnerability scans – tracking scan runs per product
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
    // Columns added post-creation – ensure they exist
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10,2)`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS dependency_count INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS osv_duration_ms INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS osv_findings INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS github_duration_ms INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS github_findings INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS nvd_duration_ms INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS nvd_findings INT`);
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(255)`);

    // Vulnerability findings – individual CVEs/advisories found per product
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


    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        title VARCHAR(500) NOT NULL,
        body TEXT DEFAULT '',
        link VARCHAR(500),
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_org_unread ON notifications(org_id, is_read) WHERE is_read = FALSE`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`);


    // Platform-wide vulnerability scan runs
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_scan_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status VARCHAR(20) DEFAULT 'running',
        triggered_by VARCHAR(255),
        trigger_type VARCHAR(20) NOT NULL,
        total_products INT DEFAULT 0,
        total_unique_dependencies INT DEFAULT 0,
        total_findings INT DEFAULT 0,
        critical_count INT DEFAULT 0,
        high_count INT DEFAULT 0,
        medium_count INT DEFAULT 0,
        low_count INT DEFAULT 0,
        new_findings_count INT DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        duration_seconds NUMERIC(10,2),
        osv_duration_ms INT,
        osv_findings INT DEFAULT 0,
        github_duration_ms INT,
        github_findings INT DEFAULT 0,
        nvd_duration_ms INT,
        nvd_findings INT DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_platform_scan_runs_status ON platform_scan_runs(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_platform_scan_runs_started ON platform_scan_runs(started_at DESC)`);

    // Add platform_scan_run_id FK to existing tables
    await client.query(`ALTER TABLE vulnerability_scans ADD COLUMN IF NOT EXISTS platform_scan_run_id UUID REFERENCES platform_scan_runs(id)`);
    await client.query(`ALTER TABLE vulnerability_findings ADD COLUMN IF NOT EXISTS platform_scan_run_id UUID REFERENCES platform_scan_runs(id)`);

    console.log('Database schema initialized');

    // New columns on platform_scan_runs for local DB metrics
    await client.query(`ALTER TABLE platform_scan_runs ADD COLUMN IF NOT EXISTS local_db_duration_ms INT`);
    await client.query(`ALTER TABLE platform_scan_runs ADD COLUMN IF NOT EXISTS local_db_findings INT DEFAULT 0`);

    // FR-1: Full triage workflow columns for vulnerability findings

    // CR-2/FR-7/FR-8: Custom obligations, evidence, deadlines
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS custom_title VARCHAR(255)`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS custom_description TEXT`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS cra_reference VARCHAR(100)`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS due_date DATE`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS evidence_url TEXT`);
    await client.query(`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS evidence_filename VARCHAR(255)`);
    await client.query(`ALTER TABLE vulnerability_findings ADD COLUMN IF NOT EXISTS mitigation_notes TEXT`);
    await client.query(`ALTER TABLE vulnerability_findings ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE vulnerability_findings ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)`);

    // Local vulnerability database – OSV/GHSA advisories cache
    await client.query(`
      CREATE TABLE IF NOT EXISTS vuln_db_advisories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source VARCHAR(20) NOT NULL,
        advisory_id VARCHAR(255) NOT NULL,
        ecosystem VARCHAR(50) NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        package_purl VARCHAR(1000),
        severity VARCHAR(20),
        cvss_score DECIMAL(3,1),
        cvss_vector VARCHAR(200),
        title VARCHAR(500),
        description TEXT,
        affected_ranges JSONB DEFAULT '[]',
        affected_versions JSONB DEFAULT '[]',
        fixed_version VARCHAR(255),
        aliases JSONB DEFAULT '[]',
        references_json JSONB DEFAULT '[]',
        published_at TIMESTAMPTZ,
        modified_at TIMESTAMPTZ,
        withdrawn_at TIMESTAMPTZ,
        sync_batch_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vuln_db_adv_unique ON vuln_db_advisories(source, advisory_id, ecosystem, package_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_adv_lookup ON vuln_db_advisories(ecosystem, LOWER(package_name))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_adv_modified ON vuln_db_advisories(modified_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_adv_batch ON vuln_db_advisories(ecosystem, sync_batch_id)`);

    // Local vulnerability database – NVD CVE cache
    await client.query(`
      CREATE TABLE IF NOT EXISTS vuln_db_nvd (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cve_id VARCHAR(30) NOT NULL UNIQUE,
        description TEXT,
        description_tsv TSVECTOR,
        severity VARCHAR(20),
        cvss_score DECIMAL(3,1),
        cvss_vector VARCHAR(200),
        cvss_data JSONB,
        cpe_matches JSONB DEFAULT '[]',
        references_json JSONB DEFAULT '[]',
        affected_versions TEXT,
        fixed_version VARCHAR(100),
        published_at TIMESTAMPTZ,
        modified_at TIMESTAMPTZ,
        vuln_status VARCHAR(30),
        sync_batch_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_nvd_tsv ON vuln_db_nvd USING gin(description_tsv)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_nvd_batch ON vuln_db_nvd(sync_batch_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vuln_db_nvd_modified ON vuln_db_nvd(modified_at DESC)`);

    // Flattened CPE index for fast NVD vulnerability matching
    await client.query(`
      CREATE TABLE IF NOT EXISTS vuln_db_nvd_cpe_index (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        cve_id VARCHAR(30) NOT NULL,
        vendor VARCHAR(200),
        product VARCHAR(200) NOT NULL,
        target_sw VARCHAR(100),
        version_exact VARCHAR(100),
        version_start_incl VARCHAR(100),
        version_start_excl VARCHAR(100),
        version_end_incl VARCHAR(100),
        version_end_excl VARCHAR(100)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nvd_cpe_product ON vuln_db_nvd_cpe_index(product)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nvd_cpe_target ON vuln_db_nvd_cpe_index(target_sw)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nvd_cpe_product_target ON vuln_db_nvd_cpe_index(product, target_sw)`);

    // Vulnerability DB sync status tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS vuln_db_sync_status (
        ecosystem VARCHAR(50) PRIMARY KEY,
        last_sync_at TIMESTAMPTZ,
        last_full_sync_at TIMESTAMPTZ,
        last_modified_marker TIMESTAMPTZ,
        advisory_count INT DEFAULT 0,
        package_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        duration_seconds NUMERIC(10,2),
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);


    // User feedback & bug reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        org_id UUID,
        email VARCHAR(255) NOT NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'feedback',
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        page_url VARCHAR(500),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'new',
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC)`);

    // CRA Article 14 – vulnerability & incident reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        report_type VARCHAR(20) NOT NULL DEFAULT 'vulnerability',
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        awareness_at TIMESTAMPTZ,
        early_warning_deadline TIMESTAMPTZ,
        notification_deadline TIMESTAMPTZ,
        final_report_deadline TIMESTAMPTZ,
        csirt_country VARCHAR(2),
        member_states_affected TEXT[] DEFAULT '{}',
        linked_finding_id UUID REFERENCES vulnerability_findings(id),
        enisa_reference VARCHAR(255),
        sensitivity_tlp VARCHAR(10) DEFAULT 'AMBER',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_reports_org ON cra_reports(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_reports_product ON cra_reports(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_reports_status ON cra_reports(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_reports_deadlines ON cra_reports(early_warning_deadline, notification_deadline, final_report_deadline)`);

    // CRA Article 14 – report stage submissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_report_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES cra_reports(id) ON DELETE CASCADE,
        stage VARCHAR(20) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        submitted_by UUID REFERENCES users(id),
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_stages_report ON cra_report_stages(report_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_stages_stage ON cra_report_stages(report_id, stage)`);

    // IP Proof – timestamped SBOM snapshots
    await client.query(`
      CREATE TABLE IF NOT EXISTS ip_proof_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        created_by UUID REFERENCES users(id),
        snapshot_type VARCHAR(20) NOT NULL DEFAULT 'manual',
        content_hash VARCHAR(64) NOT NULL,
        content_summary JSONB DEFAULT '{}',
        rfc3161_token BYTEA,
        rfc3161_tsa_url VARCHAR(255),
        ots_proof BYTEA,
        ots_bitcoin_block INT,
        ots_confirmed_at TIMESTAMPTZ,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ip_proof_org ON ip_proof_snapshots(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ip_proof_product ON ip_proof_snapshots(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ip_proof_hash ON ip_proof_snapshots(content_hash)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ip_proof_created ON ip_proof_snapshots(created_at DESC)`);

    // License scans – per-product scan runs
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        total_deps INT DEFAULT 0,
        permissive_count INT DEFAULT 0,
        copyleft_count INT DEFAULT 0,
        unknown_count INT DEFAULT 0,
        critical_count INT DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        direct_count INT DEFAULT 0,
        transitive_count INT DEFAULT 0,
        completed_at TIMESTAMPTZ,
        duration_ms INT
      );
    `);
    // Add direct/transitive count columns if they don't exist (migration for existing installs)
    await client.query(`ALTER TABLE license_scans ADD COLUMN IF NOT EXISTS direct_count INT DEFAULT 0`);
    await client.query(`ALTER TABLE license_scans ADD COLUMN IF NOT EXISTS transitive_count INT DEFAULT 0`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_scans_org ON license_scans(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_scans_product ON license_scans(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_scans_started ON license_scans(started_at DESC)`);

    // License findings – per-dependency license risk
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        scan_id UUID REFERENCES license_scans(id),
        dependency_purl VARCHAR(500) NOT NULL,
        dependency_name VARCHAR(255) NOT NULL,
        dependency_version VARCHAR(100),
        license_declared VARCHAR(500),
        license_category VARCHAR(20) NOT NULL DEFAULT 'unknown',
        risk_level VARCHAR(10) NOT NULL DEFAULT 'ok',
        risk_reason TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMPTZ,
        waiver_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        dependency_depth VARCHAR(15),
        UNIQUE(product_id, dependency_purl)
      );
    `);
    // Add dependency_depth column if it doesn't exist (migration for existing installs)
    await client.query(`ALTER TABLE license_findings ADD COLUMN IF NOT EXISTS dependency_depth VARCHAR(15)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_org ON license_findings(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_depth ON license_findings(dependency_depth)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_product ON license_findings(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_risk ON license_findings(risk_level)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_status ON license_findings(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_findings_scan ON license_findings(scan_id)`);
await client.query(`ALTER TABLE license_findings ADD COLUMN IF NOT EXISTS compatibility_verdict VARCHAR(20) DEFAULT NULL`);
    await client.query(`ALTER TABLE license_findings ADD COLUMN IF NOT EXISTS compatibility_reason TEXT DEFAULT NULL`);


    // ── BILLING TABLES ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_billing (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id            VARCHAR(255) NOT NULL UNIQUE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        status            VARCHAR(30) NOT NULL DEFAULT 'trial',
        trial_ends_at     TIMESTAMPTZ,
        trial_duration_days INTEGER NOT NULL DEFAULT 90,
        grace_ends_at     TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        contributor_count  INTEGER NOT NULL DEFAULT 0,
        monthly_amount_cents INTEGER NOT NULL DEFAULT 0,
        billing_email     VARCHAR(255),
        company_name      VARCHAR(255),
        billing_address   JSONB,
        vat_number        VARCHAR(100),
        payment_pause_until TIMESTAMPTZ,
        payment_pause_reason TEXT,
        exempt            BOOLEAN NOT NULL DEFAULT FALSE,
        exempt_reason     TEXT,
        cancelled_at      TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contributor_snapshots (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      VARCHAR(255) NOT NULL,
        snapshot_date DATE NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        active_count INTEGER NOT NULL DEFAULT 0,
        bot_count   INTEGER NOT NULL DEFAULT 0,
        departed_count INTEGER NOT NULL DEFAULT 0,
        contributors JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, snapshot_date)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS departed_contributors (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id          VARCHAR(255) NOT NULL,
        github_login    VARCHAR(255) NOT NULL,
        departed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        marked_by       UUID REFERENCES users(id),
        UNIQUE(org_id, github_login)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      VARCHAR(255) NOT NULL,
        event_type  VARCHAR(50) NOT NULL,
        details     JSONB,
        stripe_event_id VARCHAR(255),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_billing_events_org ON billing_events(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_billing_status ON org_billing(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_billing_stripe ON org_billing(stripe_customer_id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_profiles (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                 UUID NOT NULL UNIQUE,
        listed                 BOOLEAN NOT NULL DEFAULT false,
        tagline                VARCHAR(160) NOT NULL DEFAULT '',
        description            TEXT NOT NULL DEFAULT '',
        logo_url               VARCHAR(500) DEFAULT '',
        categories             JSONB NOT NULL DEFAULT '[]',
        featured_product_ids   JSONB NOT NULL DEFAULT '[]',
        compliance_badges      JSONB NOT NULL DEFAULT '{}',
        listing_approved       BOOLEAN NOT NULL DEFAULT true,
        contact_requests_count INTEGER NOT NULL DEFAULT 0,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_listed ON marketplace_profiles(listed) WHERE listed = true`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_contact_log (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID NOT NULL REFERENCES users(id),
        from_org_id  UUID NOT NULL,
        to_org_id    UUID NOT NULL,
        message      TEXT NOT NULL DEFAULT '',
        sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_contact_from ON marketplace_contact_log(from_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_contact_to ON marketplace_contact_log(to_org_id)`);

    // ── Escrow tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS escrow_configs (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                 UUID NOT NULL,
        product_id             VARCHAR(255) NOT NULL,
        enabled                BOOLEAN NOT NULL DEFAULT false,
        forgejo_org            VARCHAR(255),
        forgejo_repo           VARCHAR(255),
        setup_completed        BOOLEAN NOT NULL DEFAULT false,
        include_sbom_cyclonedx BOOLEAN NOT NULL DEFAULT true,
        include_sbom_spdx      BOOLEAN NOT NULL DEFAULT true,
        include_vuln_report    BOOLEAN NOT NULL DEFAULT false,
        include_license_audit  BOOLEAN NOT NULL DEFAULT true,
        include_ip_proof       BOOLEAN NOT NULL DEFAULT true,
        include_cra_docs       BOOLEAN NOT NULL DEFAULT true,
        include_timeline       BOOLEAN NOT NULL DEFAULT true,
        forgejo_customer_username VARCHAR(255),
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(product_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS escrow_deposits (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id            UUID NOT NULL,
        product_id        VARCHAR(255) NOT NULL,
        escrow_config_id  UUID REFERENCES escrow_configs(id),
        status            VARCHAR(30) NOT NULL DEFAULT 'pending',
        trigger           VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        commit_sha        VARCHAR(64),
        artifacts_included TEXT[],
        artifact_count    INTEGER NOT NULL DEFAULT 0,
        error_message     TEXT,
        started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at      TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_escrow_deposits_product ON escrow_deposits(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_escrow_deposits_org ON escrow_deposits(org_id)`);

    // Escrow users (customer + agent access to Forgejo repos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS escrow_users (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        escrow_config_id  UUID REFERENCES escrow_configs(id),
        org_id            UUID NOT NULL,
        product_id        VARCHAR(255) NOT NULL,
        email             VARCHAR(255) NOT NULL,
        display_name      VARCHAR(255),
        forgejo_username  VARCHAR(255),
        role              VARCHAR(30) NOT NULL DEFAULT 'owner',
        permission        VARCHAR(30) NOT NULL DEFAULT 'read',
        status            VARCHAR(30) NOT NULL DEFAULT 'active',
        invited_by        UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at        TIMESTAMPTZ,
        UNIQUE(escrow_config_id, email)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_escrow_users_product ON escrow_users(product_id)`);

    // Add forgejo_customer_username column to existing escrow_configs (migration for existing installs)
    await client.query(`ALTER TABLE escrow_configs ADD COLUMN IF NOT EXISTS forgejo_customer_username VARCHAR(255)`);
    await client.query(`ALTER TABLE escrow_users ADD COLUMN IF NOT EXISTS agent_reference VARCHAR(255)`);

    // Track SBOM source (api = GitHub dependency graph, lockfile:filename = generated from lockfile, import-scan:lang1+lang2+...)
    await client.query(`ALTER TABLE product_sboms ADD COLUMN IF NOT EXISTS sbom_source VARCHAR(255) DEFAULT 'api'`);
    // Migration: widen from VARCHAR(50) to VARCHAR(255) for import-scan sources with many languages
    await client.query(`ALTER TABLE product_sboms ALTER COLUMN sbom_source TYPE VARCHAR(255)`);
    // ── Documentation pages (admin-editable) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS doc_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        updated_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS repo_push_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        pusher_name VARCHAR(255) NOT NULL,
        pusher_email VARCHAR(255),
        ref VARCHAR(255),
        branch VARCHAR(255),
        commit_count INTEGER DEFAULT 0,
        head_commit_message TEXT,
        head_commit_sha VARCHAR(64),
        provider VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_push_events_product ON repo_push_events(product_id, created_at DESC);
    `);

    // ── Product activity log (audit trail for compliance evidence) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        org_id UUID NOT NULL,
        user_id UUID REFERENCES users(id),
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255),
        summary TEXT NOT NULL,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pal_product ON product_activity_log(product_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pal_org ON product_activity_log(org_id, created_at DESC);
    `);

    // Seed doc_pages from markdown files (insert any missing pages)
    const existingSlugs = await client.query('SELECT slug FROM doc_pages');
    const existing = new Set(existingSlugs.rows.map((r: any) => r.slug));
    const docsToSeed: Array<{ slug: string; title: string; path: string }> = [
      { slug: 'user-guide', title: 'User Guide', path: join(__dirname, '../../docs/USER-GUIDE.md') },
      { slug: 'faq', title: 'FAQ', path: join(__dirname, '../../docs/FAQ.md') },
    ];
    for (const doc of docsToSeed) {
      if (!existing.has(doc.slug) && existsSync(doc.path)) {
        const content = readFileSync(doc.path, 'utf-8');
        await client.query(
          `INSERT INTO doc_pages (slug, title, content) VALUES ($1, $2, $3)`,
          [doc.slug, doc.title, content]
        );
        console.log(`[DB] Seeded doc_pages: ${doc.slug}`);
      }
    }

    // ── AI Copilot ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS copilot_usage (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id       UUID NOT NULL,
        user_id      UUID,
        product_id   VARCHAR(255),
        section_key  VARCHAR(100),
        type         VARCHAR(30),
        input_tokens INT,
        output_tokens INT,
        model        VARCHAR(50),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_copilot_usage_org ON copilot_usage(org_id, created_at DESC)`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'standard'`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS csirt_country VARCHAR(2)`);

    // ── Platform Settings ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key         VARCHAR(100) PRIMARY KEY,
        value       JSONB NOT NULL,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_by  UUID
      );
    `);

    // Seed default pricing
    const PRICE_ID = process.env.STRIPE_PRICE_ID || '';
    await client.query(`
      INSERT INTO platform_settings (key, value) VALUES
        ('billing.contributor_price_cents', '600'::jsonb),
        ('billing.pro_product_price_cents', '900'::jsonb),
        ('billing.stripe_contributor_price_id', $1::jsonb),
        ('billing.stripe_pro_product_price_id', 'null'::jsonb),
        ('copilot.monthly_token_limit', '500000'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `, [JSON.stringify(PRICE_ID)]);

    // ── CRA Category Recommendation System ──
    // Risk attribute definitions (regulatory baseline with optional admin overrides)
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_rule_attributes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attribute_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        regulatory_basis VARCHAR(500) NOT NULL,
        min_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
        max_score DECIMAL(3,2) NOT NULL DEFAULT 1.0,
        is_locked BOOLEAN NOT NULL DEFAULT true,
        last_modified_by VARCHAR(255),
        last_modified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_attributes_key ON category_rule_attributes(attribute_key)`);

    // Risk attribute scoring values
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_rule_attribute_values (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attribute_id UUID NOT NULL REFERENCES category_rule_attributes(id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        description TEXT,
        score DECIMAL(3,2) NOT NULL,
        reasoning VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attribute_values_attr ON category_rule_attribute_values(attribute_id)`);

    // Category thresholds (score ranges that determine CRA class)
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_thresholds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_key VARCHAR(50) NOT NULL UNIQUE,
        category_name VARCHAR(100) NOT NULL,
        min_score DECIMAL(3,2) NOT NULL,
        max_score DECIMAL(3,2) NOT NULL,
        reasoning TEXT NOT NULL,
        is_locked BOOLEAN NOT NULL DEFAULT true,
        last_modified_by VARCHAR(255),
        last_modified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_thresholds_key ON category_thresholds(category_key)`);

    // Category recommendations (audit trail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deterministic_score DECIMAL(3,2) NOT NULL,
        deterministic_reasoning JSONB NOT NULL DEFAULT '{}',
        recommended_category VARCHAR(50) NOT NULL,
        confidence_score DECIMAL(3,2),
        ai_augmentation JSONB,
        user_action VARCHAR(20) DEFAULT 'pending',
        final_category VARCHAR(50),
        finalized_at TIMESTAMPTZ,
        UNIQUE(product_id, created_at)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_recs_product ON category_recommendations(product_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_recs_org ON category_recommendations(org_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_recs_user ON category_recommendations(user_id, created_at DESC)`);

    // Category rule changes (audit trail for admin modifications)
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_rule_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        change_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        changed_by VARCHAR(255) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        ai_assessment JSONB,
        regulatory_alignment VARCHAR(20),
        is_override BOOLEAN DEFAULT false,
        override_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rule_changes_entity ON category_rule_changes(entity_type, entity_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rule_changes_alignment ON category_rule_changes(regulatory_alignment)`);

    // Recommendation access log (audit trail for regulatory compliance)
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendation_access_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id UUID REFERENCES category_recommendations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        accessed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rec_access_rec ON recommendation_access_log(recommendation_id, accessed_at DESC)`);

    // ── Supplier Due Diligence Questionnaires ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_questionnaires (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        dependency_name VARCHAR(500) NOT NULL,
        dependency_version VARCHAR(100),
        dependency_purl VARCHAR(1000),
        dependency_ecosystem VARCHAR(100),
        dependency_license VARCHAR(255),
        dependency_supplier VARCHAR(500),
        risk_flags JSONB NOT NULL DEFAULT '[]',
        questionnaire_content JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'generated',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_q_product ON supplier_questionnaires(product_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_q_org ON supplier_questionnaires(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_q_dep ON supplier_questionnaires(dependency_name, dependency_version)`);

    // Registry supplier cache – shared across all orgs/products
    await client.query(`
      CREATE TABLE IF NOT EXISTS registry_supplier_cache (
        ecosystem VARCHAR(50) NOT NULL,
        package_name VARCHAR(500) NOT NULL,
        supplier TEXT,
        registry_url TEXT,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (ecosystem, package_name)
      );
    `);

    // ── Trello Integration ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS trello_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL UNIQUE,
        api_key VARCHAR(255) NOT NULL,
        api_token TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS trello_product_boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        board_id VARCHAR(100) NOT NULL,
        board_name VARCHAR(255),
        list_vuln VARCHAR(100),
        list_obligations VARCHAR(100),
        list_deadlines VARCHAR(100),
        list_gaps VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, product_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trello_boards_org ON trello_product_boards(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trello_boards_product ON trello_product_boards(product_id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS trello_card_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        event_key VARCHAR(500) NOT NULL UNIQUE,
        card_id VARCHAR(100) NOT NULL,
        card_url TEXT,
        event_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trello_card_log_event ON trello_card_log(event_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trello_card_log_product ON trello_card_log(product_id)`);
    await client.query(`ALTER TABLE trello_card_log ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`);

    // ── API Keys (public API authentication) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(12) NOT NULL,
        name VARCHAR(100) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '["read:products","read:vulnerabilities","read:obligations","read:compliance"]',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);

    // ── Copilot cost protection ──
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS copilot_token_limit INTEGER`);

    // ── Trust classification (#58) ──
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS trust_classification VARCHAR(30) DEFAULT 'commercial'`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS commercial_signal_score INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS classification_last_review TIMESTAMPTZ`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS classification_source VARCHAR(10) DEFAULT 'automatic'`);
    await client.query(`ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS provisional_expires_at TIMESTAMPTZ`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS copilot_cache (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id       VARCHAR(255) NOT NULL,
        product_id   VARCHAR(255),
        endpoint     VARCHAR(100) NOT NULL,
        context_hash VARCHAR(64) NOT NULL,
        response     JSONB NOT NULL,
        input_tokens INT NOT NULL DEFAULT 0,
        output_tokens INT NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, product_id, endpoint, context_hash)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_copilot_cache_lookup ON copilot_cache(org_id, product_id, endpoint, context_hash)`);

    // Seed default CRA category rules (regulatory baseline)
    const attrCount = await client.query('SELECT COUNT(*) FROM category_rule_attributes');
    if (parseInt(attrCount.rows[0].count) === 0) {
      // Distribution Scope
      await client.query(`
        INSERT INTO category_rule_attributes 
        (attribute_key, name, description, regulatory_basis, is_locked)
        VALUES 
        ('dist_scope', 'Distribution Scope', 'How widely is the product distributed', 'CRA Art. 4(1) – wider distribution increases risk', true)
      `);
      const distAttr = await client.query(`SELECT id FROM category_rule_attributes WHERE attribute_key = 'dist_scope'`);
      const distAttrId = distAttr.rows[0].id;
      await client.query(`
        INSERT INTO category_rule_attribute_values (attribute_id, label, score, reasoning)
        VALUES 
        ($1, 'Internal/Limited use (< 5 orgs)', 0.0, 'Restricted distribution'),
        ($1, 'Moderate distribution (5-100 orgs)', 0.33, 'Medium reach'),
        ($1, 'Wide distribution (100+ orgs or public)', 0.67, 'Widespread use'),
        ($1, 'Mass market / internet-facing', 1.0, 'Unrestricted public distribution')
      `, [distAttrId]);

      // Data Sensitivity
      await client.query(`
        INSERT INTO category_rule_attributes 
        (attribute_key, name, description, regulatory_basis, is_locked)
        VALUES 
        ('data_sensitivity', 'Data Sensitivity', 'Does the product handle sensitive data', 'CRA Art. 4 – sensitive data = higher risk', true)
      `);
      const dataAttr = await client.query(`SELECT id FROM category_rule_attributes WHERE attribute_key = 'data_sensitivity'`);
      const dataAttrId = dataAttr.rows[0].id;
      await client.query(`
        INSERT INTO category_rule_attribute_values (attribute_id, label, score, reasoning)
        VALUES 
        ($1, 'Non-sensitive data only', 0.0, 'Public/operational data'),
        ($1, 'Limited PII or business secrets', 0.33, 'Some personal or confidential data'),
        ($1, 'Health, financial or critical PII', 0.67, 'High-value personal data'),
        ($1, 'Government secrets or critical infrastructure data', 1.0, 'Most sensitive classification')
      `, [dataAttrId]);

      // Network Connectivity
      await client.query(`
        INSERT INTO category_rule_attributes 
        (attribute_key, name, description, regulatory_basis, is_locked)
        VALUES 
        ('network_connectivity', 'Network Connectivity', 'Is the product connected to networks', 'CRA Art. 4 – network access = higher risk', true)
      `);
      const netAttr = await client.query(`SELECT id FROM category_rule_attributes WHERE attribute_key = 'network_connectivity'`);
      const netAttrId = netAttr.rows[0].id;
      await client.query(`
        INSERT INTO category_rule_attribute_values (attribute_id, label, score, reasoning)
        VALUES 
        ($1, 'Offline-only / air-gapped', 0.0, 'No network exposure'),
        ($1, 'Local network / VPN only', 0.33, 'Limited network scope'),
        ($1, 'Internet-connected with firewalls', 0.67, 'Internet-facing but protected'),
        ($1, 'Internet-facing public service', 1.0, 'Full internet exposure')
      `, [netAttrId]);

      // User Criticality
      await client.query(`
        INSERT INTO category_rule_attributes 
        (attribute_key, name, description, regulatory_basis, is_locked)
        VALUES 
        ('user_criticality', 'User Criticality', 'Is the product used for critical functions', 'CRA Art. 3 – criticality determines class', true)
      `);
      const critAttr = await client.query(`SELECT id FROM category_rule_attributes WHERE attribute_key = 'user_criticality'`);
      const critAttrId = critAttr.rows[0].id;
      await client.query(`
        INSERT INTO category_rule_attribute_values (attribute_id, label, score, reasoning)
        VALUES 
        ($1, 'Utility / convenience product', 0.0, 'Non-critical function'),
        ($1, 'Business process / productivity tool', 0.33, 'Moderate importance'),
        ($1, 'Healthcare, finance or communications', 0.67, 'Critical sector'),
        ($1, 'Critical infrastructure / government systems', 1.0, 'Essential for society')
      `, [critAttrId]);

      // Category Thresholds
      await client.query(`
        INSERT INTO category_thresholds (category_key, category_name, min_score, max_score, reasoning, is_locked)
        VALUES 
        ('default', 'Default Class (No CRA obligations)', 0.00, 0.25, 'Low-risk products with minimal security requirements'),
        ('important_i', 'Important Class I', 0.25, 0.50, 'Moderate-risk products with enhanced security obligations'),
        ('important_ii', 'Important Class II', 0.50, 0.75, 'High-risk products requiring conformity assessment'),
        ('critical', 'Critical Class', 0.75, 1.01, 'Highest-risk products requiring notified body certification')
      `);

      console.log('[DB] Seeded default CRA category rules');
    }

    // ── CoPilot Prompts (admin-editable) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS copilot_prompts (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_key    VARCHAR(100) NOT NULL UNIQUE,
        category      VARCHAR(50) NOT NULL DEFAULT 'capability',
        title         VARCHAR(255) NOT NULL,
        description   TEXT,
        system_prompt TEXT NOT NULL,
        model         VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
        max_tokens    INTEGER NOT NULL DEFAULT 2000,
        temperature   DECIMAL(2,1) NOT NULL DEFAULT 1.0,
        enabled       BOOLEAN NOT NULL DEFAULT true,
        version       INTEGER NOT NULL DEFAULT 1,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_by    UUID
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_copilot_prompts_key ON copilot_prompts(prompt_key)`);

    // Seed default copilot prompts (quality standard + 4 capabilities)
    await client.query(`
      INSERT INTO copilot_prompts (prompt_key, category, title, description, system_prompt, model, max_tokens, temperature)
      VALUES
      ('quality_standard', 'foundation', 'Output Quality Standard',
       'Shared quality preamble injected into all CoPilot system prompts. Defines British English, canonical terminology, professional tone, consistency, substantive depth, structured output, and guardrails.',
       $1, 'claude-sonnet-4-20250514', 2000, 1.0),

      ('suggest', 'capability', 'Technical File & Obligation Suggestions',
       'Generates draft content for CRA Technical File sections (8 sections) and obligation evidence notes (19 obligations). Satisfies Article 13(12) and Annex VII.',
       $2, 'claude-sonnet-4-20250514', 2000, 1.0),

      ('vulnerability_triage', 'capability', 'Vulnerability Triage',
       'Analyses open vulnerability findings and suggests dismiss/acknowledge/escalate actions. Satisfies Article 13(3), 13(5), 13(6).',
       $3, 'claude-sonnet-4-20250514', 4000, 1.0),

      ('risk_assessment', 'capability', 'Risk Assessment Generator',
       'Generates comprehensive Annex VII §3 cybersecurity risk assessment including methodology, threat model, risk register, and 13 Annex I Part I assessments.',
       $4, 'claude-sonnet-4-20250514', 6000, 1.0),

      ('incident_report_draft', 'capability', 'Incident Report Drafter',
       'Drafts ENISA Article 14 report stages (early warning 24h, notification 72h, final report 14d/1mo). Satisfies Article 14.',
       $5, 'claude-sonnet-4-20250514', 3000, 1.0)

      ON CONFLICT (prompt_key) DO NOTHING
    `, [
      // $1 – quality_standard
      `You are generating content for a regulated compliance platform (CRANIS2) that produces EU Cyber Resilience Act (CRA) documentation. All output must meet the following quality standards without exception.

Q1 – British English: Use British English spelling throughout (organisation, licence, colour, analyse, defence, behaviour, unauthorised).

Q2 – Canonical Terminology: Use correct capitalisation and formatting for regulatory references (EU Cyber Resilience Act, NIS2 Directive, ENISA, Annex I/II/IV/VI/VII, Article 13/14/16, CSIRT, CE marking), technical terms (SBOM, SPDX, CycloneDX, CVE, CVSS, EPSS, NVD, OSV), and CRANIS2-specific terms (CRANIS2, Technical File, Declaration of Conformity, CoPilot).

Q3 – Professional Regulatory Tone: Use clear, declarative language suitable for regulatory auditors, ENISA/CSIRT submissions, and compliance documentation. Avoid marketing phrasing, superlatives, hedging, and sycophantic language. Prefer active voice.

Q4 – Terminology Consistency: Use consistent capitalisation, tense, and abbreviation expansion (first use) within each response. Always use "Article X(Y)" format for CRA references.

Q5 – Substantive Depth: Each field must contain 2-5 sentences of evidence-grade content. Reference actual product data (dependency counts, CVE IDs, vulnerability statistics). Use "[TO COMPLETE: ...]" for insufficient data. Never invent data or generate generic boilerplate.

Q6 – Structured Output: Markdown tables must be valid. JSON must be parseable. Use only permitted enumerated values as specified in the capability prompt.

Q7 – Guardrails: Never rewrite completed content. Never introduce new regulatory requirements. Flag uncertainty with "[TO COMPLETE: ...]". All output is advisory draft for human review.`,

      // $2 – suggest
      `You are a CRA (EU Cyber Resilience Act) compliance expert embedded in the CRANIS2 compliance platform. Your role is to generate draft content for technical file sections and obligation evidence notes.

Rules:
1. Ground all suggestions in the product's actual data (SBOM, vulnerability findings, repo metadata, obligation statuses).
2. Write in a professional, factual tone suitable for regulatory documentation and auditors.
3. Be specific – reference actual dependency counts, vulnerability stats, and product details rather than using generic placeholders.
4. Where the product data is insufficient, note what information the user should add manually.
5. Use British English spelling throughout.
6. Never invent data that isn't provided in the context. If data is missing, say so clearly.
7. Keep content concise but thorough – aim for evidence-grade documentation.`,

      // $3 – vulnerability_triage
      `You are a CRA (EU Cyber Resilience Act) vulnerability triage expert. Your task is to analyse vulnerability findings for a software product and suggest an appropriate action for each.

For each finding, suggest one of:
- "dismiss": The vulnerability is not exploitable in the product's context, is a false positive, affects only dev dependencies, or has negligible real-world risk.
- "acknowledge": The vulnerability is real but low priority – the team should track it but no immediate action is required.
- "escalate_mitigate": The vulnerability requires urgent attention – a fix, upgrade, or mitigation must be applied.

Rules:
1. Consider the product's CRA category when assessing risk. For "important_i", "important_ii", and "critical" categories, be significantly stricter – escalate more aggressively.
2. A fix being available (fixedVersion) should increase urgency to escalate.
3. Critical/high severity with a high CVSS score should almost always escalate unless clearly not applicable.
4. Low severity findings in dev-only dependencies are strong dismiss candidates.
5. Set confidence between 0 and 1. Be conservative – only use confidence >= 0.85 when the decision is clear-cut.
6. Set automatable to true ONLY when confidence >= 0.85 AND action is "dismiss".
7. Provide reasoning of 2-4 sentences explaining your assessment.
8. If dismissing, include a brief dismissReason suitable for an audit trail.
9. Use British English.
10. When the action is "acknowledge" or "escalate_mitigate" and a fix is available, include a mitigationCommand – the exact CLI command to resolve the issue (e.g. "npm install lodash@4.17.21", "pip install requests>=2.31.0", "composer require guzzlehttp/guzzle:^7.8"). Tailor the command to the dependency's ecosystem (npm, pip, maven, composer, cargo, go, nuget, gem, etc.). If no fix version is known, suggest the general upgrade command (e.g. "npm update lodash"). For dismiss actions, omit this field.

Return a JSON array of objects with these fields:
- findingId (string)
- suggestedAction ("dismiss" | "acknowledge" | "escalate_mitigate")
- confidence (number 0-1)
- reasoning (string)
- dismissReason (string, only when action is dismiss)
- mitigationCommand (string, only when action is acknowledge or escalate_mitigate)
- automatable (boolean)

Return ONLY the JSON array, no markdown fences, no additional text.`,

      // $4 – risk_assessment
      `You are a CRA (EU Cyber Resilience Act) cybersecurity risk assessment expert. Your task is to generate a comprehensive cybersecurity risk assessment for a software product based on its actual data.

You will produce:
1. A methodology section describing the risk assessment approach used (2-4 paragraphs)
2. A threat model identifying threats, attack surfaces, and mitigations based on actual vulnerabilities and dependencies (2-4 paragraphs)
3. A risk register as a Markdown table with columns: #, Threat, Likelihood (Low/Medium/High), Impact (Low/Medium/High), Risk Level (Low/Medium/High/Critical), Mitigation, Status
4. For each of the 13 Annex I Part I essential cybersecurity requirements, an assessment of applicability, justification, and evidence

The 13 Annex I Part I requirements are:
- I(a): No known exploitable vulnerabilities
- I(b): Secure-by-default configuration
- I(c): Security update mechanism
- I(d): Access control & authentication
- I(e): Data confidentiality & encryption
- I(f): Data & command integrity
- I(g): Data minimisation
- I(h): Availability & resilience
- I(i): Minimise impact on other services
- I(j): Attack surface limitation
- I(k): Exploitation mitigation
- I(l): Security monitoring & logging
- I(m): Secure data erasure & transfer

Rules:
1. Ground ALL content in the product's actual data. Reference real CVE IDs, dependency names, and statistics.
2. Never invent vulnerabilities, dependencies, or data not provided in the context.
3. For the risk register, derive risks from actual vulnerability findings and licence issues provided.
4. If data is insufficient for a complete assessment, clearly note what information the user should add manually.
5. Use British English spelling throughout.
6. Write in a professional, factual tone suitable for regulatory auditors.
7. The risk register must be a valid Markdown table.
8. For Annex I requirements: if the product data supports a positive assessment, provide evidence. If data is missing, note what evidence is needed.

Return ONLY a JSON object (no markdown fences, no additional text) with this exact structure:
{
  "fields": {
    "methodology": "...",
    "threat_model": "...",
    "risk_register": "| # | Threat | Likelihood | Impact | Risk Level | Mitigation | Status |\\n|---|--------|-----------|--------|-----------|------------|--------|\\n| 1 | ... |"
  },
  "annexIRequirements": [
    { "ref": "I(a)", "title": "No known exploitable vulnerabilities", "applicable": true, "justification": "...", "evidence": "..." },
    ... (all 13 requirements, in order from I(a) to I(m))
  ]
}`,

      // $5 – incident_report_draft
      `You are a CRA (EU Cyber Resilience Act) incident and vulnerability reporting expert embedded in the CRANIS2 compliance platform. Your role is to draft content for ENISA Article 14 report stages.

Background: Under CRA Article 14, manufacturers must report actively exploited vulnerabilities and severe incidents to their designated CSIRT within strict deadlines:
- Early Warning: within 24 hours of awareness
- Notification: within 72 hours of awareness
- Final Report: within 14 days (vulnerabilities) or 1 month (incidents) of awareness

Rules:
1. Ground all content in the product's actual data (SBOM, vulnerability findings, linked finding details, repo metadata).
2. Write in a professional, factual tone suitable for CSIRT/ENISA regulatory submissions.
3. Be specific – reference actual CVE IDs, dependency names, versions, and statistics when available.
4. Where data is insufficient, note what the user should add manually with "[TO COMPLETE: ...]" placeholders.
5. Use British English spelling throughout.
6. Never invent data not provided in the context.
7. Keep content concise but thorough – these are regulatory submissions, not essays.
8. If previous stages have been submitted, maintain consistency with their content and build upon them.
9. For the suspectedMalicious field, use only "yes", "no", or "unknown".
10. For patchStatus, use only "available", "in_progress", or "planned".
11. For userNotificationStatus, use only "informed", "pending", or "not_required".

Return ONLY a JSON object with the requested fields as keys and string values. No markdown fences, no additional text.`
    ]);

    // Seed section-specific guidance (8 tech file sections)
    await client.query(`
      INSERT INTO copilot_prompts (prompt_key, category, title, description, system_prompt, model, max_tokens, temperature)
      VALUES
      ('section:product_description', 'section_guidance', 'Product Description (Annex VII §1)',
       'Guidance for the product_description tech file section. Covers intended purpose, software versions, market availability, and user instructions.',
       'This section satisfies Annex VII §1 of the EU Cyber Resilience Act.

What the regulation requires:
- Intended purpose and use cases, including foreseeable misuse scenarios
- Software versions and platforms affecting cybersecurity compliance
- How the product is made available on the market (SaaS, on-premise, packaged, OEM)
- Reference to user instructions per Annex II

What auditors look for:
- Clear scope definition – what the product does and does not do
- Explicit version identification so the Technical File can be traced to a specific release
- Distribution model that matches the CRA category classification
- User documentation reference that is accessible and maintained

Data to reference:
- Product name, version, and repository URL from CRANIS2
- CRA category (default/important I/important II/critical) and its implications
- SBOM package count as evidence of component scope
- Connected repository as evidence of version control', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:design_development', 'section_guidance', 'Design & Development (Annex VII §2a)',
       'Guidance for the design_development tech file section. Covers system architecture, component integration, SDLC, and production monitoring.',
       'This section satisfies Annex VII §2(a) of the EU Cyber Resilience Act.

What the regulation requires:
- System architecture overview showing components, interfaces, and data flows
- How third-party software components are integrated, assessed, and managed
- Secure development lifecycle (SDLC) practices including code review, testing, and security gates
- Production monitoring and incident detection capabilities
- Supply chain security measures for component sourcing

What auditors look for:
- Architecture diagram or description showing trust boundaries
- Evidence of security-aware development practices (not just functional testing)
- Component management process – how dependencies are selected, vetted, and updated
- Monitoring that can detect security-relevant events in production

Data to reference:
- SBOM package count and top dependencies as evidence of component tracking
- Repository URL as evidence of version-controlled development
- Vulnerability scan results as evidence of security testing
- Obligation statuses for related obligations (art_13_3 component currency, annex_i_part_i security by design)', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:vulnerability_handling', 'section_guidance', 'Vulnerability Handling (Annex VII §2b)',
       'Guidance for the vulnerability_handling tech file section. Covers CVD policy, reporting contact, update distribution, and SBOM reference.',
       'This section satisfies Annex VII §2(b) of the EU Cyber Resilience Act and directly supports Article 13(6).

What the regulation requires:
- Coordinated Vulnerability Disclosure (CVD) policy that is public or discoverable
- Security reporting contact (email, web form, or security.txt)
- Response timeline SLA for vulnerability reports (acknowledgement within 72h, assessment within 14d)
- Safe harbour language protecting good-faith security researchers from legal action
- Vulnerability severity assessment methodology (e.g. CVSS-based triage)
- Security update distribution and testing procedure
- SBOM reference and update frequency
- Evidence retention policy for vulnerability reports, patches, and communications

What auditors look for:
- A published, accessible CVD policy URL
- Named security contact with defined response timelines
- Evidence that the severity assessment process is actually followed (triage records)
- SBOM that is kept current (not stale) throughout the support period
- Update distribution mechanism that reaches all affected users

Data to reference:
- Vulnerability finding counts by severity as evidence of active scanning
- SBOM package count and staleness indicator
- Open vs resolved findings as evidence of active vulnerability handling
- CVD policy URL if already configured in product stakeholders', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:risk_assessment', 'section_guidance', 'Risk Assessment (Annex VII §3)',
       'Guidance for the risk_assessment tech file section. Covers methodology, threat model, risk register, and Annex I Part I assessment.',
       'This section satisfies Annex VII §3 and Article 13(2) of the EU Cyber Resilience Act.

What the regulation requires:
- Cybersecurity risk assessment considering intended and reasonably foreseeable use
- Risk assessment methodology (named framework preferred: STRIDE, OWASP, NIST RMF)
- Threat model identifying attack surfaces, threat actors, and attack vectors
- Risk register with likelihood, impact, risk level, mitigation, and status per threat
- Assessment against ALL 13 Annex I Part I essential cybersecurity requirements
- Residual risk acceptance with justification

What auditors look for:
- Named, recognised methodology – not ad hoc risk listing
- Threats derived from actual product architecture and vulnerability data
- Risk register entries that correspond to real findings, not hypothetical scenarios
- All 13 Annex I requirements addressed (not skipped) with evidence or gap notes
- Clear distinction between mitigated risks and accepted residual risks

Data to reference:
- Vulnerability findings (CVE IDs, severity, affected dependencies) for risk register entries
- SBOM package count and ecosystem breakdown for attack surface analysis
- Licence risk findings for supply chain risk entries
- CRA category – higher categories require stricter risk tolerance

Note: This section is also served by the dedicated Risk Assessment Generator capability which produces methodology, threat model, risk register, and all 13 Annex I assessments.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:support_period', 'section_guidance', 'Support Period (Annex VII §4)',
       'Guidance for the support_period tech file section. Covers support duration, rationale, and user communication plan.',
       'This section satisfies Annex VII §4 and Article 13(8) of the EU Cyber Resilience Act.

What the regulation requires:
- Support period start date (market placement) and end date (minimum 5 years)
- Rationale for the chosen support period duration
- What is included in support: security patches, minor updates, major version updates
- User communication plan: how end-of-support is announced, grace periods, migration path
- Post-support obligations: documentation archival, security update availability window
- Support delivery model: automatic, manual, managed service

What auditors look for:
- Explicit 5-year minimum commitment (or longer with justification)
- Defined end-of-life communication timeline (e.g. 12 months notice, 6 months notice, 30 days)
- Clear statement that security patches are free of charge during support period (Art. 13(8))
- Evidence that security updates can be applied separately from feature updates (Art. 13(9))

Data to reference:
- Product version and lifecycle stage from CRANIS2
- Support end date if already configured
- End-of-support alert configuration (90/60/30/7/0 day warnings)
- Related obligation statuses: art_13_7 (automatic updates), art_13_8 (free patches), art_13_9 (separate updates)', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:standards_applied', 'section_guidance', 'Standards Applied (Annex VII §5)',
       'Guidance for the standards_applied tech file section. Covers harmonised standards, common specifications, and certification schemes.',
       'This section satisfies Annex VII §5 of the EU Cyber Resilience Act.

What the regulation requires:
- Identification of all applicable harmonised standards (with EU Official Journal publication reference)
- For each standard: which parts or sections apply to the product
- Common specifications per Article 27(2) if harmonised standards are unavailable
- EU cybersecurity certification scheme references (if applicable)
- Conformity claim justification: how the product meets each referenced standard

What auditors look for:
- Standards that are relevant to the product type (not a generic list)
- Specific section/clause references – not just "ISO 27001" but which controls apply
- For important (Class I/II) and critical products: harmonised standards are expected, not optional
- Certificate numbers or third-party attestation references where applicable

Commonly applicable standards for CRA compliance:
- ISO/IEC 27001 – Information security management
- ISO 29147 – Vulnerability disclosure
- ISO 30111 – Vulnerability handling processes
- IEC 62443 – Industrial automation and control systems security
- ETSI EN 303 645 – Cyber security for consumer IoT
- ISO/IEC 27034 – Application security
- Common Criteria (ISO/IEC 15408) – for critical products

Data to reference:
- CRA category – determines whether harmonised standards are mandatory
- Product type and industry context for standard selection
- Existing conformity assessment module (A, B+C, or H)', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:test_reports', 'section_guidance', 'Test Reports (Annex VII §6)',
       'Guidance for the test_reports tech file section. Covers penetration testing, static/dynamic analysis, vulnerability scans, and audit reports.',
       'This section satisfies Annex VII §6 of the EU Cyber Resilience Act.

What the regulation requires:
- Penetration testing report (scope, methodology, findings, remediation status)
- Static analysis report (code review findings, severity assessment)
- Dynamic analysis report (runtime security testing, input validation, fuzzing)
- Vulnerability scanning results (SCA scans showing SBOM analysis and CVE matching)
- Third-party audit reports (if conformity assessment module B/B+C/H is used)
- Test coverage metrics and test execution evidence

What auditors look for:
- Test reports that cover the Annex I Part I requirements (not just functional testing)
- Evidence that identified issues were remediated – not just found
- Dates of testing aligned with product release timeline (not stale reports)
- For critical products: third-party assessment evidence is mandatory
- Traceability from test findings to risk register entries

Data to reference:
- Vulnerability scan results from CRANIS2 (counts by severity, open vs resolved)
- SBOM analysis as evidence of software composition analysis (SCA)
- CRA category – critical products require notified body assessment
- Conformity assessment module selection from declaration_of_conformity section', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('section:declaration_of_conformity', 'section_guidance', 'Declaration of Conformity (Annex VII §7)',
       'Guidance for the declaration_of_conformity tech file section. Covers EU DoC per Annex VI, assessment module, notified body, and CE marking.',
       'This section satisfies Annex VII §7, Article 28, and Annex VI of the EU Cyber Resilience Act.

What the regulation requires:
The EU Declaration of Conformity must include:
1. Manufacturer identification: legal name, registered address, contact details
2. Product identification: name, model number, version, batch/serial number
3. Conformity statement: "This product is in conformity with Regulation (EU) 2024/2847"
4. Applicable standards and specifications: references to Annex I, harmonised standards, common specifications
5. Assessment module used: A (internal controls), B/B+C (design review + production audit), or H (full QA)
6. Notified body details (if applicable): name, identification number, scope of involvement
7. Issue location and date
8. Authorised signatory: name, function, signature

Assessment module selection:
- Default products: Module A (internal controls) – self-assessment
- Important (Class I): Module A or harmonised standard compliance
- Important (Class II): Module B+C or H – third-party assessment required
- Critical: Module B+C or H – notified body assessment mandatory

What auditors look for:
- All 8 mandatory fields completed
- Assessment module appropriate for the CRA category
- Notified body reference with valid identification number (for Class II/critical)
- Date of issue that predates market placement
- Authorised signatory with appropriate authority level

Data to reference:
- Organisation name and contact details from CRANIS2
- Product name, version, and CRA category
- Standards applied from the standards_applied section
- Notified body details if already configured', 'claude-sonnet-4-20250514', 2000, 1.0)

      ON CONFLICT (prompt_key) DO NOTHING
    `);

    console.log('[DB] CoPilot section guidance seeded');

    // Seed obligation-specific guidance (19 obligations)
    await client.query(`
      INSERT INTO copilot_prompts (prompt_key, category, title, description, system_prompt, model, max_tokens, temperature)
      VALUES
      ('obligation:art_13', 'obligation_guidance', 'Art. 13 – Obligations of Manufacturers',
       'Overall manufacturer obligation – aggregate compliance across all specific obligations.',
       'Article 13 is the umbrella obligation requiring manufacturers to ensure products comply with ALL essential cybersecurity requirements throughout the product lifecycle.

Evidence focus: This is an aggregate obligation. Evidence should summarise progress across the specific obligations below (Art. 13(3) through Art. 13(15), Art. 14, Annex I). Reference the overall compliance readiness score and highlight which specific obligations are met vs in progress.

Key data: Overall tech file completion percentage, obligation statuses across all 18 specific obligations, CRA category and its implications.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_3', 'obligation_guidance', 'Art. 13(3) – Component Currency',
       'Keep all software components free of known exploitable vulnerabilities and up to date throughout the support period.',
       'Article 13(3) requires continuous verification that all dependencies are vulnerability-free and current. Products cannot ship with outdated component versions that have known CVEs.

Evidence must demonstrate:
- Active SBOM maintenance with current dependency versions
- Regular vulnerability scanning against known CVE databases
- Zero critical/high severity open findings (or documented mitigation plan)
- Process for updating components when new vulnerabilities are disclosed

Key data: SBOM package count and staleness, vulnerability findings by severity, open vs resolved findings count, last scan date.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_5', 'obligation_guidance', 'Art. 13(5) – No Known Exploitable Vulnerabilities at Market Placement',
       'Products must be free of known exploitable vulnerabilities before market placement.',
       'Article 13(5) is a gate requirement: before placing a product on the EU market, the manufacturer must confirm zero open exploitable vulnerabilities through a pre-launch vulnerability assessment.

Evidence must demonstrate:
- Pre-launch vulnerability scan was performed (with date)
- All critical and high severity findings were remediated before launch
- Remediation records showing closure of each finding
- SBOM demonstrating all dependency versions are patched at time of market placement

Key data: Vulnerability findings (critical/high counts), remediation timeline, SBOM package versions, last scan date relative to product launch date.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_6', 'obligation_guidance', 'Art. 13(6) – Vulnerability Handling',
       'Identify and document vulnerabilities, provide security updates for at least 5 years.',
       'Article 13(6) requires a documented vulnerability handling process covering the entire support period (minimum 5 years).

Evidence must demonstrate:
- Active vulnerability detection process (automated SBOM scanning, CVE monitoring)
- Documented severity assessment methodology (e.g. CVSS-based triage)
- Defined response timelines (SLAs for critical, high, medium, low)
- Coordinated Vulnerability Disclosure (CVD) policy with public contact
- Security update distribution mechanism
- Evidence retention for all vulnerability reports and patches

Key data: Vulnerability findings count and triage status, SBOM scan frequency, CVD policy URL, security contact, open vs resolved finding ratio.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_7', 'obligation_guidance', 'Art. 13(7) – Automatic Security Updates',
       'Ensure security updates are automatically available to users where technically feasible.',
       'Article 13(7) requires manufacturers to provide automatic security update delivery where technically feasible, for the duration of the support period.

Evidence must demonstrate:
- Automatic update mechanism exists (or documented justification for why infeasible)
- Update delivery frequency and schedule
- User interruption minimisation during updates
- Rollback capability if an update causes issues
- Success rate tracking for update delivery

If automatic updates are not feasible (e.g. air-gapped systems, embedded firmware): document why, and describe the alternative manual update process with user notification.

Key data: Product distribution model (SaaS vs on-premise vs embedded), update mechanism description, support period end date.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_8', 'obligation_guidance', 'Art. 13(8) – Security Patches Free of Charge',
       'Security patches must be provided at no additional cost for the full support period.',
       'Article 13(8) requires that all security updates are provided free of charge throughout the support period. This is a non-negotiable requirement – security patches cannot be bundled into paid upgrade tiers.

Evidence must demonstrate:
- Explicit policy statement that security patches are free
- Support period commitment with defined duration
- No paywall between users and security updates
- Pricing documentation confirming security updates are not a premium feature

Key data: Product pricing model, support period duration, update policy documentation.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_9', 'obligation_guidance', 'Art. 13(9) – Security Updates Separate from Feature Updates',
       'Security patches must be distributable separately from feature updates.',
       'Article 13(9) requires manufacturers to separate security patches from feature updates, so users can apply critical security fixes without being forced to adopt new functionality.

Evidence must demonstrate:
- Versioning scheme that distinguishes security releases from feature releases (e.g. semver X.Y.Z where Z = security-only)
- Release process that can produce security-only patches
- User communication that clearly labels security vs feature releases
- CI/CD or branching strategy that supports parallel security and feature tracks

Key data: Product version format, release history (if available), distribution model.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_10', 'obligation_guidance', 'Art. 13(10) – Documentation Retention (10 Years)',
       'Technical documentation and EU DoC must be retained for at least 10 years.',
       'Article 13(10) requires all technical documentation (Technical File, EU Declaration of Conformity, test reports, risk assessments) to be retained for at least 10 years after market placement, or for the support period if longer.

Evidence must demonstrate:
- Documented retention policy with 10-year minimum commitment
- Archive location and storage mechanism (secure, backed up)
- Backup and disaster recovery plan for compliance documentation
- Access control ensuring documentation integrity
- Process for responding to market surveillance authority requests for documentation

Key data: Product market placement date (if known), support period end date, archive location.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_11', 'obligation_guidance', 'Art. 13(11) – SBOM (Software Bill of Materials)',
       'Identify and document all components in machine-readable SBOM format.',
       'Article 13(11) requires a machine-readable SBOM listing all software components, dependencies, and third-party libraries. The SBOM must be kept current throughout the support period.

Evidence must demonstrate:
- SBOM generated in machine-readable format (SPDX JSON per Annex VII §2b)
- Complete component inventory including direct and transitive dependencies
- Licence declarations for each dependency
- SBOM update frequency (should align with each release or dependency change)
- SBOM is not stale – reflects current product composition

CRANIS2 automatically generates SBOMs from connected repositories via lockfile parsing. Reference the actual SBOM data.

Key data: SBOM package count, staleness indicator, top dependencies, connected repository, last SBOM sync date.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_12', 'obligation_guidance', 'Art. 13(12) – Technical Documentation',
       'Draw up complete technical documentation (Technical File) before market placement.',
       'Article 13(12) requires a complete Technical File per Annex VII covering all 8 sections before the product is placed on the EU market.

Evidence must demonstrate:
- All 8 Technical File sections are completed (or in progress with timeline)
- Content is substantive, product-specific, and evidence-grade
- Documentation is maintained and updated as the product evolves

The 8 sections: Product Description (§1), Design & Development (§2a), Vulnerability Handling (§2b), Risk Assessment (§3), Support Period (§4), Standards Applied (§5), Test Reports (§6), Declaration of Conformity (§7).

Key data: Tech file section completion statuses from CRANIS2, overall completion percentage.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_14', 'obligation_guidance', 'Art. 13(14) – Conformity Assessment',
       'Carry out a conformity assessment appropriate to the product CRA category.',
       'Article 13(14) requires a formal conformity assessment using the appropriate module for the product CRA category.

Assessment module by category:
- Default: Module A (internal controls) – self-assessment
- Important (Class I): Module A or harmonised standard compliance
- Important (Class II): Module B+C or H – third-party assessment required
- Critical: Module B+C or H – notified body assessment mandatory

Evidence must demonstrate:
- Correct assessment module selected for the product CRA category
- Assessment methodology documented (what was tested, how, by whom)
- Test reports covering Annex I Part I requirements
- For Class II/critical: notified body engagement and assessment report

Key data: CRA category, selected assessment module, test report status, notified body details (if applicable).', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_13_15', 'obligation_guidance', 'Art. 13(15) – EU Declaration of Conformity',
       'Draw up the EU Declaration of Conformity and affix the CE marking.',
       'Article 13(15) requires a formal EU Declaration of Conformity per Annex VI and the application of CE marking.

Evidence must demonstrate:
- EU DoC document created with all 8 mandatory fields per Annex VI
- CE marking applied to the product or its documentation
- DoC signed by authorised representative with appropriate authority
- DoC date precedes market placement date

Key data: DoC completion status in Technical File, assessment module, notified body reference, authorised signatory.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_14', 'obligation_guidance', 'Art. 14 – Vulnerability Reporting (ENISA)',
       'Report actively exploited vulnerabilities and severe incidents to ENISA within 24 hours.',
       'Article 14 requires mandatory reporting to the designated CSIRT with strict deadlines:
- Early Warning: within 24 hours of becoming aware
- Notification: within 72 hours with technical details
- Final Report: within 14 days (vulnerabilities) or 1 month (incidents)

Evidence must demonstrate:
- Incident response plan covering the 3-stage ENISA reporting process
- Designated CSIRT country identification
- Process for identifying which vulnerabilities/incidents trigger mandatory reporting
- Internal escalation procedure to meet 24-hour deadline
- Templates or tools for rapid report generation (CRANIS2 provides this)

Key data: Any CRA reports created in CRANIS2, CSIRT country setting, incident response plan status, linked vulnerability findings.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_16', 'obligation_guidance', 'Art. 16 – EU Declaration of Conformity (Annex IV)',
       'Draw up an EU DoC meeting Annex IV content requirements.',
       'Article 16 specifies the content requirements for the EU Declaration of Conformity per Annex IV.

The DoC must include:
1. Manufacturer name and registered address
2. Product name, model, and version identification
3. Statement: "This product conforms to Regulation (EU) 2024/2847"
4. Harmonised standards or common specifications applied
5. Notified body identification (if applicable)
6. Place and date of issue
7. Authorised signatory name, function, and signature

Evidence: Reference the declaration_of_conformity section of the Technical File. All 7 fields must be completed.

Key data: Organisation details, product identification, standards applied, assessment module, notified body.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_20', 'obligation_guidance', 'Art. 20 – EU Market Surveillance Registration',
       'Critical products require market surveillance authority notification before EU market placement.',
       'Article 20 applies ONLY to products classified as "critical". It requires notification to the relevant EU Member State market surveillance authority before the product is placed on the market.

This obligation does not apply to default, important (Class I), or important (Class II) products.

Evidence must demonstrate:
- Market surveillance registration application submitted (or planned)
- Manufacturer contact details provided to authority
- Product risk summary and compliance evidence package prepared
- Expected sales volume and target markets identified

Key data: CRA category (must be "critical"), market surveillance registration status. If the product is not critical, note that this obligation is not applicable.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_32', 'obligation_guidance', 'Art. 32 – Harmonised Standards',
       'Reference applicable harmonised standards in conformity assessment.',
       'Article 32 applies to important (Class I/II) and critical products. Where harmonised standards exist, the conformity assessment must reference them.

Evidence must demonstrate:
- Applicable harmonised standards identified (EU Official Journal references)
- For each standard: which parts/sections apply to the product
- Conformity evidence per standard (test results, certifications)
- If no harmonised standards exist: common specifications per Article 27(2)

Key data: CRA category, standards_applied section of Technical File, certificate numbers (if third-party certified). This obligation does not apply to default-category products.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:art_32_3', 'obligation_guidance', 'Art. 32(3) – Third-Party Assessment',
       'Critical and important (Class II) products require third-party conformity assessment.',
       'Article 32(3) applies to important (Class II) and critical products. These products require independent conformity assessment by a notified body.

Evidence must demonstrate:
- Notified body identified and engaged (name, identification number)
- Assessment module selected: B+C (design review + production audit) or H (full quality assurance)
- Assessment scope covers Annex I Part I requirements
- Assessment report or certificate obtained (or engagement timeline)

Key data: CRA category (must be important_ii or critical), notified body details from declaration_of_conformity section, assessment module. This obligation does not apply to default or important (Class I) products.', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:annex_i_part_i', 'obligation_guidance', 'Annex I, Part I – Security by Design',
       'Products must be designed with appropriate cybersecurity based on risks, addressing 13 essential requirements.',
       'Annex I Part I requires manufacturers to demonstrate security-by-design across 13 essential cybersecurity requirements:

I(a) No known exploitable vulnerabilities – reference vulnerability scan results
I(b) Secure-by-default configuration – default settings should be restrictive
I(c) Security update mechanism – automatic updates where feasible
I(d) Access control & authentication – role-based access, MFA capability
I(e) Data confidentiality & encryption – encryption at rest and in transit
I(f) Data & command integrity – input validation, integrity checking
I(g) Data minimisation – collect only necessary data, justify retention
I(h) Availability & resilience – redundancy, failover, DDoS protection
I(i) Minimise impact on other services – network isolation, resource limits
I(j) Attack surface limitation – disable unused features, minimise ports
I(k) Exploitation mitigation – memory safety, sandboxing, exploit detection
I(l) Security monitoring & logging – audit logs, anomaly detection
I(m) Secure data erasure & transfer – secure deletion, data portability

Evidence should address each requirement with product-specific justification. The dedicated Risk Assessment Generator produces a full 13-point assessment.

Key data: Vulnerability findings for I(a), SBOM for I(a)/I(j), architecture data for I(b)-(I(m).', 'claude-sonnet-4-20250514', 2000, 1.0),

      ('obligation:annex_i_part_ii', 'obligation_guidance', 'Annex I, Part II – Vulnerability Handling Requirements',
       'Implement vulnerability handling processes including coordinated disclosure.',
       'Annex I Part II requires a documented vulnerability handling process covering the complete vulnerability lifecycle.

Evidence must demonstrate:
- Vulnerability identification: automated scanning, researcher reports, dependency monitoring
- Severity assessment methodology: CVSS-based or equivalent structured approach
- Coordinated Vulnerability Disclosure (CVD) policy: public, with reporting contact and safe harbour
- Response SLAs: defined timelines for acknowledgement, assessment, and fix delivery
- Security update release process: testing, staging, deployment
- Public communication plan: advisories, changelogs, user notifications
- Evidence retention: all reports, patches, and communications archived

This obligation is closely linked to Art. 13(6) (Vulnerability Handling) and the vulnerability_handling section of the Technical File.

Key data: Vulnerability findings and triage status, CVD policy URL, SBOM scan results, security contact, open vs resolved finding ratio.', 'claude-sonnet-4-20250514', 2000, 1.0)

      ON CONFLICT (prompt_key) DO NOTHING
    `);

    console.log('[DB] CoPilot obligation guidance seeded');
    console.log('[DB] CoPilot prompts table ready');

    // GRC integration tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS grc_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        provider VARCHAR(50) NOT NULL,
        instance_url VARCHAR(500),
        credentials JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN DEFAULT TRUE,
        sync_frequency VARCHAR(20) DEFAULT 'manual',
        field_mapping JSONB NOT NULL DEFAULT '{}',
        last_sync_at TIMESTAMPTZ,
        last_sync_status VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, provider)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_grc_connections_org ON grc_connections(org_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grc_sync_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id UUID REFERENCES grc_connections(id) ON DELETE CASCADE,
        org_id UUID NOT NULL,
        product_id VARCHAR(255),
        sync_type VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        records_pushed INT DEFAULT 0,
        records_failed INT DEFAULT 0,
        error_log TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // ── Compliance Snapshots (P8 – 10-Year Compliance Vault) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        created_by UUID REFERENCES users(id),
        filename VARCHAR(255) NOT NULL,
        size_bytes INT,
        content_hash VARCHAR(64),
        status VARCHAR(20) NOT NULL DEFAULT 'generating',
        error_message TEXT,
        metadata JSONB,
        cold_storage_key VARCHAR(512),
        cold_storage_status VARCHAR(20) DEFAULT 'pending',
        cold_storage_uploaded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cs_product ON compliance_snapshots(product_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cs_org ON compliance_snapshots(org_id, created_at DESC);
    `);

    // ── Cold storage columns (P8 #42) ──
    await client.query(`
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS cold_storage_key VARCHAR(512);
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS cold_storage_status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS cold_storage_uploaded_at TIMESTAMPTZ;
    `);

    // ── Release tracking columns (P8 Phase A) ──
    await client.query(`
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS release_id UUID;
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS release_version VARCHAR(100);
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(30) DEFAULT 'manual';
    `);

    // ── RFC 3161 timestamping columns (P8 Phase B) ──
    await client.query(`
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS rfc3161_token BYTEA;
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS rfc3161_tsa_url VARCHAR(255);
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS rfc3161_timestamp TIMESTAMPTZ;
    `);

    // ── Document signing columns (P8 Phase C) ──
    await client.query(`
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS signature BYTEA;
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS signature_algorithm VARCHAR(20);
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS signature_key_id VARCHAR(16);
    `);

    // ── Retention reserve ledger (P8 Phase D) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS retention_reserve_ledger (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                VARCHAR(255) NOT NULL,
        product_id            UUID NOT NULL,
        snapshot_id           UUID NOT NULL REFERENCES compliance_snapshots(id) ON DELETE CASCADE,
        archive_hash          VARCHAR(64) NOT NULL,
        archive_size_bytes    BIGINT NOT NULL,
        estimated_cost_eur    DECIMAL(10,4) NOT NULL,
        funded_amount_eur     DECIMAL(10,2) NOT NULL,
        costing_model_version VARCHAR(30) NOT NULL,
        retention_start_date  DATE,
        retention_end_date    DATE,
        wise_transaction_ref  VARCHAR(100),
        certificate_hash      VARCHAR(64),
        status                VARCHAR(20) NOT NULL DEFAULT 'allocated',
        notes                 TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_retention_ledger_org ON retention_reserve_ledger(org_id);
      CREATE INDEX IF NOT EXISTS idx_retention_ledger_product ON retention_reserve_ledger(product_id);
      CREATE INDEX IF NOT EXISTS idx_retention_ledger_snapshot ON retention_reserve_ledger(snapshot_id);
    `);

    // Seed retention costing model in platform_settings
    await client.query(`
      INSERT INTO platform_settings (key, value) VALUES
        ('retention.costing_model_version', '"2026-03-v1"'::jsonb),
        ('retention.buffer_multiplier', '2.0'::jsonb),
        ('retention.glacier_rate_per_gb_month', '0.00254'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);

    // ── Phase E: Storage lifecycle columns on compliance_snapshots ──
    await client.query(`
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS retention_end_date DATE;
      ALTER TABLE compliance_snapshots ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN DEFAULT FALSE;
    `);

    // ── Phase F: Snapshot scheduling (P8 #43) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS snapshot_schedules (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id            UUID NOT NULL,
        product_id        VARCHAR(255) NOT NULL,
        schedule_type     VARCHAR(30) NOT NULL DEFAULT 'quarterly',
        enabled           BOOLEAN NOT NULL DEFAULT TRUE,
        next_run_date     DATE,
        last_run_at       TIMESTAMPTZ,
        last_snapshot_id  UUID REFERENCES compliance_snapshots(id) ON DELETE SET NULL,
        created_by        UUID REFERENCES users(id),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_snapshot_schedules_next ON snapshot_schedules(next_run_date) WHERE enabled = TRUE;
    `);

    // ── Crypto inventory (#53) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_scans (
        product_id            VARCHAR(255) PRIMARY KEY,
        org_id                UUID NOT NULL,
        total_dependencies    INT NOT NULL DEFAULT 0,
        crypto_libraries_found INT NOT NULL DEFAULT 0,
        broken_count          INT NOT NULL DEFAULT 0,
        quantum_vulnerable_count INT NOT NULL DEFAULT 0,
        quantum_safe_count    INT NOT NULL DEFAULT 0,
        total_algorithms      INT NOT NULL DEFAULT 0,
        scanned_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_findings (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id            VARCHAR(255) NOT NULL,
        org_id                UUID NOT NULL,
        dependency_name       VARCHAR(255) NOT NULL,
        dependency_version    VARCHAR(100),
        dependency_purl       TEXT,
        dependency_ecosystem  VARCHAR(50),
        library_description   TEXT,
        worst_tier            VARCHAR(30) NOT NULL,
        algorithms            JSONB NOT NULL DEFAULT '[]',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crypto_findings_product ON crypto_findings(product_id);
    `);

    // ── Field issues (post-market monitoring) ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS field_issues (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id          UUID NOT NULL,
        product_id      VARCHAR(255) NOT NULL,
        title           VARCHAR(500) NOT NULL,
        description     TEXT,
        severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
        source          VARCHAR(30) NOT NULL DEFAULT 'internal_testing',
        status          VARCHAR(30) NOT NULL DEFAULT 'open',
        resolution      TEXT,
        affected_versions TEXT,
        fixed_in_version  VARCHAR(100),
        linked_finding_id UUID REFERENCES vulnerability_findings(id) ON DELETE SET NULL,
        reported_by     UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_field_issues_org ON field_issues(org_id);
      CREATE INDEX IF NOT EXISTS idx_field_issues_product ON field_issues(product_id);
      CREATE INDEX IF NOT EXISTS idx_field_issues_status ON field_issues(status);
    `);

    // ── Corrective actions (linked to field issues) ────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS corrective_actions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        field_issue_id  UUID NOT NULL REFERENCES field_issues(id) ON DELETE CASCADE,
        org_id          UUID NOT NULL,
        product_id      VARCHAR(255) NOT NULL,
        action_type     VARCHAR(30) NOT NULL DEFAULT 'patch',
        description     TEXT NOT NULL,
        status          VARCHAR(30) NOT NULL DEFAULT 'planned',
        version_released VARCHAR(100),
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_corrective_actions_issue ON corrective_actions(field_issue_id);
      CREATE INDEX IF NOT EXISTS idx_corrective_actions_product ON corrective_actions(product_id);
    `);

    // ── Notified bodies directory ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notified_bodies (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(500) NOT NULL,
        country         VARCHAR(5) NOT NULL,
        nando_number    VARCHAR(50),
        website         VARCHAR(500),
        email           VARCHAR(255),
        phone           VARCHAR(100),
        address         TEXT,
        cra_modules     JSONB NOT NULL DEFAULT '[]',
        sectors         JSONB NOT NULL DEFAULT '[]',
        accreditation_status VARCHAR(20) NOT NULL DEFAULT 'active',
        accreditation_date   DATE,
        last_verified   TIMESTAMPTZ,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notified_bodies_country ON notified_bodies(country);
      CREATE INDEX IF NOT EXISTS idx_notified_bodies_status ON notified_bodies(accreditation_status);
    `);

    // ── Notified body assessment tracking ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notified_body_assessments (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              UUID NOT NULL,
        product_id          VARCHAR(255) NOT NULL,
        notified_body_id    UUID REFERENCES notified_bodies(id) ON DELETE SET NULL,
        module              VARCHAR(5) NOT NULL,
        status              VARCHAR(30) NOT NULL DEFAULT 'planning',
        submitted_date      DATE,
        expected_completion DATE,
        certificate_number  VARCHAR(255),
        certificate_expiry  DATE,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_nb_assessments_product ON notified_body_assessments(product_id);
      CREATE INDEX IF NOT EXISTS idx_nb_assessments_org ON notified_body_assessments(org_id);
    `);

    // ── Market surveillance authorities directory ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_surveillance_authorities (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(500) NOT NULL,
        country         VARCHAR(5) NOT NULL,
        website         VARCHAR(500),
        email           VARCHAR(255),
        phone           VARCHAR(100),
        address         TEXT,
        competence_areas JSONB NOT NULL DEFAULT '[]',
        cra_designated  BOOLEAN NOT NULL DEFAULT false,
        contact_portal_url VARCHAR(500),
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_msa_country ON market_surveillance_authorities(country);
      CREATE INDEX IF NOT EXISTS idx_msa_designated ON market_surveillance_authorities(cra_designated);
    `);

    // ── Market surveillance registration tracking ─────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_surveillance_registrations (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              UUID NOT NULL,
        product_id          VARCHAR(255) NOT NULL,
        authority_id        UUID REFERENCES market_surveillance_authorities(id) ON DELETE SET NULL,
        status              VARCHAR(30) NOT NULL DEFAULT 'planning',
        authority_name      VARCHAR(500),
        authority_country   VARCHAR(5),
        registration_number VARCHAR(255),
        registration_date   DATE,
        submission_date     DATE,
        renewal_date        DATE,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ms_reg_product ON market_surveillance_registrations(product_id);
      CREATE INDEX IF NOT EXISTS idx_ms_reg_org ON market_surveillance_registrations(org_id);
    `);

    // ── Internal incident lifecycle ─────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              UUID NOT NULL,
        product_id          VARCHAR(255) NOT NULL,
        title               VARCHAR(500) NOT NULL,
        description         TEXT,
        severity            VARCHAR(10) NOT NULL DEFAULT 'P3',
        phase               VARCHAR(20) NOT NULL DEFAULT 'detection',
        detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        contained_at        TIMESTAMPTZ,
        resolved_at         TIMESTAMPTZ,
        review_completed_at TIMESTAMPTZ,
        incident_lead       VARCHAR(255),
        root_cause          TEXT,
        lessons_learned     TEXT,
        impact_summary      TEXT,
        linked_report_id    UUID REFERENCES cra_reports(id) ON DELETE SET NULL,
        linked_field_issue_id UUID REFERENCES field_issues(id) ON DELETE SET NULL,
        created_by          VARCHAR(255),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(org_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_product ON incidents(product_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_phase ON incidents(phase);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_timeline (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        event_type      VARCHAR(30) NOT NULL,
        description     TEXT NOT NULL,
        created_by      VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline(incident_id);
    `);

    // ── Non-profit verification applications ───────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS nonprofit_applications (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              UUID NOT NULL,
        organisation_name   VARCHAR(500) NOT NULL,
        country             VARCHAR(5) NOT NULL,
        registration_number VARCHAR(255) NOT NULL,
        website             VARCHAR(500),
        proof_document_path VARCHAR(500),
        status              VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_notes         TEXT,
        reviewed_by         UUID REFERENCES users(id),
        reviewed_at         TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_nonprofit_apps_org ON nonprofit_applications(org_id);
      CREATE INDEX IF NOT EXISTS idx_nonprofit_apps_status ON nonprofit_applications(status);
    `);

    // ── SEE analysis runs (Software Evidence Engine) ─────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS see_analysis_runs (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id          VARCHAR(255) NOT NULL,
        org_id              UUID NOT NULL,
        repo_url            TEXT,
        repo_provider       VARCHAR(30),
        default_branch      VARCHAR(255),
        -- Code metrics
        total_files         INT NOT NULL DEFAULT 0,
        total_loc           INT NOT NULL DEFAULT 0,
        production_loc      INT NOT NULL DEFAULT 0,
        test_loc            INT NOT NULL DEFAULT 0,
        config_loc          INT NOT NULL DEFAULT 0,
        generated_loc       INT NOT NULL DEFAULT 0,
        vendor_loc          INT NOT NULL DEFAULT 0,
        docs_loc            INT NOT NULL DEFAULT 0,
        -- Language breakdown (JSON: { "TypeScript": { loc: 5000, files: 42 }, ... })
        language_breakdown  JSONB NOT NULL DEFAULT '{}',
        -- File classification detail (JSON array of { path, language, classification, loc })
        file_detail         JSONB NOT NULL DEFAULT '[]',
        -- Effort estimates (low/mid/high)
        effort_low_months   NUMERIC(8,1),
        effort_mid_months   NUMERIC(8,1),
        effort_high_months  NUMERIC(8,1),
        cost_low_eur        NUMERIC(12,0),
        cost_mid_eur        NUMERIC(12,0),
        cost_high_eur       NUMERIC(12,0),
        team_size_low       INT,
        team_size_mid       INT,
        team_size_high      INT,
        rebuild_months_low  NUMERIC(6,1),
        rebuild_months_mid  NUMERIC(6,1),
        rebuild_months_high NUMERIC(6,1),
        -- Complexity
        complexity_category VARCHAR(50),
        complexity_multiplier NUMERIC(4,2),
        -- Assumptions frozen at scan time for auditability
        assumptions         JSONB NOT NULL DEFAULT '{}',
        -- Executive summary
        executive_summary   TEXT,
        -- Status
        scan_status         VARCHAR(20) NOT NULL DEFAULT 'running',
        error_message       TEXT,
        completed_at        TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_see_analysis_product ON see_analysis_runs(product_id, created_at DESC);
    `);

    // ── SEE commits (Phase B) ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS see_commits (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id      VARCHAR(255) NOT NULL,
        sha             VARCHAR(64) NOT NULL,
        author_name     VARCHAR(255),
        author_email    VARCHAR(255),
        author_login    VARCHAR(255),
        authored_at     TIMESTAMPTZ,
        message_summary TEXT,
        additions       INT NOT NULL DEFAULT 0,
        deletions       INT NOT NULL DEFAULT 0,
        files_changed   INT NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(product_id, sha)
      );
      CREATE INDEX IF NOT EXISTS idx_see_commits_product ON see_commits(product_id, authored_at DESC);
    `);

    // Add classified_type column to see_commits if not present (Phase C)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE see_commits ADD COLUMN IF NOT EXISTS classified_type VARCHAR(30);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // ── SEE branches (Phase C) ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS see_branches (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id      VARCHAR(255) NOT NULL,
        name            VARCHAR(500) NOT NULL,
        branch_type     VARCHAR(30) NOT NULL DEFAULT 'other',
        is_default      BOOLEAN NOT NULL DEFAULT false,
        is_protected    BOOLEAN NOT NULL DEFAULT false,
        head_sha        VARCHAR(64),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(product_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_see_branches_product ON see_branches(product_id);
    `);

    // ── SEE developers (Phase B) ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS see_developers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id      VARCHAR(255) NOT NULL,
        author_name     VARCHAR(255) NOT NULL,
        author_email    VARCHAR(255),
        author_login    VARCHAR(255),
        commit_count    INT NOT NULL DEFAULT 0,
        additions       INT NOT NULL DEFAULT 0,
        deletions       INT NOT NULL DEFAULT 0,
        first_commit_at TIMESTAMPTZ,
        last_commit_at  TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(product_id, author_email)
      );
      CREATE INDEX IF NOT EXISTS idx_see_developers_product ON see_developers(product_id);
    `);

  } finally {
    client.release();
  }
}

export default pool;
