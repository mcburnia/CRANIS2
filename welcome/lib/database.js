/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const pg = require('pg');
const { DATABASE_URL } = require('../config');

let pool = null;

async function initDatabase() {
  if (!DATABASE_URL) {
    console.warn('[WELCOME] DATABASE_URL not set. Assessment persistence disabled.');
    return;
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        current_section INT NOT NULL DEFAULT 0,
        scores JSONB,
        category VARCHAR(50),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_launch_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        source VARCHAR(50) NOT NULL DEFAULT 'assessment',
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS nis2_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        current_section INT NOT NULL DEFAULT 0,
        scores JSONB,
        entity_class VARCHAR(50),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS importer_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        current_section INT NOT NULL DEFAULT 0,
        scores JSONB,
        readiness_level VARCHAR(50),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pqc_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        current_section INT NOT NULL DEFAULT 0,
        scores JSONB,
        readiness_level VARCHAR(50),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        position VARCHAR(255),
        status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
        lead_notified BOOLEAN NOT NULL DEFAULT FALSE,
        lead_notify_error TEXT,
        ip VARCHAR(100),
        country VARCHAR(10),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS disposable_email_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        domain VARCHAR(255) NOT NULL,
        ip VARCHAR(100),
        country VARCHAR(10),
        user_agent TEXT,
        source VARCHAR(50) NOT NULL DEFAULT 'contact',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS verified_emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_until TIMESTAMPTZ NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_emails_email ON verified_emails(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_assessments_email ON cra_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_verification_codes_email ON cra_verification_codes(email, used)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nis2_assessments_email ON nis2_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_importer_assessments_email ON importer_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pqc_assessments_email ON pqc_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disposable_email_log_domain ON disposable_email_log(domain)`);
    console.log('[WELCOME] Assessment tables ready (CRA + NIS2 + Importer + PQC + Contact + Disposable log + Verified emails)');
  } finally {
    client.release();
  }
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
