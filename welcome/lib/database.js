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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_assessments_email ON cra_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_verification_codes_email ON cra_verification_codes(email, used)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nis2_assessments_email ON nis2_assessments(email)`);
    console.log('[WELCOME] Assessment tables ready (CRA + NIS2)');
  } finally {
    client.release();
  }
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
