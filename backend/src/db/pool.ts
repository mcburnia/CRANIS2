import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    // Repo connections — encrypted OAuth tokens (renamed from github_connections)
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_technical_file_sections_product
      ON technical_file_sections(product_id);
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

    // Local vulnerability database — OSV/GHSA advisories cache
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

    // Local vulnerability database — NVD CVE cache
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

    // CRA Article 14 — vulnerability & incident reports
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

    // CRA Article 14 — report stage submissions
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

    // IP Proof — timestamped SBOM snapshots
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

    // License scans — per-product scan runs
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

    // License findings — per-dependency license risk
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

    // Track SBOM source (api = GitHub dependency graph, lockfile:filename = generated from lockfile)
    await client.query(`ALTER TABLE product_sboms ADD COLUMN IF NOT EXISTS sbom_source VARCHAR(50) DEFAULT 'api'`);
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

    // Seed doc_pages from markdown files on first run
    const docCount = await client.query('SELECT COUNT(*) FROM doc_pages');
    if (parseInt(docCount.rows[0].count) === 0) {
      const ugPath = join(__dirname, '../../docs/USER-GUIDE.md');
      const faqPath = join(__dirname, '../../docs/FAQ.md');
      const ugContent = existsSync(ugPath) ? readFileSync(ugPath, 'utf-8') : '';
      const faqContent = existsSync(faqPath) ? readFileSync(faqPath, 'utf-8') : '';
      await client.query(
        `INSERT INTO doc_pages (slug, title, content) VALUES ($1, $2, $3), ($4, $5, $6)`,
        ['user-guide', 'User Guide', ugContent, 'faq', 'FAQ', faqContent]
      );
      console.log('[DB] Seeded doc_pages with USER-GUIDE.md and FAQ.md');
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
        ('billing.pro_product_price_cents', '300'::jsonb),
        ('billing.stripe_contributor_price_id', $1::jsonb),
        ('billing.stripe_pro_product_price_id', 'null'::jsonb)
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

    // Registry supplier cache — shared across all orgs/products
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

    // Seed default CRA category rules (regulatory baseline)
    const attrCount = await client.query('SELECT COUNT(*) FROM category_rule_attributes');
    if (parseInt(attrCount.rows[0].count) === 0) {
      // Distribution Scope
      await client.query(`
        INSERT INTO category_rule_attributes 
        (attribute_key, name, description, regulatory_basis, is_locked)
        VALUES 
        ('dist_scope', 'Distribution Scope', 'How widely is the product distributed', 'CRA Art. 4(1) — wider distribution increases risk', true)
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
        ('data_sensitivity', 'Data Sensitivity', 'Does the product handle sensitive data', 'CRA Art. 4 — sensitive data = higher risk', true)
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
        ('network_connectivity', 'Network Connectivity', 'Is the product connected to networks', 'CRA Art. 4 — network access = higher risk', true)
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
        ('user_criticality', 'User Criticality', 'Is the product used for critical functions', 'CRA Art. 3 — criticality determines class', true)
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

  } finally {
    client.release();
  }
}

export default pool;
