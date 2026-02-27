/**
 * CRANIS2 Test Helpers
 *
 * Provides:
 * - API client for making authenticated requests to dev server
 * - Auth helpers (register, login, get token)
 * - Postgres client for direct DB verification
 * - Neo4j driver for graph verification
 * - Test data tracking for cleanup
 */

import pg from 'pg';
import neo4j, { Driver, Session } from 'neo4j-driver';

// ─── Configuration ───────────────────────────────────────────────────────

export const BASE_URL = process.env.TEST_BASE_URL || 'https://dev.cranis2.dev';

const PG_CONFIG = {
  host: process.env.TEST_PG_HOST || 'localhost',
  port: parseInt(process.env.TEST_PG_PORT || '5433'),
  database: 'cranis2',
  user: process.env.TEST_PG_USER || 'cranis2',
  password: process.env.TEST_PG_PASSWORD || 'cranis2_dev_2026',
  ssl: false,
};

const TEST_DB_CONFIG = {
  ...PG_CONFIG,
  database: 'cranis2_test',
};

const NEO4J_CONFIG = {
  uri: process.env.TEST_NEO4J_URI || 'bolt://localhost:7688',
  user: process.env.TEST_NEO4J_USER || 'neo4j',
  password: process.env.TEST_NEO4J_PASSWORD || 'cranis2_dev_2026',
};

// ─── Connection Pools ────────────────────────────────────────────────────

let appPool: pg.Pool | null = null;
let testPool: pg.Pool | null = null;
let neo4jDriver: Driver | null = null;

export function getAppPool(): pg.Pool {
  if (!appPool) {
    appPool = new pg.Pool(PG_CONFIG);
  }
  return appPool;
}

export function getTestPool(): pg.Pool {
  if (!testPool) {
    testPool = new pg.Pool(TEST_DB_CONFIG);
  }
  return testPool;
}

export function getNeo4jDriver(): Driver {
  if (!neo4jDriver) {
    neo4jDriver = neo4j.driver(
      NEO4J_CONFIG.uri,
      neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password)
    );
  }
  return neo4jDriver;
}

export function getNeo4jSession(): Session {
  return getNeo4jDriver().session();
}

export async function closeAllConnections(): Promise<void> {
  if (appPool) { await appPool.end(); appPool = null; }
  if (testPool) { await testPool.end(); testPool = null; }
  if (neo4jDriver) { await neo4jDriver.close(); neo4jDriver = null; }
}

// ─── API Client ──────────────────────────────────────────────────────────

interface ApiResponse {
  status: number;
  headers: Headers;
  body: any;
  raw: Response;
}

interface RequestOptions {
  auth?: string;           // Bearer token
  body?: any;              // JSON body for POST/PUT
  query?: Record<string, string>; // Query params
  headers?: Record<string, string>;
  timeout?: number;
}

async function apiRequest(
  method: string,
  path: string,
  opts: RequestOptions = {}
): Promise<ApiResponse> {
  let url = `${BASE_URL}${path}`;

  if (opts.query) {
    const params = new URLSearchParams(opts.query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };

  if (opts.auth) {
    headers['Authorization'] = `Bearer ${opts.auth}`;
  }

  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(opts.timeout || 15000),
  };

  if (opts.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, fetchOpts);

  let body: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else if (contentType.includes('text/')) {
    body = await res.text();
  } else {
    // Binary response (ZIP, PDF, etc.)
    body = await res.arrayBuffer();
  }

  return { status: res.status, headers: res.headers, body, raw: res };
}

export const api = {
  get: (path: string, opts?: RequestOptions) => apiRequest('GET', path, opts),
  post: (path: string, opts?: RequestOptions) => apiRequest('POST', path, opts),
  put: (path: string, opts?: RequestOptions) => apiRequest('PUT', path, opts),
  delete: (path: string, opts?: RequestOptions) => apiRequest('DELETE', path, opts),
};

// ─── Auth Helpers ────────────────────────────────────────────────────────

// Cache tokens to avoid re-registering per test
const tokenCache = new Map<string, string>();

/**
 * Register a test user and return their session token.
 * DEV_MODE auto-verifies, so this returns a usable token immediately.
 */
export async function registerTestUser(
  email: string,
  password: string = 'TestPass123!'
): Promise<string> {
  if (tokenCache.has(email)) {
    return tokenCache.get(email)!;
  }

  const res = await api.post('/api/auth/register', {
    body: { email, password },
  });

  if (res.status === 201 || res.status === 200) {
    const token = res.body.session;
    if (token) {
      tokenCache.set(email, token);
      return token;
    }
  }

  // If user already exists, try login
  if (res.status === 409) {
    return loginTestUser(email, password);
  }

  throw new Error(`Failed to register ${email}: ${res.status} ${JSON.stringify(res.body)}`);
}

/**
 * Login an existing test user and return their session token.
 */
export async function loginTestUser(
  email: string,
  password: string = 'TestPass123!'
): Promise<string> {
  if (tokenCache.has(email)) {
    return tokenCache.get(email)!;
  }

  const res = await api.post('/api/auth/login', {
    body: { email, password },
  });

  if (res.status === 200 && res.body.session) {
    tokenCache.set(email, res.body.session);
    return res.body.session;
  }

  throw new Error(`Failed to login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
}

/**
 * Get a cached token or create one for a test user.
 */
export async function getTestToken(email: string): Promise<string> {
  if (tokenCache.has(email)) {
    return tokenCache.get(email)!;
  }
  return registerTestUser(email);
}

export function clearTokenCache(): void {
  tokenCache.clear();
}

// ─── Test Data Registry ──────────────────────────────────────────────────

/**
 * Track a piece of test data so cleanup can find and remove it.
 */
export async function registerTestData(
  entityType: string,
  entityId: string,
  database: 'postgres' | 'neo4j',
  suiteId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const pool = getTestPool();
  await pool.query(
    `INSERT INTO test_data_registry (entity_type, entity_id, database, suite_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [entityType, entityId, database, suiteId || null, metadata ? JSON.stringify(metadata) : null]
  );
}

/**
 * Get all tracked test data for a specific entity type.
 */
export async function getRegisteredTestData(
  entityType?: string
): Promise<Array<{ entity_type: string; entity_id: string; database: string; metadata: any }>> {
  const pool = getTestPool();
  let query = 'SELECT entity_type, entity_id, database, metadata FROM test_data_registry';
  const params: any[] = [];

  if (entityType) {
    query += ' WHERE entity_type = $1';
    params.push(entityType);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

// ─── Assertion Helpers ───────────────────────────────────────────────────

/**
 * Assert that a Postgres row exists with given conditions.
 */
export async function assertPgRowExists(
  table: string,
  conditions: Record<string, any>
): Promise<any> {
  const pool = getAppPool();
  const keys = Object.keys(conditions);
  const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
  const values = keys.map(k => conditions[k]);

  const result = await pool.query(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, values);
  if (result.rows.length === 0) {
    throw new Error(`Expected row in ${table} with ${JSON.stringify(conditions)} but none found`);
  }
  return result.rows[0];
}

/**
 * Assert that a Postgres row does NOT exist.
 */
export async function assertPgRowNotExists(
  table: string,
  conditions: Record<string, any>
): Promise<void> {
  const pool = getAppPool();
  const keys = Object.keys(conditions);
  const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
  const values = keys.map(k => conditions[k]);

  const result = await pool.query(`SELECT 1 FROM ${table} WHERE ${where} LIMIT 1`, values);
  if (result.rows.length > 0) {
    throw new Error(`Expected NO row in ${table} with ${JSON.stringify(conditions)} but found one`);
  }
}

/**
 * Assert that a Neo4j node exists.
 */
export async function assertNeo4jNodeExists(
  label: string,
  properties: Record<string, any>
): Promise<any> {
  const session = getNeo4jSession();
  try {
    const where = Object.keys(properties)
      .map(k => `n.${k} = $${k}`)
      .join(' AND ');
    const result = await session.run(
      `MATCH (n:${label}) WHERE ${where} RETURN n LIMIT 1`,
      properties
    );
    if (result.records.length === 0) {
      throw new Error(`Expected ${label} node with ${JSON.stringify(properties)} but none found`);
    }
    return result.records[0].get('n').properties;
  } finally {
    await session.close();
  }
}

/**
 * Count rows in a Postgres table matching conditions.
 */
export async function countPgRows(
  table: string,
  conditions?: Record<string, any>
): Promise<number> {
  const pool = getAppPool();
  let query = `SELECT COUNT(*)::int as count FROM ${table}`;
  const params: any[] = [];

  if (conditions) {
    const keys = Object.keys(conditions);
    const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    query += ` WHERE ${where}`;
    params.push(...keys.map(k => conditions[k]));
  }

  const result = await pool.query(query, params);
  return result.rows[0].count;
}

// ─── Test User Constants ─────────────────────────────────────────────────

export const TEST_USERS = {
  // TestOrg-Manufacturer-Active
  mfgAdmin: 'testadmin@manufacturer-active.test',
  mfgMember1: 'testmember1@manufacturer-active.test',
  mfgMember2: 'testmember2@manufacturer-active.test',
  mfgSuspended: 'testsuspended@manufacturer-active.test',

  // TestOrg-Importer-Trial
  impAdmin: 'testadmin@importer-trial.test',
  impMember: 'testmember@importer-trial.test',

  // TestOrg-Distributor-Suspended
  distAdmin: 'testadmin@distributor-suspended.test',
  distMember: 'testmember@distributor-suspended.test',

  // TestOrg-OSS-ReadOnly
  ossAdmin: 'testadmin@oss-readonly.test',
  ossMember: 'testmember@oss-readonly.test',

  // TestOrg-Manufacturer-PastDue
  pdAdmin: 'testadmin@manufacturer-pastdue.test',
  pdMember: 'testmember@manufacturer-pastdue.test',

  // TestOrg-Empty
  emptyAdmin: 'testadmin@empty-org.test',

  // Special
  orphanUser: 'testorphan@noorg.test',
  platformAdmin: 'testplatformadmin@cranis2.test',
} as const;

export const TEST_PASSWORD = 'TestPass123!';
